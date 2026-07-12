import type { TideEvent } from "@/lib/types";

const W = 900;
const H = 150;
const PAD_X = 6;
const PAD_TOP = 24;
const PAD_BOT = 22;

function minsOf(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function TideInstrument({
  curve,
  events,
  sunrise,
  sunset,
}: {
  curve: { t: string; h: number }[];
  events: TideEvent[];
  sunrise: string | null;
  sunset: string | null;
}) {
  const hasData = curve.length > 0;
  const hs = hasData ? curve.map((p) => p.h).concat(events.map((e) => e.height)) : [0, 1];
  const min = Math.min(...hs);
  const max = Math.max(...hs);
  const span = max - min || 1;

  const x = (mins: number) => PAD_X + (mins / 1440) * (W - 2 * PAD_X);
  const y = (h: number) => PAD_TOP + (1 - (h - min) / span) * (H - PAD_TOP - PAD_BOT);

  const path = hasData
    ? curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(minsOf(p.t)).toFixed(1)},${y(p.h).toFixed(1)}`).join(" ")
    : "";

  const srX = sunrise ? x(minsOf(sunrise)) : null;
  const ssX = sunset ? x(minsOf(sunset)) : null;

  return (
    <div className="instr">
      <div className="plate">
        <span>⊗</span>
        <span>TIDAL TRACE · FORT DENISON REF · UNIT 03 (SALVAGED)</span>
        <span>⊗</span>
      </div>
      <div className="crt">
        <div className="sweep" />
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Predicted tide height for the next 24 hours with high and low tide times">
          <g stroke="#243020" strokeWidth="1">
            {[0.25, 0.5, 0.75].map((f) => (
              <path key={f} d={`M0 ${PAD_TOP + f * (H - PAD_TOP - PAD_BOT)} H${W}`} opacity=".5" />
            ))}
            {[3, 6, 9, 12, 15, 18, 21].map((h) => (
              <path key={h} d={`M${x(h * 60)} ${PAD_TOP - 6} V${H - PAD_BOT}`} opacity=".3" />
            ))}
          </g>

          {/* dark hours dimmed on the display */}
          {srX !== null && <rect x={PAD_X} y={0} width={Math.max(0, srX - PAD_X)} height={H} fill="#000" opacity="0.32" />}
          {ssX !== null && <rect x={ssX} y={0} width={Math.max(0, W - PAD_X - ssX)} height={H} fill="#000" opacity="0.32" />}

          {hasData ? (
            <>
              <path
                d={path}
                fill="none"
                stroke="#ffb44d"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 5px rgba(255,180,77,.7))" }}
              />
              {events.map((e) => {
                const ex = x(minsOf(e.time));
                const ey = y(e.height);
                const hi = e.type === "high";
                return (
                  <g key={e.time + e.type} fill="#ffb44d" fontFamily="IBM Plex Mono, monospace" fontSize="11.5" fontWeight="600">
                    <path d={hi ? `M${ex - 4} ${ey - 7} l4 -7 4 7z` : `M${ex - 4} ${ey + 7} l4 7 4 -7z`} />
                    <text x={ex} y={hi ? ey - 17 : ey + 26} textAnchor="middle">
                      {hi ? "H" : "L"} {e.time}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            <text x={W / 2} y={H / 2} textAnchor="middle" fill="#7d5a28" fontFamily="IBM Plex Mono, monospace" fontSize="13">
              NO SIGNAL · TIDE FACTORS SCORED NEUTRAL TODAY
            </text>
          )}

          <g fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#5d6b4a">
            <text x={8} y={H - 7}>12AM</text>
            <text x={W / 2 - 14} y={H - 7}>12PM</text>
            <text x={W - 36} y={H - 7}>12AM</text>
          </g>
        </svg>
      </div>
      <div className="legend">
        <span><i>▲▼</i> HIGH / LOW WATER</span>
        <span><i>─</i> PREDICTED HEIGHT, 24 H</span>
        <span><i>▮</i> SWEEP = DAILY FEED</span>
        <span>DIM = DARK HOURS</span>
        <span>NOT FOR NAVIGATION</span>
      </div>
    </div>
  );
}
