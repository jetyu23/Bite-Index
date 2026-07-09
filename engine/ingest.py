"""Data ingestion for Bite Index.

Two entry points:
    fetch_live()   -> raw bundle from Open-Meteo (forecast API + marine API)
    build_sample() -> deterministic synthetic bundle with the exact same shape,
                      so the whole pipeline runs and can be tested offline.

Then normalize(bundle) turns either into scored-ready structures:
    hours: {aware datetime -> {metric: value}}  (hour-granularity metrics)
    days:  [ {date-level metrics + display summary} ]

Design decisions worth defending in an interview:
  * Tides come from Open-Meteo Marine's `sea_level_height_msl` (a global tide
    model) rather than a paid tide API or hand-rolled harmonic constituents.
    One free source, no key. High/low events are recovered from the hourly
    series with parabolic peak refinement (hourly sampling alone would give
    +/-30 min event times; the parabola gets that to a few minutes).
  * Every expected field is validated. A missing field degrades to a neutral
    factor score plus a visible warning in the output JSON — the site never
    silently invents data.
"""
from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from astro import light_phase, moon_phase

TZ = ZoneInfo("Australia/Sydney")

# Sydney city point for weather; a point off the Heads for the marine model
# (the marine grid needs an ocean cell — the CBD is on land).
LAT, LON = -33.8688, 151.2093
MARINE_LAT, MARINE_LON = -33.85, 151.30

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"

FORECAST_HOURLY = [
    "precipitation",
    "pressure_msl",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "cloud_cover",
]
FORECAST_DAILY = ["sunrise", "sunset", "precipitation_sum"]
MARINE_HOURLY = [
    "swell_wave_height",
    "swell_wave_period",
    "wave_height",
    "sea_surface_temperature",
    "sea_level_height_msl",
]

PAST_DAYS = 3  # needed for rain_72h and the 24h pressure trend
FORECAST_DAYS = 7

KMH_TO_KN = 1 / 1.852
ONSHORE_BEARING = 90.0  # Sydney's ocean coast faces east; wind FROM ~90° is onshore


# --------------------------------------------------------------------------- #
# Fetch / sample
# --------------------------------------------------------------------------- #

def fetch_live() -> dict:
    """Pull forecast + marine data from Open-Meteo. Requires network."""
    import requests

    warnings: list[str] = []

    fc = requests.get(
        FORECAST_URL,
        params={
            "latitude": LAT,
            "longitude": LON,
            "hourly": ",".join(FORECAST_HOURLY),
            "daily": ",".join(FORECAST_DAILY),
            "timezone": "Australia/Sydney",
            "past_days": PAST_DAYS,
            "forecast_days": FORECAST_DAYS,
        },
        timeout=30,
    )
    fc.raise_for_status()
    fc = fc.json()

    try:
        mr = requests.get(
            MARINE_URL,
            params={
                "latitude": MARINE_LAT,
                "longitude": MARINE_LON,
                "hourly": ",".join(MARINE_HOURLY),
                "timezone": "Australia/Sydney",
                "past_days": 1,
                "forecast_days": FORECAST_DAYS,
            },
            timeout=30,
        )
        mr.raise_for_status()
        mr = mr.json()
    except Exception as exc:  # marine down shouldn't kill the whole run
        warnings.append(f"Marine API unavailable ({exc}); swell/SST/tide factors neutral today.")
        mr = {"hourly": {"time": []}}

    return {"source": "open-meteo", "forecast": fc, "marine": mr, "warnings": warnings}


