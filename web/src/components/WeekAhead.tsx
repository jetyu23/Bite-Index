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
      {/* median reference line at 50 */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--ink)" strokeWidth="0.75" strokeDasharray="2 3" opacity={0.4} />
    </svg>
  );
}

export default function WeekAhead({ days }: { days: Day[] }) {
  return (
    <div className="weekstrip">
      {days.map((d, i) => {
        const best = d.environments.reduce((a, b) => (b.score > a.score ? b : a));
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
