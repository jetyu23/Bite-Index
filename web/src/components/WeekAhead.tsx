import { dayNum, shortEnv, tier } from "@/lib/data";
import type { Day } from "@/lib/types";

/* The week strip earns its space by showing the SHAPE of each day, not one
   number: a tiny bar per ground (rock/beach/estuary/harbour/offshore) so you
   can read "beach day" vs "harbour day" vs "everything's flat" at a glance,
   with the best ground called out below. A daily average would throw all of
   that away, which is the whole reason we don't use one. */

const ORDER = ["rock", "beach", "estuary", "harbour", "boat"];

function Spark({ day }: { day: Day }) {
  const byId = new Map(day.environments.map((e) => [e.id, e.score]));
  const W = 128;
  const H = 40;
  const gap = 5;
  const bw = (W - gap * (ORDER.length - 1)) / ORDER.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Scores for each ground this day">
      {ORDER.map((id, i) => {
        const v = byId.get(id) ?? 0;
        const h = Math.max(2, (v / 100) * H);
        const t = tier(v)[0];
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

/* "Best" is picked by the calibrated (rescaled, pooled-anchor) value, not
   raw score: raw scores aren't on a comparable scale across grounds with
   different curve-defined baselines (e.g. boat's raw ceiling sits well
   above harbour's), so ranking by raw would just favour whichever ground
   runs hottest by design, not whichever is actually having a relatively
   good day. The displayed number is still that ground's raw score. */
function rank(e: { score: number; calibrated: number | null }): number {
  return e.calibrated ?? e.score;
}

/* Middle of the 5 grounds' raw scores -- "how's the whole day", as opposed to
   "best" which answers "where should I fish". Deliberately not an average:
   the median is a real ground's actual score, not a number nobody's ground
   produced. */
function overallDay(day: Day): number | null {
  const scores = [...day.environments].map((e) => e.score).sort((a, b) => a - b);
  return scores.length ? scores[Math.floor((scores.length - 1) / 2)] : null;
}

export default function WeekAhead({ days }: { days: Day[] }) {
  return (
    <div className="weekstrip">
      {days.map((d, i) => {
        const best = d.environments.reduce((a, b) => (rank(b) > rank(a) ? b : a));
        const overall = overallDay(d);
        const rockFlag = d.environments.some((e) => e.safety_flag);
        const t = tier(best.score)[0];
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
