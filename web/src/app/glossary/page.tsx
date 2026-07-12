import type { Metadata } from "next";
import Link from "next/link";
import { profiles } from "@/lib/data";

export const metadata: Metadata = { title: "Glossary · Bite Index" };

const FIELD_TERMS: { term: string; def: string }[] = [
  { term: "Run-out / run-in tide", def: "Falling tide, rising tide. Moving water pushes bait around, and predators know it." },
  { term: "The turn / tide change", def: "The slack moment when the tide reverses. Classic bite window; worth planning around." },
  { term: "Springs and neaps", def: "Big tides near full and new moon (springs), small ones near the quarters (neaps). Springs = more flow = more action." },
  { term: "Swell vs chop", def: "Swell is organised energy from distant storms; chop is local wind mess. Swell decides the rocks and beach; chop mostly decides your mood." },
  { term: "Gutter", def: "A deeper channel along a beach; darker, less broken water. Fish use gutters like highways. Cast into one, not next to one." },
  { term: "Wash", def: "The white foamy water around rocks. It hides predators and knocks food loose. Workable wash: good. Heaving wash: leave." },
  { term: "Structure", def: "Anything that isn't open water: pylons, reef, kelp, moorings. Harbour fish treat structure the way people treat cafés." },
  { term: "Stain", def: "Water colour after rain. A light tea-stain often improves the fishing; chocolate milkshake kills it." },
  { term: "Berley (chum)", def: "Mashed-up food (bread, pilchards) trickled into the water to pull fish to you. Legal, ancient, and the closest thing to a cheat code." },
  { term: "Leader", def: "A metre-ish of tougher, near-invisible line between your braid and the hook. Braid casts; leader survives contact with reality." },
  { term: "Braid vs mono", def: "Braid: thin, no stretch, feels everything. Mono: stretchy and forgiving. Beginners often start mono, graduate to braid plus leader." },
  { term: "Livie", def: "A live baitfish, usually a yakka, offered to something bigger. The most convincing argument in fishing." },
  { term: "Best window", def: "The best rolling 3-hour block of the day for that ground or species. We score the window, not the daily average, so the dawn bite is never buried by a dead lunchtime." },
  { term: "Median day = 50", def: "Scores are calibrated so 50 means a typical day, by construction. An 80 is genuinely rare, not marketing." },
];

export default function GlossaryPage() {
  const metrics = Object.entries(profiles.factors.metrics);
  return (
    <main className="wrap">
      <div className="classbar">
        <span>REFERENCE SHEET</span>
        <span>EVERY TERM ON THE SURVEY, IN PLAIN ENGLISH</span>
        <span>KEEP WITH LOG</span>
      </div>
      <header className="hero" style={{ position: "relative" }}>
        <div className="stamp blue" style={{ right: 0 }}>PLAIN<br />ENGLISH</div>
        <h1 className="headline">No jargon survives this page.</h1>
        <p className="sechint" style={{ marginTop: 10 }}>
          field terms first, then the factors the engine actually scores. weights and the serious version live on
          the <Link href="/methodology">methodology page</Link>.
        </p>
      </header>

      <section>
        <h2 className="sec"><span className="tick" style={{ background: "var(--olive)" }} />FIELD TERMS</h2>
        <dl className="gloss">
          {FIELD_TERMS.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="sec"><span className="tick" style={{ background: "var(--blue)" }} />WHAT THE ENGINE SCORES</h2>
        <p className="sechint">evidence key: ● strong · ● moderate · ○ low (folklore; scored small and labelled, not laundered into the number)</p>
        <dl className="gloss">
          {metrics.map(([id, d]) => (
            <div key={id} id={`f-${id}`}>
              <dt>
                <span className={`ev ev-${d.evidence}`} /> {d.label}
                {d.evidence === "low" && <span className="low-tag">LOW EVIDENCE</span>}
              </dt>
              <dd>{d.plain ?? d.description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