def build_sample(start: date | None = None) -> dict:
    """Deterministic synthetic week with the same JSON shape Open-Meteo returns.

    Scripted so the demo exercises the interesting behaviour:
      * a rain event before day 0 (estuary + mulloway light up),
      * a big-swell day on day 3 (rock safety override fires),
      * a glass-out on day 5 (boat/offshore peaks).
    """
    rng = random.Random(42)
    start = start or datetime.now(TZ).date()
    t0 = datetime.combine(start - timedelta(days=PAST_DAYS), time(0), tzinfo=TZ)
    n_hours = (PAST_DAYS + FORECAST_DAYS) * 24

    times, precip, pressure, wind_s, wind_d = [], [], [], [], []
    swell_h, swell_p, wave_h, sst, sea_level = [], [], [], [], []

    # Day-indexed scripts (index 0 == PAST_DAYS days ago).
    swell_script = {0: 1.1, 1: 1.3, 2: 1.4, 3: 1.2, 4: 1.0, 5: 1.4, 6: 2.7, 7: 2.2, 8: 0.8, 9: 1.1}
    wind_script = {0: 12, 1: 10, 2: 14, 3: 9, 4: 8, 5: 11, 6: 22, 7: 16, 8: 5, 9: 9}
    rain_script = {1: 14.0, 2: 9.0}  # mm falling on those days (pre-day-0 fresh)

    for i in range(n_hours):
        t = t0 + timedelta(hours=i)
        di = (t.date() - t0.date()).days
        h = t.hour
        times.append(t.strftime("%Y-%m-%dT%H:%M"))

        day_rain = rain_script.get(di, 0.0)
        precip.append(round(day_rain / 8, 2) if day_rain and 6 <= h < 14 else 0.0)

        pressure.append(round(1016 + 6 * math.sin(2 * math.pi * (i / 96)) + rng.uniform(-0.4, 0.4), 1))

        base_w = wind_script.get(di, 10)
        seabreeze = max(0.0, math.sin((h - 9) / 10 * math.pi)) * 7 if 9 <= h <= 19 else 0
        wind_s.append(round((base_w + seabreeze + rng.uniform(-1, 1)) * 1.852, 1))  # store km/h like the API
        wind_d.append(round((250 if h < 10 else 60) + rng.uniform(-25, 25)) % 360)

        sw = swell_script.get(di, 1.2) + 0.15 * math.sin(2 * math.pi * i / 40)
        swell_h.append(round(max(0.3, sw), 2))
        swell_p.append(round(9 + (3.5 if di == 6 else 0) + rng.uniform(-0.5, 0.5), 1))
        wave_h.append(round(max(0.4, sw + 0.2), 2))
        sst.append(round(17.6 + 0.3 * math.sin(2 * math.pi * i / 300), 1))

        # Semidiurnal tide with diurnal inequality — realistic for Sydney.
        th = i + 0.0
        lvl = (
            0.50 * math.sin(2 * math.pi * th / 12.42 + 1.1)
            + 0.13 * math.sin(2 * math.pi * th / 12.00 + 0.4)
            + 0.11 * math.sin(2 * math.pi * th / 25.82 + 2.2)
        )
        sea_level.append(round(lvl, 3))

    d0 = t0.date()
    daily_dates = [(d0 + timedelta(days=k)).isoformat() for k in range(PAST_DAYS + FORECAST_DAYS)]
    forecast = {
        "hourly": {
            "time": times,
            "precipitation": precip,
            "pressure_msl": pressure,
            "wind_speed_10m": wind_s,
            "wind_direction_10m": wind_d,
            "wind_gusts_10m": [round(w * 1.4, 1) for w in wind_s],
            "cloud_cover": [50] * n_hours,
        },
        "daily": {
            "time": daily_dates,
            "sunrise": [f"{d}T07:00" for d in daily_dates],
            "sunset": [f"{d}T16:57" for d in daily_dates],
            "precipitation_sum": [rain_script.get(k, 0.0) for k in range(PAST_DAYS + FORECAST_DAYS)],
        },
    }
    marine = {
        "hourly": {
            "time": times,
            "swell_wave_height": swell_h,
            "swell_wave_period": swell_p,
            "wave_height": wave_h,
            "sea_surface_temperature": sst,
            "sea_level_height_msl": sea_level,
        }
    }
    return {"source": "sample", "forecast": forecast, "marine": marine, "warnings": ["SAMPLE DATA — not a real forecast."]}


# --------------------------------------------------------------------------- #
# Normalisation
# --------------------------------------------------------------------------- #

@dataclass
class Normalized:
    hours: dict[datetime, dict]           # hour-level metrics
    days: list[dict]                       # day-level metrics + display summary
    tide_events: list[dict]                # [{"t": datetime, "type": "high"/"low", "height": m}]
    warnings: list[str] = field(default_factory=list)
    source: str = "unknown"


def _parse_local(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ)


def _series(block: dict, key: str, times: list[datetime], warnings: list[str], label: str) -> dict[datetime, float | None]:
    vals = block.get(key)
    if not vals:
        warnings.append(f"Field '{key}' missing from {label} response — factor degrades to neutral.")
        return {t: None for t in times}
    return {t: vals[i] if i < len(vals) else None for i, t in enumerate(times)}


