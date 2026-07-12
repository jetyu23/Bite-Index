# Bite Index

A free, beginner-friendly Sydney fishing site: one daily headline, transparent 0–100 scores for five
fishing environments (rock, beach, estuary, harbour/wharf, boat/offshore), a ranked "best species to
target today" list, species rigging guides, a knot guide, and a methodology page that publishes every
weight in the model with a written justification.

**The portfolio piece is the scoring engine, not the UI**: a hand-set, fully explainable
variable-weighting model. The same forecast inputs run through 12 different weighting profiles
(5 environments + 7 species) and produce 12 different answers. No ML, nothing hidden — every score
expands into the factors that drove it.

## Repo layout

```
data/profiles/          the model: factors.json, environments.json, species.json (+ calibration.json once built)
data/output/            daily score JSON (latest.json + dated history)
engine/                 Python: ingest.py (Open-Meteo), scoring.py, run.py, tests.py
web/                    Next.js static site (reads web/src/data/*.json, no runtime APIs)
.github/workflows/      daily.yml (test → score → commit → deploy) + calibrate.yml (monthly percentile refresh)
design/                 the four HTML mockups behind the Field Survey direction
```

## Quickstart (local)

```bash
# 1. engine — offline demo run on deterministic sample data
pip install -r engine/requirements.txt
python engine/tests.py
python engine/run.py --sample     # or --live for a real Open-Meteo pull

# 2. site
cd web
npm install
npm run dev                        # http://localhost:3000
```

`run.py` writes `data/output/latest.json` and copies it (plus a combined `profiles.json`) into
`web/src/data/`, which is what the site builds from. The site is fully static — no API calls at
page load, ever.

## First live run: verify, then calibrate (do this once)

The ingestion was written against Open-Meteo's documented field names but this repo was built in an
offline environment, so the live API has not been hit from here. Your 5-minute job:

```bash
python engine/run.py --live
```

Then check the printed validation report:

- [ ] `source: open-meteo` and **no warnings** about missing fields
- [ ] tide events look sane vs any tide site (times within ~30 min, ~2 highs + 2 lows/day)
- [ ] swell/wind/SST magnitudes plausible for the day
- [ ] if a field warns as missing: check the two request URLs in `engine/ingest.py` against
      https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/marine-weather-api —
      it's almost certainly a renamed hourly variable. Fix the name in `HOURLY_*` constants.

Anything missing degrades to a neutral 50 with a visible warning; the site stays up, honestly.

Then build the percentile calibration (this is what makes "median day = 50" literally true):

```bash
python engine/calibrate.py --days 365
```

It scores a historical window with the same engine and stores each profile's raw-score
distribution in `data/profiles/calibration.json`; live scores are then reported as percentile
ranks. Marine history may only reach back ~90 days at first, which skews summer species until a
year accumulates; the calibration window is printed in the site footer, and the monthly
`calibrate` workflow refreshes it automatically. Until calibration exists, the recentred raw
scale is used and the footer says so.


## Costs

| Item | Cost |
|---|---|
| Open-Meteo (weather + marine + tides) | $0 — free non-commercial, no key, ~2 calls/day vs 10k/day limit |
| Sun/moon | $0 — computed locally |
| GitHub Actions | $0 — free for public repos |
| Vercel Hobby hosting | $0 — free subdomain (`*.vercel.app`) |
| Custom domain (optional) | ~AUD $15–25/yr, the only possible spend |

## Extending the model

- **New species** = one new object in `data/profiles/species.json` (factors + weights +
  justifications + guide content). No code changes; the species page, methodology page and daily
  ranking pick it up automatically. `python engine/tests.py` validates the profile shape.
- **Re-weighting** = edit the profile JSON. The methodology page renders from the same file, so the
  published justification and the running model can't drift apart.
- **v3 validation** (per the brief): log real sessions against published scores, test whether
  high-score days out-fish low-score days, adjust weights in the open with dated notes.

## Honest limitations

Tides are a global ocean model sampled near Sydney Harbour with parabola-refined extremes — good for
planning, **not official predictions, not for navigation**. Swell is one offshore grid point. Rain is
a turbidity proxy. Every weight is codified judgment, clearly labelled, pending v3 validation. Moon
factors are included at low weight and tagged LOW EVIDENCE on the site rather than hidden.

