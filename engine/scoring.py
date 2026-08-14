"""The Bite Index scoring engine.

One generic engine, many profiles. A profile is a list of weighted factors;
each factor maps a metric to a 0-100 subscore through either a piecewise-linear
response curve, a category table, or a month-indexed season array. The profile
score is the weight-normalised mean of subscores. Environments and species are
both 'just profiles' — the entire product thesis ("same inputs, different
weightings, different answers") lives in the config, not the code.

Aggregation: conditions change through a day, and a daily average would bury
the dawn bite under the midday lull. So each profile is scored per hour
inside a small set of fixed named sessions (dawn, dusk, and so on -- see
factors.json's 'sessions' dict), hand-picked per profile for the ones that
make angling sense (tailor is dawn and dusk only; mulloway starts at dusk).
The day's score is the best session's mean, which also gives the user a
concrete 'best window' to plan around; the mean across all the profile's
sessions is reported too, as 'session_mean', for "is today worth going" as
distinct from "when's the best moment if I go". This replaced a rolling
3-hour-window search that could start at any hour in a wide range: real-world
comparison across the 366-day history showed the two produce almost
identical scores (the rolling search rarely lands anywhere but a named
session's neighbourhood anyway), so the switch is for explainability -- a
named session is inspectable and disputable by a real angler in a way an
algorithmically-found window isn't -- not because it changes day-to-day
range on its own.

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

def _session_hours(day: object, profile: dict, sessions_def: dict[str, list[int]]) -> list[tuple[str, list[datetime]]]:
    """Each of the profile's named sessions as (name, hour-list) -- hours as
    aware datetimes; a session end past 24 spills into the next day
    (mulloway's late_night session runs to 2 am). A profile's sessions are
    hand-picked, not necessarily contiguous or covering every hour of the
    day (tailor is dawn and dusk only, nothing between)."""
    out = []
    for name in profile["sessions"]:
        start, end = sessions_def[name]
        hrs = [datetime.combine(day, time(0), tzinfo=TZ) + timedelta(hours=h) for h in range(start, end)]
        out.append((name, hrs))
    return out


def _all_hours(day: object, profile: dict, sessions_def: dict[str, list[int]]) -> list[datetime]:
    """Every hour covered by any of the profile's sessions, flattened."""
    out = []
    for _, hrs in _session_hours(day, profile, sessions_def):
        out.extend(hrs)
    return out


def _gate_multiplier(profile: dict, metrics: dict[str, Any]) -> tuple[float, dict | None]:
    """Soft multiplicative gate for the small set of factors where the
    angling logic is genuinely gating, not contributing: dead slack water,
    a species' water-temperature switch-on point. Unlike a weighted factor,
    a gate multiplies the whole hour's score rather than averaging into it,
    so it cannot be diluted by the other 8-10 factors the way a normal
    weight can. Returns (multiplier, worst active gate or None)."""
    mult = 1.0
    worst: tuple[dict, float] | None = None
    for g in profile.get("gates", []):
        v = metrics.get(g["metric"])
        if v is None:
            continue
        m = interp_curve(g["points"], float(v))
        mult *= m
        if worst is None or m < worst[1]:
            worst = (g, m)
    return mult, (worst[0] if worst and worst[1] < 0.999 else None)


def score_profile_day(profile: dict, day_metrics: dict, norm: Normalized, sessions_def: dict[str, list[int]]) -> dict | None:
    """Score one profile for one day across its fixed named sessions (not a
    rolling search): each session is scored as the mean of its own hours, and
    the day's score is the best session, with the mean across all the
    profile's sessions also returned (see 'session_mean') for anyone asking
    "is today worth going at all", as opposed to "when's the best moment".
    Returns None if no session had data."""
    factors = profile["factors"]
    total_w = sum(f["weight"] for f in factors)

    sessions = []
    for name, hrs in _session_hours(day_metrics["date"], profile, sessions_def):
        hrs = [t for t in hrs if t in norm.hours]
        if not hrs:
            continue
        hour_scores: list[float] = []
        hour_subs: list[dict[str, tuple[float, bool, Any]]] = []
        hour_gates: list[dict | None] = []
        for t in hrs:
            merged = {**day_metrics, **norm.hours[t], "month": day_metrics["month"]}
            subs: dict[str, tuple[float, bool, Any]] = {}
            acc = 0.0
            for f in factors:
                s, has = factor_subscore(f, merged)
                subs[f["metric"]] = (s, has, merged.get(f["metric"]))
                acc += f["weight"] * s
            mult, active_gate = _gate_multiplier(profile, merged)
            hour_scores.append((acc / total_w) * mult)
            hour_subs.append(subs)
            hour_gates.append(active_gate)
        sessions.append({
            "name": name, "hrs": hrs, "subs": hour_subs, "gates": hour_gates,
            "mean": sum(hour_scores) / len(hour_scores),
        })

    if not sessions:
        return None

    best = max(sessions, key=lambda s: s["mean"])
    session_mean = sum(s["mean"] for s in sessions) / len(sessions)

    win_start, win_end = best["hrs"][0], best["hrs"][-1] + timedelta(hours=1)
    gates_in_best = [g for g in best["gates"] if g is not None]
    gate_note = gates_in_best[0]["note"] if gates_in_best else None

    # Drivers: averaged over the best session's hours, ranked by |weighted deviation from neutral|.
    drivers = []
    for f in factors:
        rows = [subs[f["metric"]] for subs in best["subs"]]
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
        "score": round(best["mean"]),
        "session_mean": round(session_mean),
        "best_session": best["name"],
        "best_window": [win_start.isoformat(), win_end.isoformat()],
        "drivers": drivers,
        "hours_scored": sum(len(s["hrs"]) for s in sessions),
        "gate_note": gate_note,
    }


