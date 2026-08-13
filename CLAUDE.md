# Bite Index — working notes for Claude

## Purpose

A free, transparent Sydney fishing conditions site. Python scoring engine + a
static Next.js site, deployed on Vercel, refreshed daily by GitHub Actions. The
portfolio point is the scoring engine: 12 hand-set, fully explainable weighted
profiles (5 environments + 7 species) score the same forecast inputs 12
different ways. No ML anywhere. Every weight, curve and (as of this session)
gate carries a written justification, and the methodology/glossary pages
render straight from the same profile JSON the engine scores against, so the
published explanation and the running model cannot drift apart.

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
9. **Range compression is dominated by weighted-averaging across 8-11
   factors, not by genuine Sydney weather stability**, and — as of this
   session's window-architecture work — compounded by the best-3-hour-window
   search always finding *some* passable block, which is why gates on
   within-day-cyclical factors (tide) turned out to be structurally inert.
   See Decision Log for the resolution in progress.

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
