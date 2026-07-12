import type { Metadata } from "next";
import Link from "next/link";
import RigDiagram from "@/components/RigDiagram";
import { profiles, site, tier } from "@/lib/data";

export const metadata: Metadata = { title: "Species guide · Bite Index" };

const KNOT_NAMES: Record<string, string> = {
  uni: "Uni",
  double_uni: "Double uni",
  clinch: "Improved clinch",
  fg: "FG",
};

function diffStamp(difficulty: string): { label: string; cls: string } {
  const d = difficulty.toLowerCase();
  if (d.startsWith("easy") || d.includes("gateway")) return { label: "EASY MARK", cls: "olive" };
  if (d.startsWith("hard")) return { label: "HARD CASE", cls: "red" };
  return { label: "FAIR FIGHT", cls: "ochre" };
}

export default function SpeciesPage() {
  const today = site.days[0];
  const todayScores = new Map(today?.species.map((s) => [s.id, s]) ?? []);

  return (
    <main className="wrap">
      <div className="classbar">
        <span>CONTACT DOSSIERS</span>
        <span>GENERAL HABITAT ONLY · NO SECRET SPOTS</span>
        <span>KEEP WITH LOG</span>
      </div>
      <header className="hero" style={{ position: "relative" }}>
        <div className="stamp blue" style={{ right: 0 }}>CHECK DPI<br />LIMITS FIRST</div>
        <h1 className="headline">Seven Sydney staples, from the gateway fish up.</h1>
        <p className="sechint" style={{ marginTop: 10 }}>
          the short version on every card; open FULL SPEC if you want the gear numbers. sizes and bag limits are{" "}
          <a href="https://www.dpi.nsw.gov.au/fishing" rel="noopener">NSW DPI&apos;s</a> department, not ours. more
          species to be added: a new fish is one config file.
        </p>
      </header>

      <div className="species-grid">
        {profiles.species.map((sp) => {
          const t = todayScores.get(sp.id);
          const g = sp.guide;
          const ds = diffStamp(g.difficulty);
          return (
            <article className="card sp-card" id={sp.id} key={sp.id} style={{ position: "relative" }}>
              <div className={`cstamp ${ds.cls}`}>{ds.label}</div>
              <div className="card-top">
                <div>
                  <h3>{sp.name}</h3>
                  <div className="sp-diff">{g.difficulty}</div>
                </div>
                {t && (
                  <div className="score-block">
                    <div className={`score-num ${tier(t.score)[0]}`}>{t.score}</div>
                    <div className={`score-word ${tier(t.score)[0]}`}>today · {t.environment_name}</div>
                  </div>
                )}
              </div>

              <div className="sp-flex">
                <div>
                  <dl className="kv">
                    <dt>Bait</dt>
                    <dd>{g.baits.join(" · ")}</dd>
                    <dt>Rig</dt>
                    <dd>{g.rigs.join(" / ")}</dd>
                    <dt>When</dt>
                    <dd>{g.season_notes}</dd>
                    <dt>Where (general)</dt>
                    <dd>{g.habitat}</dd>
                  </dl>
                  {g.hot_tip && <p className="hot-tip">☞ {g.hot_tip}</p>}
                  {g.safety_note && <p className="sp-safety">⚠ {g.safety_note}</p>}
                  <details className="why-details">
                    <summary>FULL SPEC</summary>
                    <dl className="kv" style={{ marginTop: 4 }}>
                      <dt>Lures</dt>
                      <dd>{g.lures.join(" · ")}</dd>
                      <dt>Line / leader / rod</dt>
                      <dd className="mono">{g.line} · {g.leader} · {g.rod}</dd>
                      <dt>Knots</dt>
                      <dd>
                        {g.knots.map((k) => (
                          <Link className="knot-chip" href={`/knots#${k}`} key={k}>{KNOT_NAMES[k] ?? k}</Link>
                        ))}
                      </dd>
                    </dl>
                  </details>
                </div>
                <RigDiagram id={g.rig_diagram} />
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
