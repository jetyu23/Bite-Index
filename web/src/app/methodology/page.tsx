import type { Metadata } from "next";
import { profiles, site } from "@/lib/data";
import type { ProfileFactor, ProfileGate } from "@/lib/types";

export const metadata: Metadata = { title: "Methodology · Bite Index" };

/* Everything on this page renders from data/profiles/*.json — the same files
   the engine scores with. If a weight changes, this page changes. There is no
   second copy of the model to drift out of date. */

const MONTHS = "JFMAMJJASOND".split("");

function SeasonSpark({ season }: { season: number[] }) {
  return (
    <svg viewBox="0 0 132 34" width="132" height="34" role="img" aria-label="Seasonality by month">
      {season.map((v, i) => (
        <g key={i}>
          <rect x={i * 11 + 1} y={22 - v * 20} width="8" height={Math.max(1, v * 20)} fill="#0f6e73" opacity={0.25 + v * 0.75} />
          <text x={i * 11 + 5} y={32} textAnchor="middle" fontSize="7" fontFamily="IBM Plex Mono" fill="#51646a">
            {MONTHS[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function pct(f: ProfileFactor, all: ProfileFactor[]): string {
  const total = all.reduce((a, b) => a + b.weight, 0);
  return `${Math.round((100 * f.weight) / total)}%`;
}

function windowLabel(w: number[]): string {
  const f = (h: number) => {
    const hh = h % 24;
    const ap = hh < 12 ? "am" : "pm";
    const d = hh % 12 === 0 ? 12 : hh % 12;
    return `${d}${ap}`;
  };
  return `${f(w[0])}–${f(w[1])}${w[1] > 24 ? " (next day)" : ""}`;
}

function FactorRows({ factors }: { factors: ProfileFactor[] }) {
  const defs = profiles.factors.metrics;
  return (
    <tbody>
      {[...factors]
        .sort((a, b) => b.weight - a.weight)
        .map((f) => {
          const d = defs[f.metric];
          return (
            <tr key={f.metric}>
              <td>
                <span className={`ev ev-${d.evidence}`} />
                {d.label}
                {d.evidence === "low" && <span className="low-tag">LOW EVIDENCE</span>}
              </td>
              <td className="num">{pct(f, factors)}</td>
              <td>{f.justification}</td>
            </tr>
          );
        })}
    </tbody>
  );
}

function GateNotes({ gates }: { gates?: ProfileGate[] }) {
  if (!gates || gates.length === 0) return null;
  const defs = profiles.factors.metrics;
  return (
    <>
      {gates.map((g) => (
        <p key={g.metric} className="safety-msg" style={{ maxWidth: "80ch" }}>
          Gate, not a weight ({defs[g.metric]?.label ?? g.metric}): {g.justification}
        </p>
      ))}
    </>
  );
}

export default function MethodologyPage() {
  const defs = profiles.factors.metrics;

  return (
    <main className="wrap">
      <header className="hero">
        <p className="dateline">METHODOLOGY · THE FULL MODEL, NOTHING WITHHELD</p>
        <h1 className="headline">How every number on this site is made</h1>
      </header>

      <div className="prose">
        <p>
          Bite Index is a <strong>transparent variable-weighting model</strong>. One set of forecast inputs is run
          through several hand-set weighting profiles (five environments, seven species) and each profile turns
          the same day into a different 0–100 score. That is the entire idea: conditions don&apos;t have one meaning,
          they have one meaning <em>per situation</em>. The swell that closes the rocks is the same swell that
          stirs the beach gutters for tailor.
        </p>
        <p>
          There is deliberately no machine learning here. Every weight below was set by hand and carries a written
          justification, so every score can be defended factor by factor, and challenged. Where a factor&apos;s
          effect on fish is folklore rather than evidence (moon phase, mostly), it is included with a small weight
          and labelled <span className="low-tag">LOW EVIDENCE</span> rather than laundered into the number.
        </p>

        <h2 style={{ margin: "30px 0 8px" }}>How a score is made</h2>
        <ol style={{ paddingLeft: 20 }}>
          <li>Forecast data is pulled once daily (Open-Meteo weather + marine models; sun and moon computed locally).</li>
          <li>Each factor is converted to a 0–100 <em>subscore</em> through a response curve: swell of 0.8 m scores high for rock fishing, 2.5 m scores near zero.</li>
          <li>Subscores are blended using the profile&apos;s weights (normalised to sum to 1). Missing data scores a neutral 50 and is flagged, never invented.</li>
          <li>A small number of factors are <strong>gates, not weights</strong>: where the angling logic is genuinely a switch rather than a contribution (water below a species&apos; activity threshold, for example), that hour&apos;s blended score is multiplied down rather than averaged down, so it cannot be diluted by nine other factors that have nothing to do with whether the fish are there. Listed per profile below, alongside the rock safety override, which works the same way but is a hard cap, not a soft multiplier.</li>
          <li>This happens for every hour inside the profile&apos;s realistic fishing window; the day&apos;s score is the <strong>best rolling 3-hour block</strong>, which is also shown as the &ldquo;best window&rdquo;. A daily average would bury the dawn bite under the midday lull.</li>
          <li>Species scores blend the species&apos; own factor score with the score of its best environment, weighted by how strongly that species is tied to environment conditions.</li>
          <li>The <strong>raw score is what&apos;s displayed</strong> as the headline number and the tier label (Poor/Fair/Good/Excellent) describes it. Separately, that raw score is also looked up in the profile&apos;s own historical distribution to get a <strong>percentile rank</strong> ("better than 73% of days on record"), shown as a secondary line so it can&apos;t be mistaken for a quality judgement on its own. Until enough live history exists, no percentile is shown at all, and the footer says so.</li>
        </ol>

        <h2 style={{ margin: "30px 0 8px" }}>Calibration, in one paragraph</h2>
        <p>
          Raw day-to-day scores cluster more tightly than the 0&ndash;100 scale suggests, since averaging many
          weighted factors does that by construction, not by mistake. So the raw number alone can&apos;t tell you
          whether a score of 66 is an unusually good day or an ordinary one. <code>engine/calibrate.py</code> scores
          a long window of historical Sydney days with this exact engine and stores each profile&apos;s raw-score
          distribution; every live score is then also looked up in that distribution to get a percentile rank,
          shown as a secondary line under the raw number. No fitting, no ML: an empirical CDF you can recompute
          yourself. The calibration window is printed in the footer.
        </p>
      </div>

      <section>
        <h2>Factor dictionary</h2>
        <table className="mtable">
          <thead>
            <tr><th>Factor</th><th>Granularity</th><th>Evidence</th><th>What it captures</th></tr>
          </thead>
          <tbody>
            {Object.entries(defs).map(([id, d]) => (
              <tr key={id}>
                <td><span className={`ev ev-${d.evidence}`} />{d.label}{d.unit ? <span className="card-meta"> ({d.unit})</span> : null}</td>
                <td className="num">{d.granularity}</td>
                <td className="num">{d.evidence}</td>
                <td>{d.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="card-meta" style={{ marginTop: -14 }}>
          Evidence key: ● strong (well-established mechanism) · ● moderate (widely reported by anglers, plausible
          mechanism) · ○ low (folklore; included, small weight, labelled).
        </p>
      </section>

      <section>
        <h2>Environment profiles</h2>
        {profiles.environments.map((env) => (
          <div key={env.id} id={`m-${env.id}`}>
            <h3 style={{ margin: "26px 0 2px" }}>{env.name}</h3>
            <p className="card-meta">
              scoring window {windowLabel(env.window)} · {env.tagline}
            </p>
            <table className="mtable">
              <thead>
                <tr><th style={{ width: "24%" }}>Factor</th><th style={{ width: "8%" }}>Weight</th><th>Why this weight</th></tr>
              </thead>
              <FactorRows factors={env.factors} />
            </table>
            {env.safety && (
              <p className="safety-msg" style={{ maxWidth: "80ch" }}>
                Safety override, not a weight: if swell reaches {env.safety.metric_max_swell_m} m, or{" "}
                {env.safety.long_period_swell_m} m at {env.safety.long_period_s} s+ period, this score is capped at{" "}
                {env.safety.cap} and flagged, no matter what every other factor says. Safety is not tradeable
                against a good tide.
              </p>
            )}
            <GateNotes gates={env.gates} />
          </div>
        ))}
      </section>

      <section>
        <h2>Species profiles</h2>
        {profiles.species.map((sp) => {
          const season = sp.factors.find((f) => f.type === "season");
          return (
            <div key={sp.id} id={`m-${sp.id}`}>
              <h3 style={{ margin: "26px 0 2px" }}>{sp.name}</h3>
              <p className="card-meta">
                window {windowLabel(sp.window)} · environment blend {Math.round(sp.env_blend * 100)}% · fishes best in{" "}
                {Object.entries(sp.environments)
                  .sort((a, b) => b[1] - a[1])
                  .map(([e, a]) => `${e} (${Math.round(a * 100)}%)`)
                  .join(", ")}
              </p>
              {season?.season && (
                <div style={{ margin: "8px 0 2px" }}>
                  <SeasonSpark season={season.season} />
                </div>
              )}
              <table className="mtable">
                <thead>
                  <tr><th style={{ width: "24%" }}>Factor</th><th style={{ width: "8%" }}>Weight</th><th>Why this weight</th></tr>
                </thead>
                <FactorRows factors={sp.factors} />
              </table>
              <GateNotes gates={sp.gates} />
            </div>
          );
        })}
      </section>

      <section className="prose">
        <h2>Honest limitations</h2>
        <p>
          Tides come from a global ocean model sampled near Sydney Harbour, refined to event times by fitting a
          parabola around each extreme: good enough to plan a session, <strong>not official tide predictions and
          not for navigation</strong>. Swell is a model grid point off the coast, so your specific ledge or gutter
          will differ. Rain is used as a turbidity proxy without measuring turbidity. Season curves and every
          weight are one angler&apos;s codified judgment: v1 of a model, not truth.
        </p>
        <h2 style={{ marginTop: 26 }}>What would make this better (v3)</h2>
        <p>
          The validation plan: log real sessions against the published scores and test whether high-score
          days/environments actually out-fish low-score ones. Weight changes then get made in the open; every
          adjustment dated and justified on this page. Until that data exists, treat these scores as a structured
          opinion, which is exactly what they are.
        </p>
        <p className="mono card-meta">
          data: Open-Meteo (CC BY 4.0) · engine + profiles: this repo · generated {site.generated_at}
        </p>
      </section>
    </main>
  );
}
