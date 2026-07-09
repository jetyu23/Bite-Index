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
data/profiles/          the model — factors.json, environments.json, species.json
data/output/            daily score JSON (latest.json + dated history)
engine/                 Python: ingest.py (Open-Meteo), scoring.py, run.py, tests.py
web/                    Next.js static site (reads web/src/data/*.json, no runtime APIs)
.github/workflows/      daily cron: test → score → commit → Vercel redeploys
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

## First live run — verify before trusting (do this once)

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

Anything missing degrades to a neutral 50 with a visible warning — the site stays up, honestly.

## Deploy runbook (~15 minutes, $0)

1. Push this repo to GitHub (public repo keeps Actions free/unlimited).
2. Repo → Actions → enable workflows. Run **daily-score** once manually (`workflow_dispatch`) and
   check the validation checklist above in the run logs.
3. Vercel → New Project → import the repo:
   - **Root Directory: `web`** and enable "Include source files outside of the Root Directory"
     (Settings → General) — not strictly needed since all data is copied inside `web/src/data`,
     but harmless and future-proof.
   - Framework preset: Next.js. No env vars. Deploy.
4. Done. Each morning the Action commits fresh JSON; the push triggers a Vercel rebuild.

**Gotchas**
- GitHub disables cron workflows after ~60 days without repo activity. The daily bot commit itself
  counts as activity, but if the Action ever fails for 60 days it will stop — you'll get an email;
  re-enable with one click.
- Vercel Hobby and Open-Meteo's free tier are both **non-commercial** licences. Fine for a
  portfolio; revisit both if this ever earns money.

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

## Interview talking points (why this exists)

- Variable-weighting model: same inputs → 12 profiles → 12 defensible answers; demo the day where
  rock flags red at 15 while beach scores 66+ from the *same* swell number.
- Hard safety override vs weighted factor — a design decision about what must never be tradeable.
- Best-rolling-3h-window aggregation vs daily averages — why the aggregation choice is a modelling
  choice.
- Missing-data policy: neutral 50 + visible warning, never imputation dressed up as data.
- Single source of truth: the methodology page renders from the exact JSON the engine scores with.
