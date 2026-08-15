# Bite Index — working notes for Claude

## Purpose

A free, transparent Sydney fishing conditions site. Python scoring engine + a
static Next.js site, deployed on Vercel, refreshed daily by GitHub Actions. The
portfolio point is the scoring engine: 17 hand-set, fully explainable weighted
profiles (5 environments + 12 species) score the same forecast inputs 17
different ways. No ML anywhere. Every weight, curve and gate carries a written
justification, and the methodology/glossary pages render straight from the
same profile JSON the engine scores against, so the published explanation and
the running model cannot drift apart.

## Architecture

```
data/profiles/*.json      the model: factors.json (shared metric defs + score_labels),
                           environments.json (5 grounds), species.json (7 species),
                           calibration.json (generated, percentile distributions)
engine/ingest.py           Open-Meteo pull (forecast + marine + archive) -> Normalized
engine/scoring.py          factor_subscore, score_profile_day, apply_safety, calibrate,
                           headline/reason text builders
engine/run.py               orchestrates a live/sample run, writes data/output/ +
                           web/src/data/
engine/calibrate.py         scores a historical window, writes calibration.json
engine/tests.py             test suite, runs on sample data, must pass before any commit
web/                        Next.js static site, reads web/src/data/*.json only
.github/workflows/          daily.yml (tests -> live score -> commit, must never break),
                           calibrate.yml (monthly, commits calibration.json)
```

Scoring model: a profile is a list of weighted factors. Each factor maps a
metric to a 0-100 subscore via a piecewise-linear curve, a category table, or
a month-indexed season array (`scoring.factor_subscore`). The profile score is
the weight-normalised mean of subscores, computed per hour across the
profile's configured window, and the day's score is currently the best
rolling 3-hour mean inside that window (`score_profile_day`) — this is under
active investigation, see Decision Log.

## Hard constraints (never break these)

- No machine learning. Every weight, curve, gate and threshold is hand-set
  with a written justification.
- No fabricated data, metrics or domain claims. Flag uncertainty in output
  rather than inventing a number.
- No em dashes anywhere in site copy or output (`test_no_em_dashes` in
  engine/tests.py checks the JSON output; copy in web/src is not covered by
  that test and must be checked by hand — `grep -rn "—\|&mdash;"`).
- $0/month running cost. No new paid services, ever.
- Never break `daily.yml`. It runs `engine/tests.py` on **sample data** before
  every live scoring run — anything that changes behaviour based on whether
  `calibration.json` exists on disk will run through that path, since
  calibrate.yml commits calibration.json to the repo.
- The rock safety override (hard cap on dangerous swell) is not up for
  redesign. It is a deliberate exception to "no factor is ever gated" —
  see Decision Log for why other gates are now allowed to exist alongside it.
- Verify by running code and reading real output. Never by assuming or by
  reasoning from memory of the curves. This has mattered concretely more than
  once this session (see Decision Log).

## Design decisions already made (context for future sessions)

1. **`ingest.normalize()` has a `historical` flag.** Without it, the function
   only builds day-level records for `today` onward, capped at
   `FORECAST_DAYS` — correct for a live run, but it silently produced zero
   days for any historical window, which is why `calibrate.py` never worked
   until this session. `historical=True` scores every date present in the
   fetched window instead.
2. **`calibrate.py`'s historical fetch is padded `PAST_DAYS` before the
   requested start**, then trimmed back after normalizing, so the first real
   calibration day still gets a full rain_72h / pressure_trend lookback
   instead of a truncated one.
3. **Calibration only applies to live runs, never sample runs.**
   `calibration.json` is an empirical distribution of real Sydney conditions;
   sample data is a scripted synthetic demo that was never part of that
   population. This also keeps `engine/tests.py` (which scores sample data)
   independent of whether `calibration.json` exists on disk — a real
   production hazard, since `daily.yml` runs tests before every live score
   and `calibrate.yml` commits `calibration.json` permanently.
4. **Raw score is the headline number everywhere; percentile is a secondary,
   separately-labelled line.** Tier labels (Poor/Fair/Good/Excellent) describe
   raw conditions and must never be computed from a percentile — that was a
   real bug this session: the moment calibration.json started existing, tier
   labels silently started being computed off a percentile without anyone
   deciding that on purpose.
