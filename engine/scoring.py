"""The Bite Index scoring engine.

One generic engine, many profiles. A profile is a list of weighted factors;
each factor maps a metric to a 0-100 subscore through either a piecewise-linear
response curve, a category table, or a month-indexed season array. The profile
score is the weight-normalised mean of subscores. Environments and species are
both 'just profiles' — the entire product thesis ("same inputs, different
weightings, different answers") lives in the config, not the code.

Aggregation: conditions change through a day, and a daily average would bury
the dawn bite under the midday lull. So each profile is scored per hour inside
its realistic fishing window, and the day's score is the best rolling 3-hour
mean — which also gives the user a concrete 'best window' to plan around.

Safety: the rock profile carries a hard override. If swell exceeds the
threshold (or is long-period and moderate), the score is capped and a flag is
raised no matter what every other factor says. This is deliberately NOT a
weight — safety must not be tradeable against a good tide.

Missing data: a factor whose metric is None scores a neutral 50 and is marked
'(no data)'. Scores degrade honestly instead of failing or inventing numbers.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any

from ingest import TZ, Normalized

NEUTRAL = 50.0
ROLL_HOURS = 3


# --------------------------------------------------------------------------- #
# Factor evaluation
# --------------------------------------------------------------------------- #

def interp_curve(points: list[list[float]], x: float) -> float:
    """Piecewise-linear interpolation, clamped at both ends."""
    pts = sorted(points, key=lambda p: p[0])
    if x <= pts[0][0]:
        return float(pts[0][1])
    if x >= pts[-1][0]:
        return float(pts[-1][1])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            if x1 == x0:
                return float(y1)
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return NEUTRAL  # unreachable


def factor_subscore(factor: dict, metrics: dict[str, Any]) -> tuple[float, bool]:
    """Return (subscore 0-100, has_data)."""
    v = metrics.get(factor["metric"])
    if v is None:
        return NEUTRAL, False
    kind = factor.get("type", "curve")
    if kind == "curve":
        return interp_curve(factor["points"], float(v)), True
    if kind == "table":
        return float(factor["map"].get(str(v), NEUTRAL)), True
    if kind == "season":
        month = int(v)
        return float(factor["season"][month - 1]) * 100.0, True
    raise ValueError(f"Unknown factor type: {kind}")


# --------------------------------------------------------------------------- #
# Profile scoring over a day
# --------------------------------------------------------------------------- #

def _window_datetimes(day, window: list[int]) -> list[datetime]:
    """Window hours as aware datetimes; end past 24 spills into the next day
    (mulloway's window runs to 3 am)."""
    start, end = window
    out = []
    for h in range(start, end):
        out.append(datetime.combine(day, time(0), tzinfo=TZ) + timedelta(hours=h))
    return out


def score_profile_day(profile: dict, day_metrics: dict, norm: Normalized) -> dict | None:
    """Score one profile for one day. Returns None if no hours had data."""
    wdts = [t for t in _window_datetimes(day_metrics["date"], profile["window"]) if t in norm.hours]
    if not wdts:
        return None

    factors = profile["factors"]
    total_w = sum(f["weight"] for f in factors)

    hour_scores: list[float] = []
    hour_subs: list[dict[str, tuple[float, bool, Any]]] = []
    for t in wdts:
        merged = {**day_metrics, **norm.hours[t], "month": day_metrics["month"]}
        subs: dict[str, tuple[float, bool, Any]] = {}
        acc = 0.0
        for f in factors:
            s, has = factor_subscore(f, merged)
            subs[f["metric"]] = (s, has, merged.get(f["metric"]))
            acc += f["weight"] * s
        hour_scores.append(acc / total_w)
        hour_subs.append(subs)

    # Best rolling window.
    k = min(ROLL_HOURS, len(hour_scores))
    best_i, best_mean = 0, -1.0
    for i in range(len(hour_scores) - k + 1):
        m = sum(hour_scores[i : i + k]) / k
        if m > best_mean:
            best_i, best_mean = i, m

    win_start, win_end = wdts[best_i], wdts[best_i + k - 1] + timedelta(hours=1)

    # Drivers: averaged over the best window, ranked by |weighted deviation from neutral|.
    drivers = []
    for f in factors:
        rows = [hour_subs[i][f["metric"]] for i in range(best_i, best_i + k)]
        sub = sum(r[0] for r in rows) / len(rows)
        has = any(r[1] for r in rows)
        vals = [r[2] for r in rows if r[2] is not None]
        val = vals[len(vals) // 2] if vals else None
        contribution = (f["weight"] / total_w) * (sub - NEUTRAL)
        drivers.append(
            {
                "metric": f["metric"],
                "weight_pct": round(100 * f["weight"] / total_w),
                "subscore": round(sub),
                "value": val,
                "has_data": has,
                "contribution": round(contribution, 1),
            }
        )
    drivers.sort(key=lambda d: abs(d["contribution"]), reverse=True)

    return {
        "score": round(best_mean),
        "best_window": [win_start.isoformat(), win_end.isoformat()],
        "drivers": drivers,
        "hours_scored": len(wdts),
    }


def apply_safety(profile: dict, result: dict, day_metrics: dict, norm: Normalized) -> dict:
    """Rock hard-override: cap the score on dangerous swell regardless of everything else."""
    safety = profile.get("safety")
    result["safety_flag"] = False
    result["safety_message"] = None
    if not safety or not result:
        return result
    wdts = [t for t in _window_datetimes(day_metrics["date"], profile["window"]) if t in norm.hours]
    swells = [(norm.hours[t].get("swell_m"), norm.hours[t].get("swell_period_s")) for t in wdts]
    swells = [(s, p) for s, p in swells if s is not None]
    if not swells:
        return result
    max_s = max(s for s, _ in swells)
    long_period_danger = any(
        s >= safety["long_period_swell_m"] and (p or 0) >= safety["long_period_s"] for s, p in swells
    )
    if max_s >= safety["metric_max_swell_m"] or long_period_danger:
        result["score"] = min(result["score"], safety["cap"])
        result["safety_flag"] = True
        result["safety_message"] = safety["message"]
    return result


# --------------------------------------------------------------------------- #
# Species blending
# --------------------------------------------------------------------------- #

def score_species_day(sp: dict, env_scores: dict[str, dict], day_metrics: dict, norm: Normalized) -> dict | None:
    own = score_profile_day(sp, day_metrics, norm)
    if own is None:
        return None
    blend = sp.get("env_blend", 0.5)
    best_env, best_score = None, -1.0
    for env_id, affinity in sp["environments"].items():
        env = env_scores.get(env_id)
        if env is None:
            continue
        env_component = env["score"]
        # A safety-flagged environment must not be recommended for any species.
        if env.get("safety_flag"):
            env_component = min(env_component, 15)
        combined = affinity * (blend * env_component + (1 - blend) * own["score"])
        if combined > best_score:
            best_env, best_score = env_id, combined
    if best_env is None:
        return None
    return {
        "score": round(best_score),
        "environment": best_env,
        "best_window": own["best_window"],
        "drivers": own["drivers"],
    }


# --------------------------------------------------------------------------- #
# Presentation helpers (labels, value strings, reasons, headline)
# --------------------------------------------------------------------------- #

def score_label(score: float, labels: list[dict]) -> str:
    for row in sorted(labels, key=lambda r: -r["min"]):
        if score >= row["min"]:
            return row["label"]
    return labels[-1]["label"]


def fmt_value(metric_def: dict, value: Any) -> str:
    if value is None:
        return "no data"
    try:
        return metric_def["fmt"].format(v=value)
    except (ValueError, KeyError, TypeError):
        return str(value)


def driver_note(metric_def: dict, subscore: float) -> str:
    if subscore >= 62:
        return metric_def.get("note_pos", "")
    if subscore <= 44:
        return metric_def.get("note_neg", "")
    return ""


def humanize_window(win: list[str]) -> str:
    s, e = datetime.fromisoformat(win[0]), datetime.fromisoformat(win[1])

    def f(t: datetime) -> str:
        h = t.strftime("%I").lstrip("0") or "12"
        return f"{h}{t.strftime('%p').lower()}" if t.minute == 0 else t.strftime("%I:%M%p").lstrip("0").lower()

    return f"{f(s)}–{f(e)}"


def build_reason(drivers: list[dict], env_name: str, window: str, metric_defs: dict) -> str:
    notes = []
    for d in drivers[:4]:
        if not d["has_data"]:
            continue
        note = driver_note(metric_defs[d["metric"]], d["subscore"])
        if note and note not in notes:
            notes.append(note)
        if len(notes) == 2:
            break
    body = "; ".join(notes) if notes else "steady conditions across the board"
    return f"{env_name}, {window} — {body}."


def build_headline(env_results: list[dict], species_results: list[dict]) -> str:
    best = max(env_results, key=lambda e: e["score"])
    s = best["score"]
    if s >= 80:
        lead = f"Get out there — the {best['name'].lower()} is firing."
    elif s >= 60:
        lead = f"A solid day: {best['name'].lower()} is the pick."
    elif s >= 40:
        lead = f"Middling conditions — {best['name'].lower()} is your best bet."
    else:
        lead = f"A tough day all round; {best['name'].lower()} edges it if you're keen."
    parts = [lead]
    if species_results:
        top = species_results[0]
        parts.append(f"Top target: {top['name']} ({top['score']}).")
    flagged = [e for e in env_results if e.get("safety_flag")]
    if flagged:
        parts.append("Stay off the rocks — swell is at dangerous levels.")
    return " ".join(parts)
