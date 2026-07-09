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

    bundle = ingest.fetch_live() if live else ingest.build_sample()
    norm = ingest.normalize(bundle)
    print(ingest.validation_report(norm))

    days_out = []
    for day in norm.days:
        env_results_by_id: dict[str, dict] = {}
        env_results: list[dict] = []
        for env in envs["environments"]:
            res = scoring.score_profile_day(env, day, norm)
            if res is None:
                continue
            res = scoring.apply_safety(env, res, day, norm)
            window = scoring.humanize_window(res["best_window"])
            drivers_out = [
                {
                    "metric": d["metric"],
                    "label": metric_defs[d["metric"]]["label"],
                    "value": scoring.fmt_value(metric_defs[d["metric"]], d["value"]) if d["has_data"] else "no data",
                    "subscore": d["subscore"],
                    "weight_pct": d["weight_pct"],
                    "evidence": metric_defs[d["metric"]]["evidence"],
                    "note": scoring.driver_note(metric_defs[d["metric"]], d["subscore"]) if d["has_data"] else "no data — scored neutral",
                }
                for d in res["drivers"][:5]
            ]
            entry = {
                "id": env["id"],
                "name": env["name"],
                "tagline": env["tagline"],
                "score": res["score"],
                "label": scoring.score_label(res["score"], labels),
                "best_window": window,
                "safety_flag": res["safety_flag"],
                "safety_message": res["safety_message"],
                "drivers": drivers_out,
            }
            env_results_by_id[env["id"]] = {**res}
            env_results.append(entry)

        sp_results = []
        env_names = {e["id"]: e["name"] for e in envs["environments"]}
        for sp in species["species"]:
            res = scoring.score_species_day(sp, env_results_by_id, day, norm)
            if res is None:
                continue
            window = scoring.humanize_window(res["best_window"])
            reason = scoring.build_reason(res["drivers"], env_names[res["environment"]], window, metric_defs)
            sp_results.append(
                {
                    "id": sp["id"],
                    "name": sp["name"],
                    "score": res["score"],
                    "label": scoring.score_label(res["score"], labels),
                    "environment": res["environment"],
                    "environment_name": env_names[res["environment"]],
                    "best_window": window,
                    "reason": reason,
                }
            )
        sp_results.sort(key=lambda s: -s["score"])

        tide_curve = [
            {"t": t.strftime("%H:%M"), "h": norm.hours[t]["tide_h"]}
            for t in sorted(norm.hours)
            if t.date() == day["date"] and norm.hours[t]["tide_h"] is not None
        ]
        days_out.append(
            {
                "date": day["date"].isoformat(),
                "weekday": day["date"].strftime("%a"),
                "headline": scoring.build_headline(env_results, sp_results) if env_results else "No data for today.",
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
