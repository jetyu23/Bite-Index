import type { Metadata } from "next";
import Link from "next/link";
import RigDiagram from "@/components/RigDiagram";
import { profiles, site, tier } from "@/lib/data";

export const metadata: Metadata = { title: "Species guide — Bite Index" };

const KNOT_NAMES: Record<string, string> = {
  uni: "Uni",
  double_uni: "Double uni",
  clinch: "Improved clinch",
  fg: "FG",
};

export default function SpeciesPage() {
  const today = site.days[0];
  const todayScores = new Map(today?.species.map((s) => [s.id, s]) ?? []);

  return (
    <main className="wrap">
      <header className="hero">
        <p className="dateline">SPECIES GUIDE · GENERAL HABITAT ONLY — NO SPOTS PUBLISHED</p>
        <h1 className="headline">What to chase, and how to rig for it</h1>
        <p className="prose" style={{ marginTop: 12 }}>
          Seven Sydney staples, from the gateway fish up. Each card shows today&apos;s score for that species,
          then the practical layer: bait, rig, line class and where in general terms to look. Check current size
          and bag limits with <a href="https://www.dpi.nsw.gov.au/fishing" rel="noopener">NSW DPI</a> before
          keeping anything.
        </p>
      </header>

      <div className="species-grid">
        {profiles.species.map((sp) => {
          const t = todayScores.get(sp.id);
          return (
            <article className="card sp-card" id={sp.id} key={sp.id}>
              <div className="card-top">
                <div>
                  <h3>{sp.name}</h3>
                  <div className="sp-diff">{sp.guide.difficulty}</div>
                </div>
                {t && (
                  <div className="score-block">
                    <div className={`score-num t-${tier(t.score)}`}>{t.score}</div>
                    <div className={`score-word t-${tier(t.score)}`}>today · {t.environment_name}</div>
                  </div>
                )}
              </div>

              <div className="sp-flex">
                <div>
                  <dl className="kv">
                    <dt>Baits</dt>
                    <dd>{sp.guide.baits.join(" · ")}</dd>
                    <dt>Lures</dt>
                    <dd>{sp.guide.lures.join(" · ")}</dd>
                    <dt>Rig</dt>
                    <dd>{sp.guide.rigs.join(" — or — ")}</dd>
                    <dt>Line / leader / rod</dt>
                    <dd className="mono">
                      {sp.guide.line} · {sp.guide.leader} · {sp.guide.rod}
                    </dd>
                    <dt>Knots</dt>
                    <dd>
                      {sp.guide.knots.map((k) => (
                        <Link className="knot-chip" href={`/knots#${k}`} key={k}>
                          {KNOT_NAMES[k] ?? k}
                        </Link>
                      ))}
                    </dd>
                    <dt>Season</dt>
                    <dd>{sp.guide.season_notes}</dd>
                    <dt>Where to look (general)</dt>
                    <dd>{sp.guide.habitat}</dd>
                  </dl>
                  {sp.guide.safety_note && <p className="sp-safety">⚠ {sp.guide.safety_note}</p>}
                </div>
                <RigDiagram id={sp.guide.rig_diagram} />
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
