"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RigDiagram from "@/components/RigDiagram";
import FishSilhouette from "@/components/FishSilhouette";
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

type SortKey = "score" | "tastiness" | "difficulty" | "rarity";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  score: "Today's score",
  tastiness: "Tastiness",
  difficulty: "Difficulty",
  rarity: "Rarity",
};

// Sensible per-field defaults, not one hardcoded direction for everything:
// "goodness" metrics (score, tastiness) default high-to-low; "how much of an
// obstacle" metrics (difficulty, rarity -- both read low as "easy to get")
// default low-to-high. Every field stays switchable regardless of its default.
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  score: "desc",
  tastiness: "desc",
  difficulty: "asc",
  rarity: "asc",
};

function sortValue(sp: SpeciesProfile, key: SortKey, todayScores: Record<string, SpeciesResult>): number {
  if (key === "tastiness") return sp.attributes.eating_quality;
  if (key === "difficulty") return sp.attributes.difficulty;
  if (key === "rarity") return sp.attributes.rarity;
  return todayScores[sp.id]?.score ?? -1;
}

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
  const [sortDir, setSortDir] = useState<SortDir>(SORT_DEFAULT_DIR.score);
  const [envFilter, setEnvFilter] = useState<string | null>(null);
  const [seasonOnly, setSeasonOnly] = useState(false);

  function chooseSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(SORT_DEFAULT_DIR[k]);
    }
  }

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
      const diff = sortValue(a, sortKey, todayScores) - sortValue(b, sortKey, todayScores);
      return sortDir === "asc" ? diff : -diff;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, query, sortKey, sortDir, envFilter, seasonOnly, todayScores, currentMonth]);

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
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
            const active = sortKey === k;
            return (
              <button
                key={k}
                type="button"
                className={`sp-chip ${active ? "active" : ""}`}
                onClick={() => chooseSort(k)}
                aria-pressed={active}
                title={active ? `Click to reverse to ${sortDir === "asc" ? "high to low" : "low to high"}` : `Sort by ${SORT_LABELS[k]}`}
              >
                {SORT_LABELS[k]}
                {active && <span className="sp-sort-dir">{sortDir === "asc" ? " ↑ low–high" : " ↓ high–low"}</span>}
              </button>
            );
          })}
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
          const tierClass = t ? tier(t.calibrated ?? t.score)[0] : "";
          return (
            <article className="sp-row" id={sp.id} key={sp.id}>
              <FishSilhouette id={sp.id} />
              <div className="sp-row-body">
                <div className="sp-row-top">
                  <div>
                    <h3>{sp.name}</h3>
                    <p className="sp-descriptor">{a.difficulty_note}</p>
                  </div>
                  {t && (
                    <div className="score-block">
                      <div className={`score-num ${tierClass}`}>{t.score}</div>
                      <div className={`score-word ${tierClass}`}>today &middot; {t.environment_name}</div>
                    </div>
                  )}
                </div>

                <div className="sp-ratings">
                  <span title={a.eating_note}>
                    <span className="sp-rating-label">TASTINESS</span> {dots(a.eating_quality)}
                  </span>
                  <span title={a.difficulty_note}>
                    <span className="sp-rating-label">DIFFICULTY</span> {dots(a.difficulty)}
                  </span>
                  <span title={a.rarity_note}>
                    <span className="sp-rating-label">RARITY</span> {dots(a.rarity)}
                  </span>
                  <span className={`diff-chip ${ds.cls}`}>{ds.label}</span>
                </div>

                <details className="why-details">
                  <summary>FULL SPEC</summary>
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
                      {g.hot_tip && <p className="hot-tip">&#9756; {g.hot_tip}</p>}
                      {g.safety_note && <p className="sp-safety">&#9888; {g.safety_note}</p>}
                    </div>
                    <RigDiagram id={g.rig_diagram} />
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="sechint">Nothing matches those filters. Try clearing one.</p>}
    </>
  );
}
