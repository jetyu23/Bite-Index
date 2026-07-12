"""Bite Index engine tests — run in CI before every scoring run.

    python engine/tests.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import ingest
import run as runner
import scoring

FAILURES = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global FAILURES
    status = "ok " if cond else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        FAILURES += 1


def test_interp() -> None:
    pts = [[0, 0], [10, 100]]
    check("interp midpoint", scoring.interp_curve(pts, 5) == 50)
    check("interp clamp low", scoring.interp_curve(pts, -5) == 0)
    check("interp clamp high", scoring.interp_curve(pts, 50) == 100)
    check("interp unsorted input", scoring.interp_curve([[10, 100], [0, 0]], 2.5) == 25)


def test_factor_types() -> None:
    s, has = scoring.factor_subscore({"metric": "light_phase", "type": "table", "map": {"dawn": 95}}, {"light_phase": "dawn"})
    check("table factor", s == 95 and has)
    s, has = scoring.factor_subscore({"metric": "month", "type": "season", "season": [0.5] * 12}, {"month": 7})
    check("season factor", s == 50 and has)
    s, has = scoring.factor_subscore({"metric": "swell_m", "type": "curve", "points": [[0, 0], [2, 100]]}, {"swell_m": None})
    check("missing data → neutral", s == scoring.NEUTRAL and not has)


def test_end_to_end() -> dict:
    out = runner.run(live=False)
    days = out["days"]
    check("7 days scored", len(days) == 7, f"got {len(days)}")
    d0 = days[0]
    check("5 environments", len(d0["environments"]) == 5)
    check("7 species", len(d0["species"]) == 7)
    check("species sorted desc", all(a["score"] >= b["score"] for a, b in zip(d0["species"], d0["species"][1:])))
    all_scores = [e["score"] for d in days for e in d["environments"]] + [s["score"] for d in days for s in d["species"]]
    check("scores within 0–100", all(0 <= s <= 100 for s in all_scores))
    check("tide events derived", len(d0["summary"]["tide_events"]) >= 2, str(d0["summary"]["tide_events"]))
    check("tide curve present", len(d0["tide_curve"]) >= 20)
    check("headline non-empty", bool(d0["headline"]))
    for e in d0["environments"]:
        check(f"drivers present: {e['id']}", len(e["drivers"]) >= 3)
    return out


def test_safety_flag(out: dict) -> None:
    # Sample data scripts a 2.7 m swell day (day index 3 of the forecast window).
    flagged = [(d["date"], e) for d in out["days"] for e in d["environments"] if e["id"] == "rock" and e["safety_flag"]]
    check("rock safety flag fires on the scripted big-swell day", len(flagged) >= 1)
    if flagged:
        _, e = flagged[0]
        check("flag caps score", e["score"] <= 15, f"score={e['score']}")
        check("flag carries message", bool(e["safety_message"]))
    # And the same day, beach should NOT be capped (the whole point of per-environment profiles).
    if flagged:
        flag_date = flagged[0][0]
        day = next(d for d in out["days"] if d["date"] == flag_date)
        beach = next(e for e in day["environments"] if e["id"] == "beach")
        check("beach not capped on rock-flag day", beach["score"] > 15, f"beach={beach['score']}")
        # No species should be recommended into a flagged rock environment.
        check("no species routed to flagged rock", all(s["environment"] != "rock" for s in day["species"]))


def test_windows(out: dict) -> None:
    d0 = out["days"][0]
    mull = next(s for s in d0["species"] if s["id"] == "mulloway")
    check("mulloway window is late (dusk/night)", any(tag in mull["best_window"] for tag in ("pm", "am")), mull["best_window"])
    check("reason string built", mull["reason"].startswith("Estuary"), mull["reason"])


def test_calibration() -> None:
    check("no calibration = raw passthrough", scoring.calibrate(None, "beach", 63.0) == 63.0)
    dist = sorted(float(v) for v in range(20, 81))  # 61 days, median 50
    calib = {"profiles": {"beach": dist}}
    med = scoring.calibrate(calib, "beach", 50.0)
    check("median raw maps to ~50", 48 <= med <= 52, f"{med}")
    check("top raw maps high (clamped <=99)", scoring.calibrate(calib, "beach", 200.0) == 99.0)
    check("bottom raw maps low (clamped >=1)", scoring.calibrate(calib, "beach", 1.0) == 1.0)
    check("unknown profile = raw passthrough", scoring.calibrate(calib, "rock", 63.0) == 63.0)
    check("tiny distribution ignored", scoring.calibrate({"profiles": {"beach": [1, 2, 3]}}, "beach", 63.0) == 63.0)


def test_no_em_dashes(out: dict) -> None:
    import json as _json
    check("no em dashes anywhere in site output", "\u2014" not in _json.dumps(out))


def test_profiles_valid() -> None:
    factors, envs, species = runner.load_profiles()
    metric_ids = set(factors["metrics"].keys())
    for group, plist in (("env", envs["environments"]), ("species", species["species"])):
        for p in plist:
            for f in p["factors"]:
                check(f"{group}:{p['id']} metric '{f['metric']}' known", f["metric"] in metric_ids)
                if f.get("type", "curve") == "curve":
                    check(f"{group}:{p['id']}:{f['metric']} curve scores 0–100", all(0 <= y <= 100 for _, y in f["points"]))
                if f.get("type") == "season":
                    check(f"{group}:{p['id']} season has 12 months", len(f["season"]) == 12)
            check(f"{group}:{p['id']} has justifications", all(bool(f.get("justification")) for f in p["factors"]))


if __name__ == "__main__":
    test_interp()
    test_factor_types()
    test_profiles_valid()
    test_calibration()
    out = test_end_to_end()
    test_safety_flag(out)
    test_windows(out)
    test_no_em_dashes(out)
    print(f"\n{'ALL TESTS PASSED' if FAILURES == 0 else f'{FAILURES} FAILURES'}")
    sys.exit(1 if FAILURES else 0)