5. **"Best ground"/"top species" selection stays percentile-based internally**
   even though the displayed number is raw. Raw scores aren't comparable
   across profiles with different curve-defined ceilings (boat's raw ceiling
   sits well above harbour's) — ranking by raw would just favour whichever
   profile runs hottest by design. This applies in `scoring.build_headline`,
   `WeekAhead.tsx`, and `page.tsx`'s ledger ordering. Species keep the
   calibrated, environment-blended value as `rank_score` in the JSON (not
   discarded, just not displayed as the headline) purely to order the "top
   targets" list fairly.
6. **A safety-flagged day suppresses percentile entirely**, not just caps the
   score. A capped, dangerous day isn't meaningfully "better or worse than X%
   of days" — showing a percentile next to an overridden score would be its
   own category error.
7. **Week strip shows two numbers**: "best ground" (max, unchanged) and
   "overall day" (median of the 5 grounds' raw scores, new). Median chosen
   over mean deliberately — it's always a real ground's actual score, not an
   invented average nobody's ground produced.
8. **Threshold tables (Poor/Fair/Good/Excellent) are hand-set from concrete
   angling scenarios computed through the real engine, never from the
   historical distribution's quantiles** — deriving them from quantiles would
   silently recreate the exact percentile-in-disguise problem raw/percentile
   separation was meant to fix. They are checked against the real 366-day
   distribution afterward as a sanity test only.
9. **Range compression was dominated by weighted-averaging across 8-11
   factors, not genuine Sydney weather stability**, compounded by the
   best-session search always finding *some* passable block, which is why a
   gate on an hourly-varying factor (tide_speed) was structurally inert. The
   root cause turned out to be one level deeper: tide_speed itself is
   normalised against that SAME DAY's own peak flow, so it never carried
   cross-day signal at all, gated or not. Fixed 2026-08-13 by gating on
   tide_range instead (a day-constant number, so it can't be routed around
   the way an hourly one can) plus a tide_speed reweight. See Decision Log.

## Decision log

Append entries here as work happens. Newest at the bottom. Each entry: what,
why, what was verified (not assumed), and what — if anything — was
deliberately left undone.

### 2026-08-12 — calibrate.py fix
`normalize()` filtered day-level records to `>= today`, capped at 7 — fine for
a live run, fatal for `calibrate.py`'s historical scoring, which is why it had
never produced output. Added `historical=True` mode. Verified: 366 days
scored, all 12 profiles, `engine/tests.py` passes, live run applies real
calibration for the first time ever. Also found and fixed a second bug this
exposed: `engine/tests.py` scoring sample data would have started running
through real percentile calibration the moment `calibration.json` existed on
disk (it never had before), breaking a safety-flag test in a way that would
have broken `daily.yml` in production. Fixed by gating calibration to
`live=True` only.

### 2026-08-12 — raw/percentile display split
Full-year audit (366 real days) showed raw stdev of 1.7-7.4 per profile
(21-54% of each profile's own curve-defined range used) versus calibrated
stdev of ~20-29 — confirming percentile display amplifies whatever raw signal
exists, including noise, and that tier labels were being computed off a
percentile the moment calibration started working, a category error nobody
decided on purpose. Split raw (headline) from percentile (secondary line,
suppressed on safety-flagged days). Verified end to end against a real
historical flagged day (2026-04-19, rock): score capped at 15, percentile
null, no raw value leaking anywhere in the payload, confirmed via the actual
rendered HTML, not just the JSON.

### 2026-08-12 — week strip: best ground + overall day
Week strip's `max(5 grounds)` headline sits at median 84 / mean 78.5 across
the real year (worst month, November, still averages 67.9) purely because
taking a max over 5 near-independent variables skews high regardless of
season or weather — independent of the scoring model entirely. Added
"overall day" (median of the 5 raw scores) as a second, smaller line so a
reader can tell "great everywhere" from "great at one spot only," without
removing the existing best-ground call-out.

### 2026-08-12 — threshold tables drafted, not shipped
Drafted 12 hand-set threshold tables from concrete angling scenarios (e.g.
rock: flat/slack/midday vs clean wash/dawn/running tide), computed through
`scoring.factor_subscore`, not from history. Sanity-checked against the real
366-day distribution: **8 of 12 profiles show 0% Poor across a full year**,
and beach/estuary/tailor's Excellent thresholds are literally unreachable
(higher than any real day this year produced). Diagnosis: this is not a
threshold-placement problem, it's that averaging 8-11 factors compresses both
tails of the raw range before any threshold is even chosen. Redrafting the
tables again would bend the numbers to fit the data — explicitly rejected.
Threshold work is blocked on fixing range compression first (see window
architecture entry below). **Tables not implemented; factors.json unchanged.**

### 2026-08-12 — gating investigation (report only, nothing implemented)
Simulated soft multiplicative gates (mirroring the rock safety override's
spirit, applied per-hour before the best-window search) on 5 candidates:
- **Estuary/harbour tide_speed: dead end at any gate strength.** The
  best-3-hour-window search already avoids slack tide via the ordinary
  weighted curve alone — checked directly: the selected best window overlaps
  a near-slack hour on only 3 of 366 real days. Tide cycles every ~12.4h;
  an 18-24h window always contains a moving-water block to route to instead.
  A gate on a within-day-cyclical factor cannot move a score the architecture
  is already routing around, regardless of gate strength. This is the finding
  that motivated the window-architecture work below.
- **Kingfish sst_c: works cleanly.** SST is ~day-constant, so there's no
  escape-hatch hour. Moderate gate (floor 0.4 below 16C, full by 19C): real
  min 49->38, stdev 7.4->8.5, hand-set Poor threshold (39) reachable on 1/366
  days without overcorrecting.
- **Boat wind_kn: works at a realistic threshold, not at the profile's own
  quoted 18-20kn** (only 8 of 8,856 real hours all year exceed 18kn). Flagged
  a real, pre-existing data caveat: `wind_kn` is Open-Meteo's *forecast*
  endpoint (`wind_speed_10m`, Sydney CBD land point) — the marine endpoint has
  no wind field at all. A land point is a known systematic underestimate of
  true offshore wind. Not fixable without a paid/different data source, so
  the constraint is to disclose it, not solve it (see priority 2 below).
- **Beach wind_onshore_kn: inconclusive.** Real onshore component never
  exceeded 13.7kn all year; even probing a threshold inside the observed
  range showed almost no effect (beach's 19h window gives the search too many
  hours to route around).

### 2026-08-13 — standing authority granted; CLAUDE.md created
User granted standing authority to investigate/implement/test/commit within
defined boundaries (see this file's header for the stop conditions) and asked
for this file to persist context between sessions. Working through the
priority list below; entries continue as work lands.

### 2026-08-13 — priority 1: kingfish SST gate implemented
Added a generic `gates` mechanism to `score_profile_day` (soft multiplicative,
applied per hour before the best-window search, so it isn't diluted the way a
weighted factor can be) and configured it for kingfish only: floor 0.4 below
16C, full strength by 19C. Verified against the real 366-day history via the
actual engine, not the standalone simulation: raw min 49->38, stdev 7.4->8.5,
hand-set Poor threshold (39) reachable on 1/366 days, no overcorrection.
`calibration.json` regenerated (kingfish's distribution changed; the other 11
profiles' medians are unchanged, confirming no cross-profile leakage).
Live-verified: today (winter, cold water) shows the gate active on all 7
forecast days with the expected disclosure text appended to the reason
string, and the methodology page renders the gate's justification the same
way it renders every weight. Committed as `27340f8`.

### 2026-08-13 — priority 2: wind data-source limitation disclosed
Added to the methodology page's "Honest limitations" section: wind for every
wind-scoring profile (rock, beach, estuary, harbour, boat) comes from
Open-Meteo's forecast-endpoint `wind_speed_10m` at the Sydney CBD land point;
the marine API has no wind field at all, so there's no offshore alternative
to switch to. A land point systematically understates offshore wind, which
matters most for boat/offshore (wind is its heaviest-weighted factor at 30%).
Disclosure, not a fix — no $0 offshore wind source exists to switch to.
Committed as `1df402b`.

### 2026-08-13 — priorities 3+4+5: fixed named sessions replace the rolling window
**The premise needs correcting first.** Priority 3 was framed as "the best-3-
hour-window search selects the least-bad block of each day, which is why
range is compressed." Simulated fixed sessions against the real 366-day
history before touching any code: best-of-named-sessions produces almost
identical stdev to the rolling window for every profile (e.g. rock 4.93 vs
4.92, boat 4.08 vs 4.42) — the rolling search rarely lands anywhere but a
named session's neighbourhood anyway. More importantly: **switching the
mechanism does not make Poor reachable.** Beach, estuary, harbour, bream and
mulloway still show 0% Poor under best-session AND under session-mean, using
the same thresholds drafted earlier. The search mechanism was never the
cause of range compression — that's still the averaging-8-11-factors effect
identified at the start of this work. This doesn't invalidate implementing
sessions (see below), but it means priority 6 (thresholds) is blocked on
something the window work doesn't fix, and that needs its own decision
before touching thresholds again.

**Implemented anyway, on independent merits.** A fixed named session ("dawn",
"dusk") is inspectable and disputable by a real angler in a way an
algorithmically-found "5:14am-8:14am" window isn't, and it's a precondition
for priority 5's mean-vs-best question to even be askable. Replaced
`window: [start, end]` with `sessions: [names]` per profile (defined once in
factors.json's `sessions` dict, 8 canonical 3-hour blocks) — chosen by
angling judgment against each profile's own existing justification text, not
mechanically:
- Most profiles kept a near-full dawn-through-evening set (their own text
  doesn't claim day-part exclusivity).
- **Tailor: dawn and dusk only**, nothing between -- its own text says
  "dawn and dusk appointments, almost to the minute," which a single
  contiguous window literally cannot represent. This is the clearest
  argument for sessions over window-narrowing alone.
- **Mulloway: dusk/evening/late_night only** -- "daytime mulloway are the
  exception, not the plan," per its own text. No dawn session.
- **Boat: dawn/morning/midday/afternoon only** -- its own text says the
  "afternoon sea breeze typically ends the day."
- **Kingfish: dawn/morning/midday/afternoon** -- its own text says kingfish
  "keep feeding through the day more than most inshore species," so unlike
  boat this keeps midday/afternoon on strong textual grounds, not just
  copied from boat's window.
This also completes priority 4 (window audit) -- narrowing wasn't a separate
step from choosing sessions; a profile's window is now just the union of its
chosen sessions, so justifying the sessions justified the boundaries in the
same motion. Beach's old `[4,23]` (4am-11pm, the complaint that started this)
is now `dawn, morning, midday, afternoon, dusk, evening` -- 5am-11pm,
narrower and named.

**Priority 5: both numbers shown, not a single decision between them.**
`score_profile_day` now returns both `score` (best session's mean, the
existing headline meaning: "when should I go") and `session_mean` (mean
across all the profile's sessions: "is today worth going at all"). Both are
raw-scale, both safety-capped when flagged. Displayed as "typical session
today: N" under the existing headline, same secondary-line treatment as
percentile. Chose to show both rather than pick one, same pattern as
raw+percentile and best-ground+overall-day earlier in this project: never
remove information, add clearly-labelled context instead.

**Safety override**: unchanged in behaviour, per instruction. Only the source
of "every hour the profile is scored over" changed (union of sessions
instead of a continuous window) -- same thresholds, same cap, same flag
condition, verified via the existing sample-data safety tests, which still
pass unmodified.

Verified: `engine/tests.py` passes with zero test changes needed (including
the safety-flag and mulloway-is-late tests), `tsc --noEmit` and `next build`
clean, real 366-day history re-verified against the actual implemented code
(not just the simulation) -- session usage per profile looks angling-sane
(mulloway: late_night 169 days, evening 183, dusk only 14; kingfish: dawn
173 but morning+midday+afternoon combined 193, confirming the "feeds all
day" text was right to keep those sessions). calibration.json regenerated
for all 12 profiles (one fetch attempt hit a transient Open-Meteo marine
timeout and silently fell back to a 92-day window with several fields
missing -- caught by checking the printed warnings before using it, retried,
second attempt was clean with no warnings and full-year marine coverage).
Live run and rendered HTML both confirm sessions and typical-session numbers
display correctly, including tailor's dawn/dusk-only case and mulloway's
after-dark-only case on the actual methodology page.

**Not yet done: priority 6.** Thresholds are still blocked, now on a
different problem than originally framed. Reporting back rather than
proceeding blind.

### 2026-08-13 — straight percentile replaced with a pooled, hand-set rescale
Confirmed live, from real current data: rock raw 74 (percentile 98) vs boat
raw 69 (percentile 25) -- a 5-point raw gap producing a 73-point percentile
gap. Straight empirical percentile is uniform in RANK space by definition (1%
of days = 1 percentile point everywhere), which means its slope against RAW
score is steep exactly where the historical distribution is dense (the
narrow middle every profile clusters in) -- amplifying small raw differences
into large rank swings, worse for two DIFFERENT profiles being compared than
within one.

**Simulated per-profile vs global anchors, and a blend spectrum between
them, before implementing.** They trade off, not reconcilable:
- Per-profile anchors (each profile's own p10/p90 mapped to 40/70): nails
  "ordinary lands at 40-70" for every profile by construction, but rock/boat
  today showed a 30-point display gap for a 5-point raw gap -- reproduces
  the bug, because boat's raw distribution sits ~5-6 points above rock's,
  and per-profile anchoring absorbs that whole difference into where each
  profile's own "ordinary" sits.
- Global anchors (pooled across all 12 profiles): the general rule (1-2
  point raw gap -> a few points display gap) passes cleanly, verified at
  ~2.0-2.3 display points per raw point, consistent across rock, boat,
  kingfish, tailor. Today's specific 5-point rock/boat gap shows 10.6-11
  points -- proportionally consistent with that slope (a real 85% reduction
  from straight percentile's 73 points), just not literally "a few" for a
  gap that large. Costs real accuracy for 3 profiles whose raw distributions
  sit off the pooled center: boat (58% of its own ordinary days read above
  70), kingfish (both tails elevated, partly the new SST gate), tailor
  (36% below 40, after the dawn/dusk-only session restriction).
- Blend ratios in between move monotonically along this same trade-off --
  no ratio satisfies both well. This is structural (different profiles have
  different raw medians, by construction of their own curves/weights), not
  a tuning problem.

**Chose global anchors.** Best serves the actual complaint (cross-profile
comparability was the whole point), one simple shared curve instead of
twelve, and the 3 divergent profiles are individually explainable rather
than a systemic failure. Implemented:
- `scoring.rescale_anchors()` + `scoring.robust_percentile()`: compute
  min/p1/p10/p90/p99/max of the POOLED raw scores across all 12 profiles.
  `calibrate.py` writes these into `calibration.json` as `rescale_anchors`.
- `scoring.rescale(calib, raw)`: piecewise-linear through 6 hand-set
  anchor->target pairs (min->5, p1->20, p10->40, p90->70, p99->80, max->95).
  Falls back to raw when no calibration exists, same pattern as the old
  `calibrate()`. `calibrate()` itself is unchanged and kept as a primitive
  (still a correct, useful percentile-rank function -- just not the right
  one for a display two cards get compared on).
- Replaced all three call sites (env display, species display, the internal
  `cal` lambda that feeds species/environment blending) with `rescale()`.
  This also fixes "best ground"/"top species" ranking, which had the exact
  same amplification bug silently affecting which ground got the BEST TODAY
  stamp -- `build_headline`'s ranking key, `WeekAhead.tsx`'s `rank()`, and
  `page.tsx`'s `bestId` selection all switched from `percentile` to
  `calibrated` together, for one consistent cross-profile metric everywhere.
- Field renamed `percentile` -> `calibrated` throughout (JSON output, types,
  components, copy) -- calling it "percentile" when it's a hand-set rescale,
  not a literal percentage, would have been its own honesty problem.

Verified: real live data now shows rock raw 74 -> calibrated 76, boat raw 69
-> calibrated 65 (11-point gap, matching the simulation's predicted ~10.6).
Face validity (boat, 4kn wind/1.0m swell/dusk/settled pressure): raw 70.4,
tier label "Good" under the unchanged thresholds (never actually at risk of
showing Poor), rescaled display 68.7 -- reads as solidly decent, not
alarming. Spot-checked 10 more real boat days spread across the year, all
"Good," nothing disputable. Monotonicity verified programmatically. New unit
test (`test_rescale`) added alongside the existing `test_calibration`.
`engine/tests.py` passes, `tsc --noEmit` and `next build` clean, rendered
HTML confirms the calibrated numbers and updated methodology copy.

**Continuing to the species work next**, per instruction.

### 2026-08-13 — priority 6: thresholds set against the calibrated distribution
Unblocked once the rescale existed: thresholds now judge `calibrated`, not
raw. Simulated 7 candidate sets against the real 366-day calibrated
distribution for all 12 profiles; picked Poor<32/Fair<48/Good<62/
Excellent>=62 -- every profile reaches >=3 of 4 tiers, no profile exceeds 85%
concentration (rounder candidates pushed some profile to 91-95%).
`build_headline`'s separately-hardcoded phrasing thresholds (a third copy of
roughly the same numbers, found while touching this) moved to the same
value and the same 62/48/32 boundaries.

Two residual findings, reported rather than smoothed over:
- Harbour, bream, yakkas, mulloway never reach Poor -- their raw variance is
  genuinely low (model-level, already logged above), not a threshold defect.
- **Boat shows Excellent on 82% of real days** (8/8 in an 8-day spot check).
  Its raw distribution runs structurally higher than the pooled average that
  anchors the shared calibrated scale. Not fixed -- the only fix is
  per-profile thresholds, which undoes the entire point of a shared scale
  (see the rescale entry above for why per-profile was rejected there too).
  This is the same underlying elevation already flagged when the rescale
  anchors were chosen; priority-6 work just makes the consequence visible
  in the tier label instead of only the calibrated number.

Live-verified: today's ledger shows real label diversity across grounds for
the first time (Rock Excellent, Beach Good, Estuary Good, Harbour Excellent,
Boat Excellent) instead of five identical "Good" labels. Committed as
`451d886`.

### 2026-08-13 — species backlog clarified (priorities 11-13)
User confirmed "the species work" meant a backlog never formally logged in
this file: (11) research and add 4+ new species profiles (Australian salmon,
dusky flathead, luderick, sand whiting, plus any other justified additions)
with sourced citations distinguished from general knowledge; (12) fixed,
non-scoring card metadata (eating quality, difficulty) -- explicitly not
engine inputs; (13) search/sort/filter on the species page, static build, no
new dependencies. Also asked whether new species widen the existing
clustering (6 of 7 current species sit raw 64-69, displaying calibrated
54-65; kingfish separates only via its SST gate) or land in the same band --
to be checked and reported once the new profiles are scored, not assumed.
Starting on 11 now.

### 2026-08-13 — priorities 11-13: five new species, card metadata, explorer UI
**Priority 11.** Added salmon, flathead, luderick, whiting, snapper (Australian
salmon, dusky flathead, luderick/blackfish, sand whiting, snapper) via real
WebSearch research, not memory. Every factor justification is tagged SOURCED
(with the finding attributed) or GENERAL KNOWLEDGE (explicitly flagged as
inferred/analogous, not found in the search done). Full citations given to the
user for fact-check before this ships; not assumed clean. One explicit
uncertainty flagged in-profile: snapper's reported winter harbour movement was
weaker-sourced (a charter-operator blog) than its spring/autumn reef pattern
(multiple sources, consistent) -- both included, but the profile's own
season_notes says so.

**The clustering check the user asked for, answered with real data, not
assumed.** Regenerated calibration.json with all 17 profiles across the real
366-day history: salmon (median 62), flathead (66), luderick (63), whiting
(64), snapper (63) -- every one lands in the exact same 60-66 raw-median band
the original six non-gated species already occupied (mulloway 66, bream 64,
tailor 60, trevally 61, squid 66, yakkas 66). Stdev for the new five (2.5-4.1)
is squarely inside the existing 1.7-5.7 range too. **They do not widen the
spread. All 17 profiles cluster except kingfish, which separates only because
of its SST gate.** This is worth flagging plainly, as asked: a sort-by-score
feature on the species page will mostly reorder a tightly-packed group of 16,
not meaningfully differentiate them, on most days.

**Priority 12.** Added an `attributes` block (difficulty, eating_quality,
both 1-5, plus a short note each) to all 12 species -- explicitly never read
by the scoring engine. Added a real regression test (`test_attributes_dont_score`)
that mutates attributes in memory and confirms the raw score doesn't move,
rather than trusting the schema separation to hold by convention.

**Priority 13.** Extracted the species grid into a new client component
(`SpeciesExplorer.tsx`) with search (name/tag), sort (today's score / eating
quality / difficulty), filter (by ground, by in-season-now using each
profile's own season array), all client-side React state over the existing
static export -- no new dependency, no server round trip.

**A real bug found and fixed while verifying, not assumed correct.** Curled
the live rendered homepage to sanity-check the new UI and found score=66
rendering with tier-class "excellent" (blue) next to label text "GOOD" --
a live, shipped inconsistency. Root cause: `web/src/lib/data.ts`'s `tier()`
still hardcoded 80/60/40 (a THIRD independent copy of the thresholds,
missed when priority 6 moved `score_labels` to 62/48/32), AND every
frontend call site (`EnvRow`, `ContactList`, `WeekAhead`, the new
`SpeciesExplorer`) was passing raw score into `tier()` for the colour class
while the server had already computed the label TEXT from `calibrated` --
so even after fixing the threshold values, colour and text could still
disagree because they were reading different numbers entirely. Fixed both:
`tier()` now reads `profiles.factors.score_labels` directly (one source of
truth, can't drift again), and every call site passes `calibrated ?? score`,
matching exactly what the server used for the label. Re-verified against
live rendered HTML: zero mismatches across the homepage ledger, week strip,
contact list and species page.

Verified: `engine/tests.py` passes (56 checks including the new attribute
guard), `tsc --noEmit` and `next build` clean, dev server curl-tested for
control presence, correct rating dots per species, and the colour/text fix
specifically. Not committed/pushed yet -- holding for the citation
fact-check the user explicitly asked for on the new species content.

### 2026-08-13 -- decisive test: the model didn't discriminate; root cause found
User asked for a decisive test before touching anything: pull the genuinely
extreme days from the real 366-day archive by INPUT (not by score) and show
whether the model actually separates good conditions from bad. It didn't.
Every environment sat raw 45-79 (13-31 point real span per profile) and
every species clustered in the same raw 60-66 median band already flagged in
the species-backlog entry above, kingfish the only exception (its SST gate).
A terrible day and a great day routinely landed within a few raw points of
each other.

Diagnosed with real code against real data, not reasoning from memory (per
this file's own hard constraint): built a per-factor diagnostic that compares
each factor's REAL observed subscore range across all 366 days against its
own curve's theoretical floor/ceiling. Found `tide_speed` -- computed in
`ingest.py` as `flow / peak_by_date[that_day]`, i.e. that day's flow
normalised against THAT SAME DAY's own peak flow -- reaches its own
theoretical floor **zero times** across all 366 days, in **all 16 profiles**
that use it. This is not "weighted too low" or "curve too flat": the metric
is defined in a way that structurally cannot carry cross-day signal, because
every day is normalised against itself. `tide_range` (absolute tidal
magnitude, a real day-constant number) reaches its own floor 92-102% of the
time in the same diagnostic -- it works fine -- but was weighted 1.25x-2.2x
lower than the broken `tide_speed` in every profile that has both. A first
fix attempt (cut tide_speed to 35% of its weight, move the rest to
tide_range) was simulated and found real but insufficient: +4% to +15%
relative stdev, and the deadest real neap tide of the year still mostly read
"Good," not "Poor."

User set five numeric acceptance criteria, simulated against the full
366-day archive before touching anything, and said explicitly not to stop
at the first proposal: (1) every profile's raw span >= 45 points, (2) named
real extreme days must separate clearly (4.0m swell vs 0.3m glass-out for
rock AND boat; 111mm rain vs a dry run for estuary), (3) every tier reachable
and none near-universal, Poor must occur, (4) ten real days spot-checked for
face validity, (5) two near-identical-input profiles must still score
near-identically (the earlier rescale fix must not be undone).

**Root cause, and why gating tide_speed itself never worked.** The
best-session search already routes around a single bad hour on all but 3 of
366 real days (this was checked directly during the earlier gating
investigation) -- an 18-29h scored window almost always contains at least
one moving-water block to route to, so a gate on an HOURLY-varying factor
cannot move a score the architecture is already routing around, at any gate
strength. `tide_range` doesn't have this problem: it is a single day-level
number, identical at every hour of the same day, so a gate on it applies
uniformly across every session and cannot be dodged by picking a different
one -- the exact property that already makes the kingfish `sst_c` gate work.
This was the missing piece: the fix isn't a stronger version of the thing
already tried, it's gating the RIGHT metric.

**Implemented, iterating through several rounds of full-year simulation
before touching the repo (per instruction):**
- `tide_speed` cut to 25% of its prior weight in all 16 profiles that use
  it (down from the already-tested-insufficient 35%). It still has real,
  narrower value: telling a profile which of ITS OWN named sessions is
  best on a given day, since it does vary meaningfully hour to hour. What
  it never had was cross-day signal, and that job now belongs to the gate
  below. Freed weight moved to `tide_range` (or, for the two profiles with
  no `tide_range` factor, redistributed per-profile, see below).
- New day-constant gate on `tide_range`, modelled directly on the kingfish
  `sst_c` gate, added to every profile that has a `tide_range` factor (14
  of 17). Two tiers, strength derived from each profile's OWN pre-existing
  tide_speed weight (a judgement the original author already made about how
  tide-dependent that ground/species is) rather than a new arbitrary dial:
  tide-dominant profiles (original tide_speed weight >= 16: estuary,
  harbour, flathead, bream, whiting, trevally) floor to 30% of the hour's
  score on a genuine dead neap; tide-secondary profiles floor to 40%.
  Breakpoints anchored on the real observed tide_range distribution this
  year (min 0.68m, p10 0.94m, median 1.22m): full strength restored by 1.3m.
- `tide_range`'s own contributing curve extended with a real point at 0.6m,
  at half the previous floor value, in every profile that has it. The old
  curve clamped flat below 0.8m, so this year's actual deadest neap (0.68m)
  scored identically to a merely-marginal 0.80m day; the curve can now
  express "worse than the old floor" on top of the new gate.
- `boat`: wind_kn cut 30->22, swell_m raised 20->28. Not a curve reshape --
  the wind curve is untouched -- a reweight away from a factor that a
  full-year diagnostic shows almost never reaches its own floor (the
  already-disclosed land-point data limitation) toward one that discriminates
  cleanly (swell_m, measured, not a land proxy, 86% of its own range used).
- `yakkas`: same wind_kn cut (12->6, to tide_range), plus `moon_illum` cut
  to zero (already flagged low-evidence everywhere; no stronger case for a
  lunar effect on a livebait species than on any target gamefish, so it was
  pure dilution once tide_range needed the room).
- `salmon`, `snapper`: the only two profiles with no `tide_range` factor at
  all, so the fix above never touched them. Added `tide_range` fresh to
  both (same curve shape and gate mechanism as everywhere else), funded by
  a modest wind-weight cut, justified the same way as every other tide-aware
  profile in this model: a genuinely dead tide holds fish down for the whole
  day, not just around the moment each species' own existing tide-timing
  signal (tide_speed for salmon, tide_mins_to_turn -- "fish the turn" -- for
  snapper) measures.
- `estuary`: the freed tide_speed weight was NOT all handed to tide_range.
  Doing that in an earlier round left tide_range (26%) outweighing rain_72h
  (16%), even though rain_72h is this profile's own named "signature
  factor." Split the freed weight instead, reinforcing rain_72h enough to
  keep it the single heaviest factor, matching what the profile's own text
  already claims.

**Verified against the real 366-day archive, all five criteria, with real
numbers -- 16 of 17 profiles clear every one:**
- Span: rock 51, beach 50, estuary 54, harbour 54, mulloway 52, kingfish 53,
  bream 51, tailor 52, trevally 53, squid 48, yakkas 45, salmon 49,
  flathead 53, luderick 51, whiting 50, snapper 47 (all >= 45). `boat`: 33.
  Not met, see below.
- Extreme days: rock's real 4.0m-swell day (2026-03-28) scores 15 (Poor,
  safety-capped) against the 0.3m glass-out's 59 (Good) -- a 44-point gap.
  boat scores 51 (Good) against the glass-out's 75 (Excellent) -- a
  24-point gap and a full tier change, real but not as dramatic as rock's
  hard safety cap, which boat has no equivalent of by design. Estuary's
  named 111mm-rain-day vs the driest run of the year narrowed to a 2-point
  gap after the estuary rebalance above -- see the honest finding below.
- Tiers: all 16 passing profiles reach Poor/Fair/Good/Excellent, none over
  53% concentrated in one tier.
- Face validity: ten real days spot-checked across the year (a windy,
  42mm-rain, dead-neap day in December reads Fair/Fair/Fair/Fair across
  rock/beach/estuary/harbour while boat independently reads Excellent --
  checked against the actual hourly data and confirmed correct, not a bug:
  that day's wind peaked at 19kn at 9pm, hours after boat's own dawn-
  afternoon sessions, which stayed under 8kn all day). No disputable label
  found.
- Cross-profile consistency: bream and whiting, sampled on days where their
  raw scores land within 2 points of each other, show a mean calibrated gap
  of 1.02 (max 2.14) across 18 real sample days -- the earlier rescale fix
  (rock vs boat's old 73-point gap on a 5-point raw difference) is intact.

**Two honest, evidence-backed shortfalls, reported rather than forced:**
- **`boat` does not reach a 45-point span (33 achieved).** Simulated the
  most defensible concentration possible -- all weight on wind_kn and
  swell_m alone, nothing else -- and even that only reached 46, barely
  over the line, by deleting sea-surface temperature, light phase and
  pressure entirely, each of which has its own real angling justification
  already on this page. Realistic concentration (trimming, not deleting)
  capped out around 36-39. This is real weather covariance, not a fixable
  weighting problem: Sydney's worst offshore wind and worst offshore swell
  this year rarely landed on the same real calendar day. Disclosed on the
  methodology page rather than closed by gutting justified factors or
  reshaping the already-disclosed-as-limited wind curve.
- **Estuary's named 111mm-rain-day vs dry-day comparison narrowed to 2
  points**, even though rain_72h's OWN isolated contribution to the score
  roughly doubled (a controlled, similar-tide/similar-wind pair from the
  real archive, 2025-08-23 vs 2025-10-06, still only showed a few points'
  difference). The two named calendar days happen to also differ in tide,
  which moved in rain's favour on one day and against it on the other --
  real Sydney weather correlating with itself, not the model failing to
  register the rain. Pushing rain_72h's weight further to force a bigger
  gap on these two specific days was tested and rejected: it stopped
  helping past ~30% weight and would have meant tuning the model to fit a
  particular pair of days rather than fixing anything general, which is
  exactly what the user's instructions ruled out.

Regenerated `calibration.json` (clean fetch, full-year marine coverage, no
warnings) and ran a live score: today's ledger and the coming week both show
the gate firing correctly, with the differentiated dominant/secondary
wording ("dead neap tide is holding the whole day back" vs "a small tide is
taking the edge off today") appearing in the actual reason text on a
forecast day where tide_range drops toward neap later in the week.
`engine/tests.py` passes unmodified, `tsc --noEmit` and `next build` clean.
Methodology page updated to disclose both shortfalls above and the boat
wind-reweight; gate justifications render automatically per profile (no
code change needed, confirmed via the actual rendered HTML). Committed as
`cef4beb`, pushed.

### 2026-08-14 -- bug 7 (tier thresholds stale) and bug 6 (card overflow)
User reported every environment card rendering identical blue with an
identical EXCELLENT label right after the tide_speed fix landed. Root cause
verified, not assumed: the fix widened every profile's raw and calibrated
distribution, so the old 62/48/32 cuts (set against the pre-fix
distribution) became trivially easy to clear -- a genuinely good week
really could read Excellent across all 5 environments at once, which is
what happened. Re-simulated thresholds against the regenerated
`calibration.json` and picked 67/53/36/0 (all 16 non-boat profiles reach
every tier, worst concentration 65%). Also found and fixed a real third
hardcoded copy of the threshold values while checking for one as
instructed: `build_headline()`'s phrasing logic claimed to "mirror
score_labels" but was a literal copy; it now reads `score_labels` directly
via a `labels` parameter threaded through from `run.py`, so a future
re-derivation can't leave it silently out of sync again.

Bug 6 (the reported `.pctl` text overflow) turned out to be three stacked
issues, each found by actually rendering the page with Playwright at
1280/760/375px rather than reasoning about the CSS: (1) `.pctl` had
`white-space: nowrap`, the literal reported bug; (2) fixing that exposed
the row itself overflowing its own card at 375px, from CSS Grid's default
`min-width: auto` refusing to shrink the `1fr` track below its content's
min-content size (added `.row > * { min-width: 0 }`); (3) fixing that
exposed `.win` ("best: dawn, 5am-8am") still forcing width via its own
nowrap. Verified overflow-free on both the homepage and species page at all
three widths with a real headless-browser check. Committed as `d6427e9`,
regenerated data committed as `1ee7acc`, both pushed.

### 2026-08-14 -- display rescale widened, made per-profile
User: widen the rescale's output range so 90+ lands roughly once a month
and 80+ a few times a month per profile, keep the compress-middle/expand-
tails shape, keep Poor in the 5-12% band, verify two similar profiles
still display near-identically, then decide per-profile vs global anchors
and justify it, then reset tier cuts, then check whether boat still shows
a broken distribution against the new scale.

Simulated several output-target candidates against the real 366-day
`calibration.json` distributions before implementing. The literal
frequency asks (roughly-once-a-month 90+, roughly-a-few-times-a-month 80+)
turned out to need the p90-p99 anchor segment's target pushed most of the
way to 100 (p99->~93, max->100), not just a uniform stretch of the old
[5,20,40,70,80,95] targets -- because p99 and max sit only 1-2 raw points
apart for most profiles (the same compressed-top-end finding from the
2026-08-13 diagnostic), so any target split between them only ever covers
about 1% of days no matter where it's set; the frequency has to come from
the wider p90-p99 segment instead. Landed on
`RESCALE_DISPLAY_TARGETS = [1, 12, 40, 70, 93, 100]`: verified 90+ lands
4-16 times/year per profile, 80+ lands 9-36 times/year, and the 40-70
"ordinary" band is unchanged at 78-85% of days (p10/p90 targets didn't
move).

**Per-profile, not pooled -- made the call, with a real tradeoff, not a
free upgrade.** The literal frequency asks are inherently per-profile
statements ("once a month FOR THIS GROUND"), which pooled anchors can't
satisfy consistently: a profile whose raw distribution sits persistently
above or below the pooled center (boat, chronically) would still show a
skewed tier distribution no matter how the pooled targets were set, which
is exactly the "all Excellent" bug from earlier that day. Every curve,
weight, session and gate in this engine is already hand-set per profile;
the display rescale being the one pooled exception was flagged by the user
as an implementation accident, not a considered design choice, and
re-examining it agreed. The cost: the original reason pooled anchors were
chosen (rock vs boat, a 5-point raw gap reading 73 rank-points apart under
straight percentile) is a cross-profile comparison problem, and per-profile
anchors reopen it for the DISPLAYED number specifically -- an 85 on rock
and an 85 on boat are no longer claiming the same absolute quality.
Resolved by not collapsing display and ranking into one number any more:
`rescale()` (pooled anchors, unchanged targets) is now used ONLY internally
for cross-profile ranking (`build_headline`'s "best ground", species
environment-blend selection, "top targets" ordering) via a new `rank_score`
field on both environments and species output; `rescale_display()`
(per-profile anchors, new wider targets) produces the `calibrated` field
actually shown to a reader. Frontend (`WeekAhead.tsx`'s `rank()`,
`page.tsx`'s `bestId` selection) and `build_headline`'s sort key switched
to `rank_score`; tier-label phrasing and colour (`tier()` everywhere, plus
`build_headline`'s "firing today" wording) stayed on `calibrated`, since
that's the number printed next to them. Verified live: today's rock
(raw 73) showed calibrated 91 / rank_score 77 -- rare for rock specifically
versus solid-but-not-exceptional pooled against everyone -- and boat
(raw 69, boat's own median is 72) showed calibrated 55 ("Fair", genuinely
below par for boat) / rank_score 71 (still comparably decent), which is
exactly the intended split working as designed, not a bug.

Disclosed the tradeoff plainly, as instructed: methodology page states
that an 85 on two different profiles now means equally rare for each, not
equally good in absolute terms, and that absolute cross-profile comparison
still exists (`rank_score`) but isn't what's displayed. Glossary's
"Calibrated line" entry updated to match.

**Tier cuts re-derived against the new per-profile distribution**: 0/40/58/80
(Poor/Fair/Good/Excellent), chosen so Excellent lands exactly at the
requested 80+, Poor sits 8-10% (inside the 5-12% band), worst single-tier
concentration 59% (kingfish, Fair).

**Checked whether boat still needs its own tier cuts, as instructed: no.**
Every one of the 17 profiles, including boat, now reaches all 4 tiers under
ONE shared cut set -- boat's chronic "never reaches Poor, always
Excellent" problem was a direct consequence of pooled anchors comparing
its persistently-high raw distribution against everyone else's; per-profile
anchors normalise that at the source, so the boat-specific-thresholds
contingency the user asked me to fall back to turned out not to be needed.

Verified: bream/whiting (similar underlying distributions) sampled where
their raw scores land within 2 points show a mean calibrated gap of 1.41
(max 7.67, one outlier near a tier-adjacent anchor point) across 29 real
sample days -- tighter than the original 73-point bug by two orders of
magnitude, though the max is a bit looser than the pooled version's 2.14,
an honest cost of the per-profile switch worth naming rather than
smoothing over. `engine/tests.py` passes, `tsc --noEmit` and `next build`
clean, live run and rendered HTML confirm calibrated/rank_score/label are
all internally consistent (caught and fixed one build-ordering mistake
during verification: had built the static site before regenerating live
data, so the first rendered check was against stale JSON baked in at build
time, not a scoring bug).

### 2026-08-14 -- boat wind data researched (not implemented), bug 8 (species cards)
User asked whether Open-Meteo exposes a better free wind source for boat,
given wind carries 22% of that profile's weight and reads from a Sydney CBD
land point. Researched and verified directly, not from memory: the marine
API has no wind field at all (already known); the existing "marine" lat/lon
(2km off the Heads) turned out to resolve to the exact same coarse grid
cell as the CBD point (~20-25km model resolution near Sydney), so it
returns identical wind, a dead end. A point ~10nm (18km) further offshore,
matching where the profile's own text says boat fishing happens ("reefs,
FADs and open water"), resolves to a genuinely different grid cell:
verified across the real 366-day archive, CBD mean 6.1kn/max 19.9kn vs
offshore mean 12.5kn/max 36.2kn, roughly double. Re-scored boat's actual
profile substituting this offshore wind for the land-point reading: span
goes from 33 to 40-41, a real improvement from better data, still short of
45. Cost: $0, same free endpoint, one more coordinate. Not implemented,
per instruction -- reported with numbers for a future session to act on.
Also noted: altitude wind (80m/120m/180m) is available and reads much
higher (not land/water-resolution-limited) but would need a boundary-layer
correction to estimate an actual 10m-over-water value, which starts
crossing into the "don't fabricate precision from a data limitation" line
already drawn for this profile -- flagged, not pursued.

Bug 8: species cards collapsed to name, one-line descriptor (reused
`attributes.difficulty_note` -- already existed, already had the right
voice, no new field needed), today's score, ground, eating/difficulty
dots, with bait/rig/season/habitat/lures/line/knots/rig-diagram moved
behind the existing `why-details` expander pattern. Page changed from a
2-up card grid to a single-column row list (`.species-grid` now flex-
column, `.sp-row` styled like the environment ledger's `.row` for visual
consistency) per instruction that it didn't need to stay 2-across.

Added 12 original hand-drawn fish silhouettes (`FishSilhouette.tsx`), same
INK/TEAL/SOFT line-art palette and viewBox convention as `RigDiagram.tsx`.
First pass used subtle proportion differences between species and, once
actually rendered, looked like near-identical grey blobs at the ~90px card
size -- caught by looking at the real screenshot, not by trusting the code.
Redrawn with one or two exaggerated, real identifying features per species
instead of subtle ones: flathead's flat head silhouette, bream's spiked
dorsal, snapper's forehead hump, trevally's blunt vertical face, luderick's
smooth round profile with no spikes, yakkas' dark shoulder spot (a real
field mark), squid's tapered mantle and spread tentacles instead of a fish
tail. Verified by rendering the actual page (not just reading the SVG
source) at 1280/760/375px: no overflow, and the second pass is genuinely
distinguishable card-to-card where the first wasn't. `engine/tests.py`
passes, `tsc --noEmit` and `next build` clean, search/sort/ground-filter
functionally re-tested together (ground filter + text search both narrow
the same list correctly) after the markup rewrite.

### 2026-08-15 -- species page copy, rarity attribute, sort direction
Removed the dev-facing "a new fish is one config file" line from both the
species page and the homepage's contact-list section (same phrase, same
problem, both reader-facing pages).

Renamed "Eating" to "Tastiness" throughout the species page (sort control,
per-row rating label); `eating_quality`/`eating_note` kept as the internal
field names since nothing reads them as a label.

Added `rarity` (1-5) as a new non-scoring species attribute, distinct from
`difficulty`: difficulty is how hard the fish is to land once found,
rarity is how often you encounter one at all. Hand-set for all 12 species
against real angling knowledge (bream/yakkas/flathead common; mulloway
genuinely uncommon; kingfish/salmon reliable only in their season, closer
to absent outside it -- salmon explicitly common-but-seasonal rather than
uncommon, per the distinction the user drew). Guarded the same way as
difficulty/eating_quality: `test_profiles_valid` checks the 1-5 range and
a written note, `test_attributes_dont_score` mutates it in memory and
confirms the raw score doesn't move.

Sort controls reworked to have an explicit direction per field rather than
one hardcoded default: clicking an inactive field switches to it at that
field's own default direction (score/tastiness default high-to-low,
difficulty/rarity default low-to-high, since both read "low" as
approachable); clicking the already-active field flips direction. Current
direction shown inline on the active chip ("Rarity ^ low-high").
Verified live: default rarity sort (ascending) puts Bream first, clicking
again reverses to Mulloway first, matching the hand-set values.

`engine/tests.py` passes, `tsc --noEmit` and `next build` clean, live run
regenerated (attributes are non-scoring, so no score changed).

### 2026-08-15 -- "overall day" promoted above the ledger
User's framing: "overall day" (median raw score across the 5 environments)
answers "is today worth going at all," which is the first question, before
"where should I fish" (which the ledger answers). It previously only
existed as a small secondary line inside each day of the week strip, never
surfaced for TODAY specifically anywhere near the top of the page.

Extracted the existing median calculation (previously duplicated logic
living only in `WeekAhead.tsx`) into a shared `overallDay()` in
`lib/data.ts`, and added a new bordered stat block on the homepage,
between the headline and the tide instrument, well above the ledger:
today's overall-day number at `clamp(2.6rem, 7vw, 3.6rem)`, deliberately
larger than any individual ground's score in the ledger below it (their
`.sc b` renders at 1.9rem), so it reads as more prominent by construction,
not just by position. Deliberately NOT tier-coloured: it's a raw median
across 5 profiles with different curve-defined ceilings, never rescaled
against any one profile's own history, so it has no defined position on
the calibrated scale, and colouring it would repeat the exact category
error (raw vs. percentile, calibrated vs. rank_score) that got fixed
earlier in this project. Text under the number states the range of the
five so "65 overall" is legible in context ("today's five range from 61
to 72"), not a bare number.

Verified visually at 1280px and 375px with a real render, not just the
CSS: correctly the single largest number on the page at both widths, and
stacks cleanly to a single column under 520px. `engine/tests.py` passes,
`tsc --noEmit` and `next build` clean.
