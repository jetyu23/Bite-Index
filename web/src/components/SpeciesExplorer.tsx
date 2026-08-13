"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RigDiagram from "@/components/RigDiagram";
import { tier } from "@/lib/data";
import type { SpeciesProfile, SpeciesResult } from "@/lib/types";

/* Search/sort/filter for the species page: a fixed-order list stopped
   working once there were more than about eight cards to scan. Everything
   here is client-side state over data already shipped in the static
   export -- no new dependency, no server round trip. */

const ENV_ORDER = ["rock", "beach", "estuary", "harbour", "boat"];
const ENV_LABELS: Record<string, string> = {
  rock: "Rock",
  beach: "Beach",
  estuary: "Estuary",
  harbour: "Harbour",
  boat: "Boat",
};

type SortKey = "score" | "eating" | "difficulty";

const SORT_LABELS: Record<SortKey, string> = {
  score: "Today's score",
  eating: "Eating quality",
  difficulty: "Difficulty",
};

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

function dots(n: number, of = 5): string {
  return "●".repeat(n) + "○".repeat(Math.max(0, of - n));
}

function seasonFactorOf(sp: SpeciesProfile) {
  return sp.factors.find((f) => f.type === "season" && f.season);
}

export default function SpeciesExplorer({
  species,
  todayScores,
  currentMonth,
}: {
  species: SpeciesProfile[];
  todayScores: Record<string, SpeciesResult>;
  currentMonth: number; // 1-12
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [envFilter, setEnvFilter] = useState<string | null>(null);
  const [seasonOnly, setSeasonOnly] = useState(false);

  const inSeasonNow = (sp: SpeciesProfile) => {
    const f = seasonFactorOf(sp);
    if (!f?.season) return true;
    return f.season[currentMonth - 1] >= 0.6;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = species.filter((sp) => {
      if (q && !sp.name.toLowerCase().includes(q) && !(sp.tag ?? "").toLowerCase().includes(q)) return false;
      if (envFilter && !(envFilter in sp.environments)) return false;
      if (seasonOnly && !inSeasonNow(sp)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "eating") return b.attributes.eating_quality - a.attributes.eating_quality;
      if (sortKey === "difficulty") return a.attributes.difficulty - b.attributes.difficulty;
      const sa = todayScores[a.id]?.score ?? -1;
      const sb = todayScores[b.id]?.score ?? -1;
      return sb - sa;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, query, sortKey, envFilter, seasonOnly, todayScores, currentMonth]);

  return (
    <>
      <div className="sp-controls">
        <input
          type="search"
          className="sp-search"
          placeholder="Search species or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search species"
        />
        <div className="sp-ctlgroup">
          <span className="sp-ctl-label">SORT</span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`sp-chip ${sortKey === k ? "active" : ""}`}
              onClick={() => setSortKey(k)}
              aria-pressed={sortKey === k}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="sp-ctlgroup">
          <span className="sp-ctl-label">GROUND</span>
          <button
            type="button"
            className={`sp-chip ${envFilter === null ? "active" : ""}`}
            onClick={() => setEnvFilter(null)}
            aria-pressed={envFilter === null}
          >
            All
          </button>
          {ENV_ORDER.map((e) => (
            <button
              key={e}
              type="button"
              className={`sp-chip ${envFilter === e ? "active" : ""}`}
              onClick={() => setEnvFilter(envFilter === e ? null : e)}
              aria-pressed={envFilter === e}
            >
              {ENV_LABELS[e]}
            </button>
          ))}
        </div>
        <label className="sp-checkbox">
          <input type="checkbox" checked={seasonOnly} onChange={(e) => setSeasonOnly(e.target.checked)} />
          in season now
        </label>
      </div>
      <p className="sechint" aria-live="polite">
        {filtered.length} of {species.length} species shown
      </p>

      <div className="species-grid">
        {filtered.map((sp) => {
          const t = todayScores[sp.id];
          const g = sp.guide;
          const a = sp.attributes;
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
                    <div className={`score-num ${tier(t.calibrated ?? t.score)[0]}`}>{t.score}</div>
                    <div className={`score-word ${tier(t.calibrated ?? t.score)[0]}`}>today &middot; {t.environment_name}</div>
                  </div>
                )}
              </div>

              <div className="sp-ratings">
                <span title={a.eating_note}>
                  <span className="sp-rating-label">EATING</span> {dots(a.eating_quality)}
                </span>
                <span title={a.difficulty_note}>
                  <span className="sp-rating-label">DIFFICULTY</span> {dots(a.difficulty)}
                </span>
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
                  {g.hot_tip && <p className="hot-tip">&#9756; {g.hot_tip}</p>}
                  {g.safety_note && <p className="sp-safety">&#9888; {g.safety_note}</p>}
                  <details className="why-details">
                    <summary>FULL SPEC</summary>
                    <dl className="kv" style={{ marginTop: 4 }}>
                      <dt>Lures</dt>
                      <dd>{g.lures.length ? g.lures.join(" · ") : "None; bait or weed only"}</dd>
                      <dt>Line / leader / rod</dt>
                      <dd className="mono">
                        {g.line} &middot; {g.leader} &middot; {g.rod}
                      </dd>
                      <dt>Knots</dt>
                      <dd>
                        {g.knots.map((k) => (
                          <Link className="knot-chip" href={`/knots#${k}`} key={k}>
                            {KNOT_NAMES[k] ?? k}
                          </Link>
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
      {filtered.length === 0 && <p className="sechint">Nothing matches those filters. Try clearing one.</p>}
    </>
  );
}
