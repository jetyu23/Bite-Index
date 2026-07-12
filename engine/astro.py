"""Astronomy helpers — computed locally so the moon costs $0 and zero API calls.

Moon phase: days elapsed since a reference new moon (2000-01-06 18:14 UTC),
modulo the mean synodic month (29.530588853 days). Accurate to within a few
hours, which is far more precision than a 'low evidence' solunar factor needs.

Light phase: dawn / day / dusk / night buckets from sunrise/sunset times
(supplied by Open-Meteo's daily block, so no solar math needed here).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

SYNODIC_DAYS = 29.530588853
_REF_NEW_MOON = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)

PHASE_NAMES = [
    (0.0625, "New moon"),
    (0.1875, "Waxing crescent"),
    (0.3125, "First quarter"),
    (0.4375, "Waxing gibbous"),
    (0.5625, "Full moon"),
    (0.6875, "Waning gibbous"),
    (0.8125, "Last quarter"),
    (0.9375, "Waning crescent"),
    (1.0001, "New moon"),
]


def moon_phase(dt: datetime) -> tuple[float, float, str]:
    """Return (phase 0..1 where 0=new and 0.5=full, illuminated fraction 0..1, name)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    days = (dt - _REF_NEW_MOON).total_seconds() / 86400.0
    phase = (days % SYNODIC_DAYS) / SYNODIC_DAYS
    # Illuminated fraction from phase angle: 0 at new, 1 at full.
    import math

    illum = (1 - math.cos(2 * math.pi * phase)) / 2
    name = next(n for cutoff, n in PHASE_NAMES if phase < cutoff)
    return phase, illum, name


# Dawn/dusk buckets. Kept generous on purpose: the 'bite window' anglers mean
# by dawn/dusk is wider than astronomical twilight.
DAWN_BEFORE_MIN = 45
DAWN_AFTER_MIN = 60
DUSK_BEFORE_MIN = 60
DUSK_AFTER_MIN = 45


def light_phase(t: datetime, sunrise: datetime, sunset: datetime) -> str:
    if sunrise - timedelta(minutes=DAWN_BEFORE_MIN) <= t <= sunrise + timedelta(minutes=DAWN_AFTER_MIN):
        return "dawn"
    if sunset - timedelta(minutes=DUSK_BEFORE_MIN) <= t <= sunset + timedelta(minutes=DUSK_AFTER_MIN):
        return "dusk"
    if sunrise < t < sunset:
        return "day"
    return "night"
