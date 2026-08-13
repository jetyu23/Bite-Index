"""Build data/profiles/calibration.json from historical Open-Meteo data.

    python engine/calibrate.py --days 365

Every historical day is scored with the exact same profiles and engine as the
daily run. The sorted raw-score distribution per profile is stored (and
pooled across all profiles into 'rescale_anchors', robust percentiles used to
hand-anchor the display rescale -- see scoring.rescale()). No ML, no fitting:
everything here is an empirical percentile computation, fully explainable and
recomputable from the stored history.

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
    norm = ingest.normalize(bundle, historical=True)
    # fetch_historical pads the query window before `start` for lookback
    # accuracy (rain_72h, pressure_trend); trim back to the requested window.
    norm.days = [d for d in norm.days if d["date"] >= start]
    return norm


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

    sessions_def = factors["sessions"]
    dist: dict[str, list[float]] = {}
    for profile in envs["environments"] + species["species"]:
        raws = []
        for day in norm.days:
            r = scoring.score_profile_day(profile, day, norm, sessions_def)
            if r is not None:
                raws.append(round(float(r["score"]), 1))
        raws.sort()
        dist[profile["id"]] = raws
        med = raws[len(raws) // 2] if raws else None
        print(f"  {profile['id']:<10} n={len(raws):>3}  raw median={med}")

    # Pooled across every profile, not per-profile: this is what the display
    # rescale is anchored on, deliberately, so equal raw quality displays
    # equally regardless of which ground or species it's from. See
    # scoring.rescale()'s docstring for why per-profile anchors were rejected.
    pooled = sorted(v for raws in dist.values() for v in raws)
    anchors = scoring.rescale_anchors(pooled)
    print(f"  rescale anchors (pooled, min/p1/p10/p90/p99/max): {[round(a, 1) for a in anchors]}")

    payload = {
        "generated": date.today().isoformat(),
        "window": [norm.days[0]["date"].isoformat(), norm.days[-1]["date"].isoformat()],
        "n_days": len(norm.days),
        "note": "Empirical raw-score distributions per profile (used to build 'rescale_anchors' below, pooled across all profiles). Both display and cross-profile ranking (which ground/species is relatively best today) use the non-linear rescale in 'rescale_anchors', not a per-profile percentile lookup -- equal raw quality then displays and ranks equally regardless of which ground or species it's from.",
        "profiles": dist,
        "rescale_anchors": anchors,
    }
    OUT.write_text(json.dumps(payload, indent=1))
    print(f"\nwrote {OUT} ({len(dist)} profiles, {len(norm.days)} days)")


if __name__ == "__main__":
    main()
