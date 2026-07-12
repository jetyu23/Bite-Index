"""Build data/profiles/calibration.json from historical Open-Meteo data.

    python engine/calibrate.py --days 365

Every historical day is scored with the exact same profiles and engine as the
daily run. The sorted raw-score distribution per profile is stored; at runtime
a raw score is converted to its percentile rank, so 50 literally means
"a median day" and 90 means "better than ~90% of days". No ML, no fitting:
just an empirical CDF, fully explainable.

Notes:
- Weather history comes from the ERA5 archive endpoint (years of coverage).
- Marine history: the marine API accepts past_days up to ~92; the archive-style
  start/end query is attempted first and past_days used as fallback. If marine
  history is shorter than the weather window, calibration is built on the
  overlapping window and says so. A winter-only window skews summer species
  (kingfish); re-run as history accumulates. The window is recorded in the file.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import ingest
import scoring
from run import load_profiles

OUT = Path(__file__).resolve().parent.parent / "data" / "profiles" / "calibration.json"


def fetch_history(days: int) -> ingest.Normalized:
    end = date.today() - timedelta(days=2)  # archive lags ~2 days
    start = end - timedelta(days=days)
    bundle = ingest.fetch_historical(start, end)
    return ingest.normalize(bundle)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=365)
    args = ap.parse_args()

    factors, envs, species = load_profiles()
    norm = fetch_history(args.days)
    print(ingest.validation_report(norm))
    if len(norm.days) < 45:
        print(f"REFUSING: only {len(norm.days)} usable days; calibration on <45 days is noise.")
        sys.exit(1)

    dist: dict[str, list[float]] = {}
    for profile in envs["environments"] + species["species"]:
        raws = []
        for day in norm.days:
            r = scoring.score_profile_day(profile, day, norm)
            if r is not None:
                raws.append(round(float(r["score"]), 1))
        raws.sort()
        dist[profile["id"]] = raws
        med = raws[len(raws) // 2] if raws else None
        print(f"  {profile['id']:<10} n={len(raws):>3}  raw median={med}")

    payload = {
        "generated": date.today().isoformat(),
        "window": [norm.days[0]["date"].isoformat(), norm.days[-1]["date"].isoformat()],
        "n_days": len(norm.days),
        "note": "Empirical raw-score distributions per profile. Runtime scores are mapped to percentile rank in these lists; the median historical day therefore scores 50.",
        "profiles": dist,
    }
    OUT.write_text(json.dumps(payload, indent=1))
    print(f"\nwrote {OUT} ({len(dist)} profiles, {len(norm.days)} days)")


if __name__ == "__main__":
    main()