def apply_safety(profile: dict, result: dict, day_metrics: dict, norm: Normalized, sessions_def: dict[str, list[int]]) -> dict:
    """Rock hard-override: cap the score on dangerous swell regardless of
    everything else. Unchanged behaviour from before sessions replaced the
    rolling window -- still scans every hour the profile is scored over for
    the day's worst swell, same thresholds, same cap, same flag condition.
    Only the source of "every hour the profile is scored over" changed, from
    a single continuous window to the union of its named sessions."""
    safety = profile.get("safety")
    result["safety_flag"] = False
    result["safety_message"] = None
    if not safety or not result:
        return result
    hrs = [t for t in _all_hours(day_metrics["date"], profile, sessions_def) if t in norm.hours]
    swells = [(norm.hours[t].get("swell_m"), norm.hours[t].get("swell_period_s")) for t in hrs]
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

def score_species_day(sp: dict, env_scores: dict[str, dict], day_metrics: dict, norm: Normalized, sessions_def: dict[str, list[int]], cal=None) -> dict | None:
    own = score_profile_day(sp, day_metrics, norm, sessions_def)
    if own is None:
        return None
    own_raw = own["score"]
    own_score = float(cal(own_raw)) if cal else float(own_raw)
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
        combined = affinity * (blend * env_component + (1 - blend) * own_score)
        if combined > best_score:
            best_env, best_score = env_id, combined
    if best_env is None:
        return None
    return {
        "score": round(best_score),
        "raw_score": own_raw,
        "session_mean": own["session_mean"],
        "best_session": own["best_session"],
        "environment": best_env,
        "best_window": own["best_window"],
        "drivers": own["drivers"],
        "gate_note": own["gate_note"],
    }


# --------------------------------------------------------------------------- #
# Percentile calibration (empirical CDF against scored history)
# --------------------------------------------------------------------------- #

def load_calibration(path) -> dict | None:
    """Load calibration.json if present; None means raw scores are used."""
    import json
    from pathlib import Path

    p = Path(path)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        if data.get("profiles"):
            return data
    except Exception:
        return None
    return None


def calibrate(calib: dict | None, profile_id: str, raw: float) -> float:
    """Map a raw score to its percentile rank in the profile's historical
    distribution. Median historical day -> 50 by construction. Falls back to
    the raw score when no calibration exists for the profile.

    Not used for display or ranking any more (see rescale() below) -- straight
    percentile rank turned out to amplify noise: two profiles with nearly
    identical raw scores can land at very different ranks purely because
    their own historical distributions sit at different raw levels (rock
    raw 74 and boat raw 69, a 5-point gap, ranked 98th and 25th percentile
    respectively on 2026-08-13's real data). Kept as a primitive -- true
    percentile rank is still a well-defined, useful number -- just not the
    right one for a display a reader compares across cards."""
    if not calib:
        return raw
    dist = calib.get("profiles", {}).get(profile_id)
    if not dist or len(dist) < 45:
        return raw
    import bisect

    lo = bisect.bisect_left(dist, raw)
    hi = bisect.bisect_right(dist, raw)
    rank = (lo + hi) / 2  # ties get the middle rank
    pct = 100.0 * rank / len(dist)
    return max(1.0, min(99.0, pct))


# Hand-set display targets at each pooled-history anchor. Anchored on robust
# percentiles (min/p1/p10/p90/p99/max of ALL 17 profiles' raw scores pooled
# together, not per profile) so equal raw quality RANKS equally regardless of
# which ground or species it's from. This is now used ONLY internally, for
# cross-profile ranking (build_headline's "best ground", species' "top
# targets" ordering) -- see RESCALE_DISPLAY_TARGETS below for what's actually
# shown to a reader. Kept separate on purpose: collapsing them back into one
# number is exactly the mistake that made the original noise-amplification
# bug possible (rock 74 vs boat 69 read 73 rank-points apart under straight
# percentile) -- see rescale_display()'s docstring for the fuller story.
RESCALE_TARGETS = [5.0, 20.0, 40.0, 70.0, 80.0, 95.0]  # y-values for min,p1,p10,p90,p99,max

