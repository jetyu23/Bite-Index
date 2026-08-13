"""Bite Index daily run.

    python engine/run.py --sample     # offline, deterministic demo data
    python engine/run.py --live      # real Open-Meteo pull (default)

Writes:
    data/output/latest.json + data/output/YYYY-MM-DD.json   (history)
    web/src/data/latest.json + web/src/data/profiles.json   (what the site builds from)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import ingest
import scoring

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ROOT / "data" / "profiles"
OUTPUT = ROOT / "data" / "output"
WEB_DATA = ROOT / "web" / "src" / "data"


def load_profiles() -> tuple[dict, dict, dict]:
    factors = json.loads((PROFILES / "factors.json").read_text())
    envs = json.loads((PROFILES / "environments.json").read_text())
    species = json.loads((PROFILES / "species.json").read_text())
    return factors, envs, species


def run(live: bool) -> dict:
    factors, envs, species = load_profiles()
    metric_defs = factors["metrics"]
    labels = factors["score_labels"]
    sessions_def = factors["sessions"]

    bundle = ingest.fetch_live() if live else ingest.build_sample()
    norm = ingest.normalize(bundle)
    print(ingest.validation_report(norm))

    # Calibration is an empirical distribution of real Sydney conditions; sample
    # data is a scripted synthetic demo, never part of that population, so it
    # is never rescaled against it (also keeps engine/tests.py, which runs on
    # sample data, independent of whether calibration.json exists).
    calib = scoring.load_calibration(PROFILES / "calibration.json") if live else None
    if calib:
        print(f"calibration: {calib['n_days']} days ({calib['window'][0]} to {calib['window'][1]})")
    else:
        print("calibration: none yet; raw scores only (run engine/calibrate.py after your first live pull)")

    days_out = []
    for day in norm.days:
        env_results_by_id: dict[str, dict] = {}
        env_results: list[dict] = []
        for env in envs["environments"]:
            res = scoring.score_profile_day(env, day, norm, sessions_def)
            if res is None:
                continue
            raw = res["score"]
            session_mean_raw = res["session_mean"]
            # calibrated is derived from the uncapped raw score, before safety
            # mutates res["score"] below. res["score"] itself keeps its prior
            # meaning (rescaled-or-raw) unchanged, because score_species_day
            # still reads it via env_results_by_id to pick each species' best
            # ground on a scale that's comparable across profiles -- rescale()
            # is global (pooled across all profiles), so it's valid for this
            # cross-profile comparison the same way straight percentile was,
            # without the noise-amplification straight percentile had.
            calibrated = round(scoring.rescale(calib, raw)) if calib else None
            res["score"] = calibrated if calibrated is not None else raw
            res = scoring.apply_safety(env, res, day, norm, sessions_def)
            if res["safety_flag"]:
                # A capped, dangerous day isn't meaningfully "better or worse
                # than most days" -- suppress the calibrated number rather
                # than show one next to a score that's been overridden anyway.
                # session_mean is capped too: a flagged day can't be "worth
                # going overall" either.
                raw_display = min(raw, env["safety"]["cap"])
                session_mean_display = min(session_mean_raw, env["safety"]["cap"])
                calibrated = None
            else:
                raw_display = raw
                session_mean_display = session_mean_raw
            window = scoring.humanize_window(res["best_window"])
            drivers_out = [
                {
                    "metric": d["metric"],
                    "label": metric_defs[d["metric"]]["label"],
                    "value": scoring.fmt_value(metric_defs[d["metric"]], d["value"]) if d["has_data"] else "no data",
                    "subscore": d["subscore"],
                    "weight_pct": d["weight_pct"],
                    "evidence": metric_defs[d["metric"]]["evidence"],
                    "note": scoring.driver_note(metric_defs[d["metric"]], d["subscore"]) if d["has_data"] else "no data; scored neutral",
                }
                for d in res["drivers"][:5]
            ]
            dist = calib.get("profiles", {}).get(env["id"]) if calib else None
            entry = {
                "id": env["id"],
                "name": env["name"],
                "tagline": env["tagline"],
                "tag": env.get("tag", ""),
                "score": raw_display,
                "session_mean": session_mean_display,
                "best_session": res["best_session"],
                "calibrated": calibrated,
                "raw_median": dist[len(dist) // 2] if dist else None,
                "reason": scoring.env_summary(res["drivers"], metric_defs, res.get("gate_note")),
                # Tier label is judged on the calibrated scale, not raw: raw
                # is compressed by averaging 8-11 factors (rock's raw scores
                # spent a whole year never once reaching "Excellent" under
                # thresholds set on raw). Falls back to raw with no
                # calibration (sample data, or a fresh clone before the
                # first calibrate.py run) -- a capped/flagged score is
                # always low enough to read "Poor" on either scale.
                "label": scoring.score_label(calibrated if calibrated is not None else raw_display, labels),
                "best_window": window,
                "safety_flag": res["safety_flag"],
                "safety_message": res["safety_message"],
                "drivers": drivers_out,
            }
            entry["raw_drivers"] = res["drivers"]
            env_results_by_id[env["id"]] = {**res}
            env_results.append(entry)

        sp_results = []
        env_names = {e["id"]: e["name"] for e in envs["environments"]}
        for sp in species["species"]:
            res = scoring.score_species_day(
                sp, env_results_by_id, day, norm, sessions_def,
                cal=lambda raw_own: scoring.rescale(calib, raw_own),
            )
            if res is None:
                continue
            # Displayed score is the species' own raw profile score -- the one
            # thing calibration.json's per-species distribution was actually
            # built from (calibrate.py never blends in an environment score).
            # Ranking "top targets" still uses the blended, rescaled value
            # (res["score"]) as a private sort key: raw scores aren't on a
            # comparable scale across different species profiles, so ranking
            # by raw would just favour whichever species has the highest
            # natural raw baseline, not the best day.
            own_raw = res["raw_score"]
            own_calibrated = round(scoring.rescale(calib, own_raw)) if calib else None
            window = scoring.humanize_window(res["best_window"])
            reason = scoring.build_reason(res["drivers"], env_names[res["environment"]], window, metric_defs, res.get("gate_note"))
            sp_results.append(
                {
                    "id": sp["id"],
                    "name": sp["name"],
                    "tag": sp.get("tag", ""),
                    "score": own_raw,
                    "session_mean": res["session_mean"],
                    "best_session": res["best_session"],
                    "calibrated": own_calibrated,
                    "label": scoring.score_label(own_calibrated if own_calibrated is not None else own_raw, labels),
                    "environment": res["environment"],
                    "environment_name": env_names[res["environment"]],
                    "best_window": window,
                    "reason": reason,
                    # Not displayed as a headline number: the calibrated,
                    # environment-blended value this list is actually sorted
                    # by. Raw scores aren't comparable across species profiles,
                    # so ranking by the displayed raw "score" would just
                    # favour whichever species has the highest natural raw
                    # baseline. Kept in the output rather than discarded,
                    # same "nothing hidden" reasoning as raw_drivers.
                    "rank_score": res["score"],
                }
            )
        sp_results.sort(key=lambda s: -s["rank_score"])

        headline = scoring.build_headline(env_results, sp_results, metric_defs) if env_results else "No data for today."
        for e in env_results:
            e.pop("raw_drivers", None)

        tide_curve = [
            {"t": t.strftime("%H:%M"), "h": norm.hours[t]["tide_h"]}
            for t in sorted(norm.hours)
            if t.date() == day["date"] and norm.hours[t]["tide_h"] is not None
        ]
        days_out.append(
            {
                "date": day["date"].isoformat(),
                "weekday": day["date"].strftime("%a"),
                "headline": headline,
                "summary": {
                    "sunrise": day["sunrise"].strftime("%H:%M") if day["sunrise"] else None,
                    "sunset": day["sunset"].strftime("%H:%M") if day["sunset"] else None,
                    "moon_name": day["moon_name"],
                    "moon_illum": day["moon_illum"],
                    "tide_events": [
                        {"time": e["t"].strftime("%H:%M"), "type": e["type"], "height": e["height"]}
                        for e in day["tide_events"]
                    ],
                    "tide_range": day["tide_range"],
                    "swell_max": day["swell_max"],
                    "swell_period": day["swell_period"],
                    "wind_max_kn": day["wind_max_kn"],
                    "pressure": day["pressure_day"],
                    "pressure_trend": day["pressure_trend"],
                    "rain_24h": day["rain_24h"],
                    "rain_72h": day["rain_72h"],
                    "rain_today": day["rain_today"],
                    "sst": day["sst_c"],
                },
                "tide_curve": tide_curve,
                "environments": env_results,
                "species": sp_results,
            }
        )

    return {
        "generated_at": datetime.now(ingest.TZ).isoformat(timespec="minutes"),
        "source": norm.source,
        "calibration": (
            {"applied": True, "window": calib["window"], "n_days": calib["n_days"]}
            if calib else {"applied": False, "window": None, "n_days": 0}
        ),
        "warnings": norm.warnings,
        "location": {"name": "Sydney", "lat": ingest.LAT, "lon": ingest.LON},
        "score_labels": labels,
        "days": days_out,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--live", action="store_true", help="fetch real Open-Meteo data (default)")
    mode.add_argument("--sample", action="store_true", help="use deterministic sample data (offline)")
    args = ap.parse_args()
    live = not args.sample

    out = run(live=live)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(out, indent=1)
    (OUTPUT / "latest.json").write_text(payload)
    if out["days"]:
        (OUTPUT / f"{out['days'][0]['date']}.json").write_text(payload)
    (WEB_DATA / "latest.json").write_text(payload)

    factors, envs, species = load_profiles()
    (WEB_DATA / "profiles.json").write_text(
        json.dumps({"factors": factors, "environments": envs["environments"], "species": species["species"]}, indent=1)
    )

    print(f"\nwrote {OUTPUT / 'latest.json'} and {WEB_DATA / 'latest.json'}")
    if out["days"]:
        d0 = out["days"][0]
        print(f"\n{d0['date']} — {d0['headline']}")
        for e in d0["environments"]:
            flag = "  ⚠ SAFETY FLAG" if e["safety_flag"] else ""
            print(f"  {e['name']:<16} {e['score']:>3} {e['label']:<9} best {e['best_window']}{flag}")
        print("  top targets: " + ", ".join(f"{s['name']} {s['score']}" for s in d0["species"][:4]))


if __name__ == "__main__":
    main()
