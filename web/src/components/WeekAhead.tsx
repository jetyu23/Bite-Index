import { dayNum, overallDay, shortEnv, tier } from "@/lib/data";
import type { Day } from "@/lib/types";

/* The week strip earns its space by showing the SHAPE of each day, not one
   number: a tiny bar per ground (rock/beach/estuary/harbour/offshore) so you
   can read "beach day" vs "harbour day" vs "everything's flat" at a glance,
   with the best ground called out below. A daily average would throw all of
   that away, which is the whole reason we don't use one. */

const ORDER = ["rock", "beach", "estuary", "harbour", "boat"];

function Spark({ day }: { day: Day }) {
  const byId = new Map(day.environments.map((e) => [e.id, e]));
  const W = 128;
  const H = 40;
  const gap = 5;
  const bw = (W - gap * (ORDER.length - 1)) / ORDER.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Scores for each ground this day">
      {ORDER.map((id, i) => {
        const e = byId.get(id);
        const v = e?.score ?? 0;
        const h = Math.max(2, (v / 100) * H);
        // Bar height is raw (this is explicitly labelled a raw-score
        // sparkline), but colour follows the same calibrated-or-raw value
        // as the tier label everywhere else, so a bar's colour always
        // agrees with what that ground's own row says.
        const t = tier(e ? (e.calibrated ?? e.score) : 0)[0];
        const col = { g: "var(--olive)", f: "var(--ochre)", p: "var(--red)", e: "var(--blue)" }[t];
        return (
          <g key={id}>
            <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} fill={col} opacity={0.9} rx={1} />
            <rect x={i * (bw + gap)} y={0} width={bw} height={H} fill="var(--ink)" opacity={0.05} rx={1} />
          </g>
        );
      })}
      {/* reference line at 50, for scale -- not each ground's actual median */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--ink)" strokeWidth="0.75" strokeDasharray="2 3" opacity={0.4} />
    </svg>
  );
}

/* "Best" is picked by rank_score (rescaled, pooled-anchor value), not raw
   score and not calibrated: raw scores aren't on a comparable scale across
   grounds with different curve-defined baselines (e.g. boat's raw ceiling
   sits well above harbour's), so ranking by raw would just favour whichever
   ground runs hottest by design, not whichever is actually having a
   relatively good day. calibrated (2026-08-14) is per-profile now -- how
   rare a score is FOR THAT GROUND -- so it's no longer comparable across
   different grounds either; only rank_score still is. The displayed number
   is still that ground's raw score. */
function rank(e: { score: number; rank_score: number | null }): number {
  return e.rank_score ?? e.score;
}

export default function WeekAhead({ days }: { days: Day[] }) {
  return (
    <div className="weekstrip">
      {days.map((d, i) => {
        const best = d.environments.reduce((a, b) => (rank(b) > rank(a) ? b : a));
        const overall = overallDay(d);
        const rockFlag = d.environments.some((e) => e.safety_flag);
        // Colour of the "best" badge reads DISPLAY (calibrated, per-ground),
        // not the ranking key used to pick which ground is best -- same
        // "one source for colour and label" rule as everywhere else.
        const t = tier(best.calibrated ?? best.score)[0];
        const tideH = d.summary.tide_events.find((e) => e.type === "high");
        return (
          <div key={d.date} className={`wk ${i === 0 ? "today" : ""}`}>
            <div className="wk-head">
              <span className="wk-wd">{d.weekday.toUpperCase()}</span>
              <span className="wk-dn">{dayNum(d.date)}</span>
            </div>
            <Spark day={d} />
            <div className="wk-foot">
              <span className={`wk-best ${t}`}>{best.score}</span>
              <span className="wk-env">{shortEnv(best.name)}</span>
            </div>
            {overall != null && <span className="wk-overall">overall day {overall}</span>}
            {rockFlag ? (
              <span className="wk-flag">⚠ ROCKS</span>
            ) : (
              <span className="wk-tide">{tideH ? `H ${tideH.time}` : "\u00a0"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