# Hand-set display targets for the PER-PROFILE display rescale (2026-08-14).
# Wider than RESCALE_TARGETS on purpose: the pooled version above stays
# deliberately conservative because it's a ranking key, not something read as
# a number on its own. This one IS read on its own, and the pooled version's
# narrow ceiling (a "95" needed a genuinely exceptional profile AND a
# genuinely exceptional day at once, compounding two rarities into one) meant
# 90+ was reached only ~1-3 times a year per profile even after the
# 2026-08-13 tide_speed fix widened every profile's raw distribution.
# Verified against the real 366-day archive before picking these: 90+ lands
# 4-16 times a year per profile (close to "about once a month"), 80+ lands
# 9-36 times a year ("a few times a month"), and the 40-70 "ordinary" band
# still covers 78-85% of real days -- unchanged from the pooled version,
# since p10/p90 targets didn't move.
RESCALE_DISPLAY_TARGETS = [1.0, 12.0, 40.0, 70.0, 93.0, 100.0]


def robust_percentile(sorted_vals: list[float], p: float) -> float:
    """Linear-interpolation percentile (p in [0,100]) of an already-sorted list."""
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    k = (p / 100) * (n - 1)
    lo, hi = int(k), min(int(k) + 1, n - 1)
    frac = k - lo
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * frac


def rescale_anchors(pooled_sorted: list[float]) -> list[float]:
    """Raw-score x-values for the RESCALE_TARGETS anchors, from a pooled,
    sorted list of raw scores across every profile."""
    mn, mx = pooled_sorted[0], pooled_sorted[-1]
    xs = [mn, robust_percentile(pooled_sorted, 1), robust_percentile(pooled_sorted, 10),
          robust_percentile(pooled_sorted, 90), robust_percentile(pooled_sorted, 99), mx]
    for i in range(1, len(xs)):
        if xs[i] <= xs[i - 1]:
            xs[i] = xs[i - 1] + 0.01
    return xs


def _interp_anchors(xs: list[float], ys: list[float], raw: float) -> float:
    if raw <= xs[0]:
        return ys[0]
    if raw >= xs[-1]:
        return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= raw <= xs[i + 1]:
            if xs[i + 1] <= xs[i]:
                return ys[i + 1]
            return ys[i] + (ys[i + 1] - ys[i]) * (raw - xs[i]) / (xs[i + 1] - xs[i])
    return ys[-1]


def rescale(calib: dict | None, raw: float) -> float:
    """Non-linear rescale of a raw score for CROSS-PROFILE RANKING only
    (build_headline's "best ground", species "top targets" ordering) -- not
    for display, see rescale_display() below. Global (same pooled anchors
    for every profile), not per-profile, specifically because ranking needs
    two profiles' raw scores to compare on one consistent scale: a
    per-profile version was simulated for this purpose and rejected -- it
    makes each profile's own "ordinary" band land exactly at 40-70, but two
    profiles whose raw distributions sit at different levels (boat's runs
    ~5-6 points above rock's) then rank similar raw scores very differently,
    reproducing the exact bug this replaces (rock 74 vs boat 69, a 5-point
    raw gap, ranked 73 points apart under straight percentile). Falls back
    to the raw score when no calibration exists yet."""
    if not calib or "rescale_anchors" not in calib:
        return raw
    return _interp_anchors(calib["rescale_anchors"], RESCALE_TARGETS, raw)


def rescale_display(calib: dict | None, profile_id: str, raw: float) -> float:
    """Non-linear rescale of a raw score for DISPLAY -- the "calibrated"
    number and tier label shown to a reader. Per-profile (2026-08-14),
    unlike rescale() above: every other part of this engine (curves,
    weights, sessions, gates) is already hand-set per profile, and pooled
    anchors here meant a reader effectively saw "how good is this raw score
    across ALL 17 profiles pooled" rather than "how rare is this for the
    ground/species in front of me" -- the latter is what a 90+ or an
    Excellent tag is actually trying to communicate. The tradeoff, stated
    plainly (also on the methodology page): an 85 on two different profiles
    now means "equally rare for that profile," not "equally good in
    absolute terms" -- absolute cross-profile comparison is what rescale()
    and rank_score exist for, and nothing that picks a "best ground" or
    orders "top targets" reads this function's output. Falls back to
    rescale()'s pooled anchors if this profile has no per-profile anchors
    yet (a fresh calibration.json before its next regeneration), then to
    raw with no calibration at all."""
    if not calib:
        return raw
    by_profile = calib.get("rescale_anchors_by_profile", {})
    xs = by_profile.get(profile_id)
    if not xs:
        return rescale(calib, raw)
    return _interp_anchors(xs, RESCALE_DISPLAY_TARGETS, raw)


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


