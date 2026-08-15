/* Original line-art fish silhouettes, one per species, in the style of a
   Victorian natural-history plate: heavier outline, diagonal cross-hatch
   for the shadow side, a suggested scale patch on the flank, and visible
   rays inside the fins, rather than flat colour blobs. Same INK/TEAL/SOFT
   palette as RigDiagram.tsx so the whole site still reads as one hand --
   the engraving treatment changes the rendering technique, not the family
   of marks. Nothing traced or copied from any existing field guide,
   fisheries report or tackle-shop art; every path here is drawn from
   scratch, defined by proportions (body depth, head shape, tail shape)
   distinct enough that a reader can tell a flathead from a luderick at
   the small size these actually render at on a card. */

const INK = "#16232b";
const TEAL = "#0f6e73";
const SOFT = "#51646a";
const PAPER = "#e7e2d1";

/** Shared engraving defs: diagonal hatch (shadow) + scale pattern (flank),
    namespaced per fish so multiple instances on one page never collide. */
function EngraveDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`hatch-${id}`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3.2" stroke={INK} strokeWidth="0.7" />
      </pattern>
      <pattern id={`cross-${id}`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3.2" stroke={INK} strokeWidth="0.7" />
        <line x1="0" y1="0" x2="3.2" y2="0" stroke={INK} strokeWidth="0.5" />
      </pattern>
      <pattern id={`scale-${id}`} width="6.5" height="5" patternUnits="userSpaceOnUse">
        <path d="M0,5 Q3.25,0.5 6.5,5" fill="none" stroke={INK} strokeWidth="0.6" opacity="0.8" />
      </pattern>
    </defs>
  );
}

/** Body outline + base fill + belly hatch + flank scale patch, clipped to
    the same body shape so the texture never spills past the outline. */
function Body({
  id,
  d,
  shadow,
  scales,
  strokeWidth = 2.1,
}: {
  id: string;
  d: string;
  shadow: [number, number, number, number];
  scales: [number, number, number, number];
  strokeWidth?: number;
}) {
  const clip = `clip-${id}`;
  return (
    <>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={PAPER} stroke="none" />
      <rect x={shadow[0]} y={shadow[1]} width={shadow[2]} height={shadow[3]} fill={`url(#hatch-${id})`} clipPath={`url(#${clip})`} />
      <rect x={scales[0]} y={scales[1]} width={scales[2]} height={scales[3]} fill={`url(#scale-${id})`} clipPath={`url(#${clip})`} opacity="0.85" />
      <path d={d} fill="none" stroke={INK} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  );
}

/** A fan of ray lines inside a fin, from a base point out to the fin edge. */
function Rays({ base, tips }: { base: [number, number]; tips: [number, number][] }) {
  return (
    <g stroke={INK} strokeWidth="0.8" opacity="0.75">
      {tips.map((t, i) => (
        <line key={i} x1={base[0]} y1={base[1]} x2={t[0]} y2={t[1]} />
      ))}
    </g>
  );
}

function Eye({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={INK} strokeWidth="1.1" />
      <circle cx={x} cy={y} r={r * 0.42} fill={INK} />
    </g>
  );
}