def _tide_events(times: list[datetime], heights: dict[datetime, float | None]) -> list[dict]:
    """Local extrema of the hourly sea-level series, with parabolic time refinement."""
    ts = [t for t in times if heights.get(t) is not None]
    events = []
    for i in range(1, len(ts) - 1):
        a, b, c = heights[ts[i - 1]], heights[ts[i]], heights[ts[i + 1]]
        if (b > a and b >= c) or (b < a and b <= c):
            denom = a - 2 * b + c
            offset = 0.0 if abs(denom) < 1e-9 else max(-1.0, min(1.0, 0.5 * (a - c) / denom))
            t_ref = ts[i] + timedelta(hours=offset)
            h_ref = b - 0.25 * (a - c) * offset  # parabola value at vertex, close enough
            events.append({"t": t_ref, "type": "high" if b > a else "low", "height": round(h_ref, 2)})
    return events


def normalize(bundle: dict) -> Normalized:
    warnings = list(bundle.get("warnings", []))
    fc_h = bundle["forecast"]["hourly"]
    fc_d = bundle["forecast"]["daily"]
    mr_h = bundle.get("marine", {}).get("hourly", {})

    times = [_parse_local(s) for s in fc_h["time"]]
    m_times = [_parse_local(s) for s in mr_h.get("time", [])]

    precip = _series(fc_h, "precipitation", times, warnings, "forecast")
    pressure = _series(fc_h, "pressure_msl", times, warnings, "forecast")
    wind = _series(fc_h, "wind_speed_10m", times, warnings, "forecast")
    wind_dir = _series(fc_h, "wind_direction_10m", times, warnings, "forecast")

    swell = _series(mr_h, "swell_wave_height", m_times, warnings, "marine")
    swell_p = _series(mr_h, "swell_wave_period", m_times, warnings, "marine")
    sst = _series(mr_h, "sea_surface_temperature", m_times, warnings, "marine")
    sea_level = _series(mr_h, "sea_level_height_msl", m_times, warnings, "marine")

    tide_events = _tide_events(m_times, sea_level)
    if not tide_events:
        warnings.append("Tide data unavailable — tide factors neutral, no tide times shown.")

    # Per-date peak flow for normalising tide_speed.
    flow: dict[datetime, float | None] = {}
    for i, t in enumerate(m_times):
        if 0 < i < len(m_times) - 1:
            a, c = sea_level.get(m_times[i - 1]), sea_level.get(m_times[i + 1])
            flow[t] = abs(c - a) / 2 if a is not None and c is not None else None
        else:
            flow[t] = None
    peak_by_date: dict[date, float] = {}
    for t, f in flow.items():
        if f is not None:
            peak_by_date[t.date()] = max(peak_by_date.get(t.date(), 0.0), f)

    def next_turn_minutes(t: datetime) -> float | None:
        nxt = [e for e in tide_events if e["t"] > t]
        return (nxt[0]["t"] - t).total_seconds() / 60 if nxt else None

    # Sun times per date.
    sun: dict[date, tuple[datetime, datetime]] = {}
    for i, ds in enumerate(fc_d["time"]):
        d = date.fromisoformat(ds)
        sun[d] = (_parse_local(fc_d["sunrise"][i]), _parse_local(fc_d["sunset"][i]))

    hours: dict[datetime, dict] = {}
    for t in times:
        sr_ss = sun.get(t.date())
        lp = light_phase(t, *sr_ss) if sr_ss else None
        w = wind.get(t)
        wd = wind_dir.get(t)
        wind_kn = w * KMH_TO_KN if w is not None else None
        onshore = (
            wind_kn * math.cos(math.radians((wd - ONSHORE_BEARING)))
            if wind_kn is not None and wd is not None
            else None
        )
        f = flow.get(t)
        peak = peak_by_date.get(t.date())
        hours[t] = {
            "pressure": pressure.get(t),
            "wind_kn": round(wind_kn, 1) if wind_kn is not None else None,
            "wind_onshore_kn": round(onshore, 1) if onshore is not None else None,
            "swell_m": swell.get(t),
            "swell_period_s": swell_p.get(t),
            "sst_c": sst.get(t),
            "light_phase": lp,
            "tide_h": sea_level.get(t),
            "tide_speed": (f / peak) if (f is not None and peak) else None,
            "tide_mins_to_turn": next_turn_minutes(t) if tide_events else None,
        }

    # ---- day-level metrics -------------------------------------------------
    def rain_ending(at: datetime, hours_back: int) -> float | None:
        vals = [precip[t] for t in times if at - timedelta(hours=hours_back) <= t < at]
        vals = [v for v in vals if v is not None]
        return round(sum(vals), 1) if vals else None

    def pressure_at(target: datetime) -> float | None:
        candidates = [t for t in times if pressure.get(t) is not None]
        if not candidates:
            return None
        best = min(candidates, key=lambda t: abs((t - target).total_seconds()))
        return pressure[best] if abs((best - target).total_seconds()) <= 3 * 3600 else None

    days: list[dict] = []
    today = datetime.now(TZ).date()
    all_dates = sorted({t.date() for t in times if t.date() >= today})[:FORECAST_DAYS]
    for d in all_dates:
        anchor = datetime.combine(d, time(6), tzinfo=TZ)
        p_now, p_prev = pressure_at(anchor), pressure_at(anchor - timedelta(hours=24))
        trend = round(p_now - p_prev, 1) if (p_now is not None and p_prev is not None) else None
        _, illum, moon_name = moon_phase(datetime.combine(d, time(12), tzinfo=TZ))

        d_events = [e for e in tide_events if e["t"].date() == d]
        d_heights = [sea_level[t] for t in m_times if t.date() == d and sea_level.get(t) is not None]
        tide_range = round(max(d_heights) - min(d_heights), 2) if d_heights else None

        d_hours = [t for t in times if t.date() == d]
        d_swell = [swell[t] for t in d_hours if swell.get(t) is not None]
        d_period = [swell_p[t] for t in d_hours if swell_p.get(t) is not None]
        d_wind = [hours[t]["wind_kn"] for t in d_hours if hours[t]["wind_kn"] is not None]
        d_sst = [sst[t] for t in d_hours if sst.get(t) is not None]

        di = fc_d["time"].index(d.isoformat()) if d.isoformat() in fc_d["time"] else None
        rain_today = fc_d.get("precipitation_sum", [None] * 99)[di] if di is not None else None

        sr_ss = sun.get(d)
        days.append(
            {
                "date": d,
                "month": d.month,
                "sunrise": sr_ss[0] if sr_ss else None,
                "sunset": sr_ss[1] if sr_ss else None,
                "moon_illum": round(illum, 2),
                "moon_name": moon_name,
                "tide_range": tide_range,
                "tide_events": d_events,
                "rain_24h": rain_ending(anchor, 24),
                "rain_72h": rain_ending(anchor, 72),
                "rain_today": rain_today,
                "pressure_trend": trend,
                "pressure_day": round(sum(v for v in (pressure.get(t) for t in d_hours) if v is not None) / max(1, len([v for v in (pressure.get(t) for t in d_hours) if v is not None])), 1) if d_hours else None,
                "swell_max": round(max(d_swell), 1) if d_swell else None,
                "swell_period": round(sum(d_period) / len(d_period), 1) if d_period else None,
                "wind_max_kn": round(max(d_wind), 0) if d_wind else None,
                "sst_c": round(sum(d_sst) / len(d_sst), 1) if d_sst else None,
            }
        )

    return Normalized(hours=hours, days=days, tide_events=tide_events, warnings=warnings, source=bundle.get("source", "unknown"))


def validation_report(norm: Normalized) -> str:
    """A one-screen sanity report printed after every run."""
    lines = [f"source: {norm.source}", f"hour rows: {len(norm.hours)}", f"days scored: {len(norm.days)}", f"tide events: {len(norm.tide_events)}"]
    if norm.days:
        d0 = norm.days[0]
        present = [k for k, v in d0.items() if v is not None]
        missing = [k for k, v in d0.items() if v is None]
        lines.append(f"day0 fields present: {', '.join(present)}")
        if missing:
            lines.append(f"day0 fields MISSING: {', '.join(missing)}")
    for w in norm.warnings:
        lines.append(f"WARNING: {w}")
    return "\n".join(lines)


if __name__ == "__main__":
    n = normalize(build_sample())
    print(validation_report(n))
    print(json.dumps({str(k): v for k, v in list(n.hours.items())[:2]}, default=str, indent=2))