def top_notes(drivers: list[dict], metric_defs: dict, n: int = 2) -> list[str]:
    notes = []
    for d in drivers[:5]:
        if not d["has_data"]:
            continue
        note = driver_note(metric_defs[d["metric"]], d["subscore"])
        if note and note not in notes:
            notes.append(note)
        if len(notes) == n:
            break
    return notes


def build_reason(drivers: list[dict], env_name: str, window: str, metric_defs: dict, gate_note: str | None = None) -> str:
    notes = top_notes(drivers, metric_defs, 2)
    body = "; ".join(notes) if notes else "steady conditions across the board"
    s = f"{env_name}, {window}. {body[0].upper()}{body[1:]}."
    if gate_note:
        s += f" {gate_note[0].upper()}{gate_note[1:]}."
    return s


def env_summary(drivers: list[dict], metric_defs: dict, gate_note: str | None = None) -> str:
    """One typed line per environment for the ledger."""
    notes = top_notes(drivers, metric_defs, 2)
    body = "; ".join(notes) if notes else "steady conditions, nothing driving the score hard either way"
    s = body[0].upper() + body[1:] + "."
    if gate_note:
        s += f" {gate_note[0].upper()}{gate_note[1:]}."
    return s


def build_headline(env_results: list[dict], species_results: list[dict], metric_defs: dict, labels: list[dict]) -> str:
    """Composed bulletin, not a template: lead with the best ground, mention
    the runner-up, warn on the worst. No em dashes anywhere in site copy."""
    # "Best" is decided by the rescaled, cross-profile-comparable value
    # (comparable across profiles with different raw baselines), not raw
    # score -- same reason the frontend's week-strip and ledger pick a
    # winner this way too. The wording below still reads the winner's raw
    # score, unchanged.
    def _rank(e):
        # rank_score (pooled anchors), not calibrated (per-profile anchors,
        # 2026-08-14): calibrated now means "how rare for this ground", not
        # "how good compared to other grounds" -- see rescale_display()'s
        # docstring. Picking "best ground" needs the cross-profile-comparable
        # number.
        c = e.get("rank_score")
        return c if c is not None else e["score"]

    ranked = sorted(env_results, key=lambda e: -_rank(e))
    best, second, worst = ranked[0], ranked[1] if len(ranked) > 1 else None, ranked[-1]

    def name(e):
        return e["name"].split(" & ")[0].lower() if e["id"] != "boat" else "offshore"

    notes = top_notes(best.get("raw_drivers", []), metric_defs, 1)
    note = (notes[0] if notes else "").rstrip(".")

    # Phrasing thresholds read the live score_labels rather than a copied
    # literal, so a threshold re-derivation can't leave this phrasing
    # quietly out of sync with the tier label a reader sees right next to
    # it. Judged on `calibrated` (the per-profile DISPLAY value, same as the
    # tier label), not `_rank`/rank_score (the pooled value used only to
    # pick which ground is best) -- since 2026-08-14 these are genuinely
    # different numbers, see rescale_display()'s docstring.
    def _display(e):
        c = e.get("calibrated")
        return c if c is not None else e["score"]

    by_label = {row["label"]: row["min"] for row in labels}
    excellent_min, good_min, fair_min = by_label["Excellent"], by_label["Good"], by_label["Fair"]
    s = _display(best)
    if s >= excellent_min:
        lead = f"The {name(best)} is firing today" + (f": {note}." if note else ".")
    elif s >= good_min:
        lead = f"{name(best).capitalize()} first today" + (f": {note}." if note else ".")
    elif s >= fair_min:
        lead = f"A middling day. {name(best).capitalize()} is the pick" + (f": {note}." if note else ".")
    else:
        lead = f"A tough survey today; {name(best)} edges it at {best['score']}."
    parts = [lead]

    if second and second["id"] != best["id"]:
        if _display(second) >= good_min:
            parts.append(f"{name(second).capitalize()} holds too.")
        elif _display(second) >= fair_min:
            parts.append(f"{name(second).capitalize()} is workable.")

    flagged = [e for e in env_results if e.get("safety_flag")]
    if flagged:
        parts.append("Stay off the rocks: swell is over the safety line.")
    elif _display(worst) < fair_min and worst["id"] != best["id"]:
        parts.append(f"Give the {name(worst)} a miss.")

    if species_results:
        top = species_results[0]
        parts.append(f"Top target: {top['name']} ({top['score']}).")
    return " ".join(parts)
