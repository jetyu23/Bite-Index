import { dayNum, overallDay, shortEnv, tier } from "@/lib/data";
import type { Day } from "@/lib/types";

/* The week strip earns its space by showing the SHAPE of each day, not one
   number: a tiny bar per ground (rock/beach/estuary/harbour/offshore) so you
   can read "beach day" vs "harbour day" vs "everything's flat" at a glance.
   The overall-day median is the PRIMARY number on each tile (2026-08-19 --
   was previously the best ground's own score, with overall day as a small
   secondary line; that had it backwards, since a ground's raw score is on
   that ground's own scale and isn't the number that answers "is today worth
   going at all"). Best ground is the secondary line: still useful, still
   named, but visually subordinate to the number that's actually comparable
   day-to-day.

   Boat/offshore is excluded from "overall day" and from competing for
   "best ground" (2026-08-19): its raw floor sits above every other
   ground's raw median (real 366-day archive), so it won that contest on
   83% of real days regardless of whether that day was actually good for
   boat -- see the methodology page. Its bar stays in the sparkline
   (still real, still useful shape information) but rendered hollow/
   outlined rather than filled solid, and set apart with a wider gap, so
   it reads as "shown, not competing" rather than a sixth-of-the-cluster
   bar implying it's directly comparable to the other four. */

const SHORE_ORDER = ["rock", "beach", "estuary", "harbour"];
const ORDER = [...SHORE_ORDER, "boat"];

function Spark({ day }: { day: Day }) {
  const byId = new Map(day.environments.map((e) => [e.id, e]));
  const W = 128;
  const H = 40;
  const gap = 5;
  const sep = 10; // extra gap setting boat apart from the shore cluster
  const bw = (W - gap * (SHORE_ORDER.length - 1) - sep - gap) / ORDER.length;
  let x = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Scores for each ground this day">
      {ORDER.map((id, i) => {
        const e = byId.get(id);
        const v = e?.score ?? 0;
        const h = Math.max(2, (v / 100) * H);
        const isBoat = id === "boat";
        // Bar height is raw (this is explicitly labelled a raw-score
        // sparkline), but colour follows the same calibrated-or-raw value
        // as the tier label everywhere else, so a bar's colour always
        // agrees with what that ground's own row says.
        const t = tier(e ? (e.calibrated ?? e.score) : 0)[0];
        const col = { g: "var(--olive)", f: "var(--ochre)", p: "var(--red)", e: "var(--blue)" }[t];
        const barX = x;
        x += bw + (isBoat ? gap : i === SHORE_ORDER.length - 1 ? sep : gap);
        return (
          <g key={id}>
            <rect x={barX} y={0} width={bw} height={H} fill="var(--ink)" opacity={0.05} rx={1} />
            {isBoat ? (
              <rect x={barX} y={H - h} width={bw} height={h} fill="none" stroke={col} strokeWidth="1.2" strokeDasharray="2 1.5" rx={1} />
            ) : (
              <rect x={barX} y={H - h} width={bw} height={h} fill={col} opacity={0.9} rx={1} />
            )}
          </g>
        );
      })}
      {/* reference line at 50, for scale -- not each ground's actual median */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--ink)" strokeWidth="0.75" strokeDasharray="2 3" opacity={0.4} />
    </svg>
  );
}

/* "Best" is picked by rank_score (rescaled, pooled-anchor value) among the
   four SHORE grounds only -- boat excluded, see above. Not raw score and
   not calibrated: raw scores aren't comparable across grounds with
   different curve-defined baselines, so ranking by raw would just favour
   whichever ground runs hottest by design. calibrated (2026-08-14) is
   per-profile now -- how rare a score is FOR THAT GROUND -- so it's no
   longer comparable across different grounds either; only rank_score
   still is. The displayed number is still that ground's raw score. */
function rank(e: { score: number; rank_score: number | null }): number {
  return e.rank_score ?? e.score;
}

export default function WeekAhead({ days }: { days: Day[] }) {
  return (
    <div className="weekstrip">
      {days.map((d, i) => {
        const shore = d.environments.filter((e) => e.id !== "boat");
        const best = shore.reduce((a, b) => (rank(b) > rank(a) ? b : a));
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
            {overall != null && (
              <div className="wk-primary">
                <span className="wk-overall-num">{overall}</span>
                <span className="wk-overall-label">Overall day</span>
              </div>
            )}
            <div className="wk-foot">
              <span className="wk-foot-label">best:</span>
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
