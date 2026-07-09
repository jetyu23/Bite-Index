import type { TideEvent } from "@/lib/types";

const W = 720;
const H = 132;
const PAD_X = 8;
const PAD_TOP = 26;
const PAD_BOT = 24;

function minsOf(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function TideCurve({
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
  if (!curve.length) {
    return <p className="tide-caption">Tide data unavailable today — tide factors scored neutral.</p>;
  }
  const hs = curve.map((p) => p.h).concat(events.map((e) => e.height));
  const min = Math.min(...hs);
  const max = Math.max(...hs);
  const span = max - min || 1;

  const x = (mins: number) => PAD_X + (mins / 1440) * (W - 2 * PAD_X);
  const y = (h: number) => PAD_TOP + (1 - (h - min) / span) * (H - PAD_TOP - PAD_BOT);

  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(minsOf(p.t)).toFixed(1)},${y(p.h).toFixed(1)}`).join(" ");
  const area = `${path} L${x(minsOf(curve[curve.length - 1].t)).toFixed(1)},${H - PAD_BOT} L${x(minsOf(curve[0].t)).toFixed(1)},${H - PAD_BOT} Z`;

  const srX = sunrise ? x(minsOf(sunrise)) : null;
  const ssX = sunset ? x(minsOf(sunset)) : null;

  return (
    <figure className="tide-fig">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Today's tide curve with high and low tide times">
        {/* night shading — light windows drawn onto the tide itself */}
        {srX !== null && <rect x={PAD_X} y={PAD_TOP - 6} width={Math.max(0, srX - PAD_X)} height={H - PAD_TOP - PAD_BOT + 6} fill="#16232b" opacity="0.07" />}
        {ssX !== null && <rect x={ssX} y={PAD_TOP - 6} width={Math.max(0, W - PAD_X - ssX)} height={H - PAD_TOP - PAD_BOT + 6} fill="#16232b" opacity="0.07" />}

        {/* hour ticks */}
        {[0, 360, 720, 1080, 1440].map((m, i) => (
          <g key={m}>
            <line x1={x(m)} y1={H - PAD_BOT} x2={x(m)} y2={H - PAD_BOT + 4} stroke="#8ea3a0" strokeWidth="1" />
            <text x={x(m)} y={H - 8} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#51646a">
              {["12am", "6am", "12pm", "6pm", "12am"][i]}
            </text>
          </g>
        ))}
        <line x1={PAD_X} y1={H - PAD_BOT} x2={W - PAD_X} y2={H - PAD_BOT} stroke="#c9d8d3" strokeWidth="1" />

        <path d={area} fill="#0f6e73" opacity="0.1" />
        <path d={path} fill="none" stroke="#0f6e73" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* sunrise / sunset ticks */}
        {srX !== null && (
          <text x={srX} y={12} textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#51646a">☀ {sunrise}</text>
        )}
        {ssX !== null && (
          <text x={ssX} y={12} textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#51646a">☾ {sunset}</text>
        )}

        {/* high/low markers */}
        {events.map((e) => {
          const ex = x(minsOf(e.time));
          const ey = y(e.height);
          const above = e.type === "high";
          return (
            <g key={e.time + e.type}>
              <circle cx={ex} cy={ey} r="3.2" fill={above ? "#0f6e73" : "#f8fbf9"} stroke="#0f6e73" strokeWidth="1.5" />
              <text x={ex} y={above ? ey - 8 : ey + 15} textAnchor="middle" fontSize="9.5" fontWeight="600" fontFamily="IBM Plex Mono, monospace" fill="#16232b">
                {e.type === "high" ? "H" : "L"} {e.time}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="tide-caption">
        Fort Denison-area tidal curve (model-derived, not for navigation) · shaded = dark hours
      </figcaption>
    </figure>
  );
}