const silhouettes: Record<string, React.ReactNode> = {
  mulloway: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="mulloway" />
      <Body
        id="mulloway"
        d="M10,31 C10,27 16,26 20,29 C26,20 40,14 56,14 C74,14 88,20 100,29 C88,37 74,42 56,42 C40,42 27,38 21,30 C17,33 11,34 10,31 Z"
        shadow={[10, 30, 90, 16]}
        scales={[34, 18, 46, 12]}
      />
      <path d="M92,26 L100,29 M92,32 L100,29" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <Rays base={[54, 15]} tips={[[46, 6], [50, 4], [54, 3], [58, 5], [62, 8]]} />
      <path d="M52,15 L46,6 M54,15 L58,5 M56,15 L62,8" fill="none" stroke={INK} strokeWidth="0.9" />
      <Eye x={86} y={25} />
    </svg>
  ),
  kingfish: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="kingfish" />
      <Body
        id="kingfish"
        d="M10,29 C18,17 36,12 56,12 C74,12 88,19 100,28 C88,36 74,44 56,44 C36,44 18,40 10,29 Z"
        shadow={[10, 29, 90, 15]}
        scales={[30, 16, 50, 12]}
      />
      <Rays base={[54, 13]} tips={[[42, 5], [48, 1], [54, 0], [60, 2], [66, 6]]} />
      <path d="M44,13 C46,8 50,4 54,3 M54,13 C58,8 63,5 67,6" fill="none" stroke={INK} strokeWidth="0.9" />
      <path d="M9,29 C4,19 2,13 5,4 M9,29 C4,39 2,45 5,54" fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
      <Rays base={[9, 29]} tips={[[4, 14], [3, 22], [3, 36], [4, 44]]} />
      <path d="M9,29 L20,29" stroke={TEAL} strokeWidth="1.6" />
      <Eye x={92} y={25} />
    </svg>
  ),
  bream: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="bream" />
      <Body
        id="bream"
        d="M18,30 C20,16 36,10 52,10 C64,10 74,16 92,28 C74,42 62,48 48,48 C34,48 18,44 18,30 Z"
        shadow={[18, 30, 76, 18]}
        scales={[30, 18, 48, 14]}
      />
      <path d="M28,13 L31,1 L36,12 L40,-1 L45,11 L49,2 L53,11" fill="none" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
      <Rays base={[41, 10]} tips={[[31, 1], [36, 12], [40, -1], [45, 11], [49, 2]]} />
      <path d="M19,29 C14,24 10,20 9,14 M19,32 C14,37 10,41 9,47" fill="none" stroke={INK} strokeWidth="1.9" />
      <Rays base={[19, 30]} tips={[[13, 22], [10, 16], [13, 39], [10, 45]]} />
      <Eye x={83} y={24} r={2.1} />
    </svg>
  ),
  tailor: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="tailor" />
      <Body
        id="tailor"
        d="M13,29 C18,21 34,16 54,16 C68,16 80,20 106,29 C80,38 68,42 54,42 C34,42 18,37 13,29 Z"
        shadow={[13, 29, 93, 15]}
        scales={[30, 18, 50, 12]}
      />
      <path d="M28,17 L60,11 L92,20" fill="none" stroke={INK} strokeWidth="1.3" />
      <path d="M96,25 L106,29 L96,33" fill="none" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M92,24 l5,5 M92,34 l5,-5" stroke={TEAL} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13,29 L2,25 M13,29 L2,35" stroke={INK} strokeWidth="1.5" fill="none" />
      <Rays base={[13, 29]} tips={[[6, 24], [4, 27], [6, 34]]} />
      <Eye x={82} y={26} />
    </svg>
  ),
  trevally: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="trevally" />
      <Body
        id="trevally"
        d="M88,31 C88,14 76,7 66,7 C60,7 58,12 59,17 C42,15 28,20 14,28 C28,38 42,46 58,47 C76,48 88,45 88,31 Z"
        shadow={[14, 30, 74, 18]}
        scales={[34, 16, 44, 14]}
      />
      <path d="M66,7 C67,3 64,1 60,2" fill="none" stroke={INK} strokeWidth="1.5" />
      <path d="M16,27 C11,20 9,13 12,6 M16,31 C11,40 9,47 12,54" fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
      <Rays base={[16, 29]} tips={[[11, 16], [9, 9], [11, 43], [9, 51]]} />
      <Eye x={46} y={20} r={2.3} />
    </svg>
  ),
  squid: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="squid" />
      <Body
        id="squid"
        d="M46,6 C58,6 68,14 68,26 C68,34 64,40 56,44 L60,50 L52,44 L46,50 L42,44 C36,40 32,34 32,26 C32,14 34,6 46,6 Z"
        shadow={[32, 28, 36, 22]}
        scales={[35, 8, 30, 14]}
      />
      <path d="M32,20 C24,17 16,17 10,21 M68,20 C76,17 84,17 90,21" fill="none" stroke={TEAL} strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M34,30 C22,29 12,27 4,31 M34,33 C23,35 14,39 7,45 M34,26 C22,23 13,18 8,10 M46,32 C42,40 38,47 30,52 M54,32 C58,40 62,47 70,52"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <Eye x={40} y={22} />
      <Eye x={54} y={22} />
    </svg>
  ),
  yakkas: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="yakkas" />
      <Body
        id="yakkas"
        d="M18,29 C23,25 36,22 54,22 C68,22 80,25 92,29 C80,33 68,36 54,36 C36,36 23,33 18,29 Z"
        shadow={[18, 29, 74, 8]}
        scales={[34, 23, 36, 7]}
        strokeWidth={1.8}
      />
      <path d="M44,22 L47,17 L51,22" fill="none" stroke={INK} strokeWidth="1.1" />
      <path d="M16,29 C13,25 12,22 13,18 M16,29 C13,33 12,36 13,40" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="70" cy="28" r="3.4" fill="none" stroke={TEAL} strokeWidth="1.7" />
      <Eye x={86} y={27} r={1.8} />
    </svg>
  ),
  salmon: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="salmon" />
      <Body
        id="salmon"
        d="M12,29 C16,19 32,13 52,13 C68,13 82,18 100,27 C82,40 68,45 52,45 C32,45 16,39 12,29 Z"
        shadow={[12, 29, 88, 16]}
        scales={[28, 17, 52, 13]}
      />
      <path d="M30,15 L60,9 L94,20" fill="none" stroke={TEAL} strokeWidth="1.5" />
      <path d="M98,26 C101,23 101,20 99,17 M98,30 C101,33 101,36 99,39" fill="none" stroke={INK} strokeWidth="1.6" />
      <Rays base={[98, 28]} tips={[[101, 22], [101, 34]]} />
      <Eye x={88} y={24} />
    </svg>
  ),
  flathead: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="flathead" />
      <Body
        id="flathead"
        d="M4,34 C4,25 12,20 28,19 C46,17.5 68,17 84,20 C92,22 97,26 98,30 C93,35 80,38 64,39.5 C42,41 20,40 10,36 C9,35 4,35 4,34 Z"
        shadow={[4, 30, 94, 12]}
        scales={[42, 20, 44, 12]}
      />
      <path d="M84,20 C90,18 95,19 98,22" fill="none" stroke={TEAL} strokeWidth="1.5" />
      <path d="M2,33 C-1,32 -2,30 0,27 M2,34 C-1,36 -2,39 1,42" fill="none" stroke={INK} strokeWidth="1.7" />
      <Eye x={82} y={24} r={2.2} />
      <Eye x={90} y={23} r={1.8} />
      <path d="M14,21 q4,-2 8,0 M22,20 q4,-2 8,0 M30,19.5 q4,-2 8,0" fill="none" stroke={INK} strokeWidth="0.7" opacity="0.7" />
    </svg>
  ),
  luderick: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="luderick" />
      <Body
        id="luderick"
        d="M20,29 C20,13 38,6 56,6 C74,6 88,15 98,28 C88,41 74,50 56,50 C38,50 20,45 20,29 Z"
        shadow={[20, 29, 78, 21]}
        scales={[30, 16, 50, 14]}
      />
      <path d="M26,10 C38,4 52,3 64,6 C70,7.5 76,10 82,14" fill="none" stroke={INK} strokeWidth="1.5" />
      <Rays base={[54, 6]} tips={[[30, 10], [40, 5], [50, 3], [60, 4], [70, 8], [80, 13]]} />
      <path d="M97,27 C100,22 101,17 99,12 M97,30 C100,35 101,40 99,45" fill="none" stroke={INK} strokeWidth="1.7" />
      <ellipse cx="95" cy="29" rx="1.6" ry="1.1" fill="none" stroke={INK} strokeWidth="1" />
      <Eye x={82} y={22} r={2.2} />
    </svg>
  ),
  whiting: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="whiting" />
      <Body
        id="whiting"
        d="M14,29 C19,25 32,22 50,22 C68,22 82,24 106,29 C82,34 68,36 50,36 C32,36 19,33 14,29 Z"
        shadow={[14, 29, 92, 7]}
        scales={[32, 23, 44, 6]}
        strokeWidth={1.9}
      />
      <path d="M98,27 C102,26 105,27 106,29 C105,31 102,32 98,31" fill="none" stroke={TEAL} strokeWidth="1.3" />
      <path d="M96,33 L99,38" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12,29 C9,26 8,23 9,20 M12,29 C9,32 8,35 9,38" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <Eye x={94} y={26} r={1.7} />
    </svg>
  ),
  snapper: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <EngraveDefs id="snapper" />
      <Body
        id="snapper"
        d="M92,32 C91,20 82,10 70,7 C64,5.5 60,-2 52,0 C46,1.5 47,8 53,11 C40,13 26,19 12,28 C26,39 40,46 56,48 C74,50 92,46 92,32 Z"
        shadow={[12, 31, 80, 19]}
        scales={[30, 18, 50, 15]}
      />
      <path d="M58,9 C54,4 49,2 44,3" fill="none" stroke={TEAL} strokeWidth="1.6" />
      <path d="M14,27 C10,21 9,15 11,9 M14,31 C10,37 9,43 11,49" fill="none" stroke={INK} strokeWidth="2" />
      <Rays base={[14, 29]} tips={[[10, 18], [9, 12], [10, 40], [9, 46]]} />
      <path d="M64,10 L62,2 L58,10 L56,1 L52,9" fill="none" stroke={INK} strokeWidth="0.9" />
      <Eye x={52} y={18} r={2.4} />
    </svg>
  ),
};

export default function FishSilhouette({ id }: { id: string }) {
  const svg = silhouettes[id];
  if (!svg) return null;
  return (
    <div className="fish-silhouette" aria-hidden="true">
      {svg}
    </div>
  );
}
