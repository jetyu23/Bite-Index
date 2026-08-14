/* Original line-art fish silhouettes, one per species, same style and palette
   as RigDiagram.tsx (nothing traced or copied from existing field guides or
   tackle-shop art). Each shape is built from one or two EXAGGERATED, real
   identifying features (flathead's flat head, snapper's forehead hump,
   trevally's blunt vertical face, bream's spiked dorsal, luderick's smooth
   round profile) rather than subtle proportion tweaks -- at the ~90px render
   size these actually show up at, subtlety just reads as "grey blob", so the
   defining feature has to be big enough to survive that. */

const INK = "#16232b";
const TEAL = "#0f6e73";
const SOFT = "#51646a";
const FILL = "#c3ccc4";

function Eye({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={INK} />;
}

const silhouettes: Record<string, React.ReactNode> = {
  // Long predator body, big open jaw, gently forked tail.
  mulloway: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M10,31 C10,27 16,26 20,29 C26,20 40,14 56,14 C74,14 88,20 100,29 C88,37 74,42 56,42 C40,42 27,38 21,30 C17,33 11,34 10,31 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M22,28 C30,26 36,30 34,36" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M98,28 C102,23 103,18 100,13 M98,31 C102,36 103,41 100,46" fill="none" stroke={INK} strokeWidth="1.8" />
      <path d="M52,15 L56,9 L60,15" fill="none" stroke={INK} strokeWidth="1.3" />
      <Eye x={92} y={25} />
    </svg>
  ),
  // Fusiform torpedo, sharply forked "swallowtail", streamlined single dorsal.
  kingfish: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M10,29 C18,17 36,12 56,12 C74,12 88,19 100,28 C88,36 74,44 56,44 C36,44 18,40 10,29 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M40,13 L48,4 L54,13 M54,13 L62,5 L68,14" fill="none" stroke={INK} strokeWidth="1.3" />
      <path d="M9,29 C4,19 2,13 5,4 M9,29 C4,39 2,45 5,54" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M9,29 L20,29" stroke={TEAL} strokeWidth="1.6" />
      <Eye x={92} y={25} />
    </svg>
  ),
  // Deep diamond body, TALL spiked dorsal spine, steep small forehead.
  bream: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M18,30 C20,16 36,10 52,10 C64,10 74,16 92,28 C74,42 62,48 48,48 C34,48 18,44 18,30 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M28,13 L31,1 L36,12 L40,-1 L45,11 L49,2 L53,11" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M91,27 C95,22 96,17 94,12 M91,29 C95,34 96,39 94,44" fill="none" stroke={INK} strokeWidth="1.6" />
      <Eye x={80} y={23} r={2.2} />
    </svg>
  ),
  // Elongated, pointed spear-like snout, sharp angled teeth marks, moderate fork.
  tailor: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M12,30 C18,21 34,16 54,16 C68,16 80,20 106,29 C80,38 68,42 54,42 C34,42 18,37 12,30 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M96,25 L106,29 L96,33" fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M92,24 l5,5 M92,34 l5,-5" stroke={TEAL} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12,30 L2,25 M12,30 L2,35" stroke={INK} strokeWidth="1.3" fill="none" />
      <Eye x={82} y={26} />
    </svg>
  ),
  // Deep body, VERY blunt near-vertical forehead, deeply forked tail.
  trevally: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M22,31 C22,14 34,7 44,7 C50,7 52,12 51,17 C68,15 82,20 96,28 C82,38 68,46 52,47 C34,48 22,45 22,31 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M44,7 C43,3 46,1 50,2" fill="none" stroke={INK} strokeWidth="1.4" />
      <path d="M94,27 C99,20 101,13 98,6 M94,31 C99,40 101,47 98,54" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <Eye x={64} y={20} r={2.3} />
    </svg>
  ),
  // Mantle tapering to a point (not a fish tail), side fins, spread tentacle bundle.
  squid: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M46,6 C58,6 68,14 68,26 C68,34 64,40 56,44 L60,50 L52,44 L46,50 L42,44 C36,40 32,34 32,26 C32,14 34,6 46,6 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M32,20 C24,17 16,17 10,21 M68,20 C76,17 84,17 90,21" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M34,30 C22,29 12,27 4,31 M34,33 C23,35 14,39 7,45 M34,26 C22,23 13,18 8,10 M46,32 C42,40 38,47 30,52 M54,32 C58,40 62,47 70,52"
        fill="none"
        stroke={INK}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <Eye x={40} y={22} />
      <Eye x={54} y={22} />
    </svg>
  ),
  // Small slender baitfish with a dark shoulder spot near the gill (a real
  // yakka field mark) and a light, deeply forked tail.
  yakkas: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M18,29 C23,25 36,22 54,22 C68,22 80,25 92,29 C80,33 68,36 54,36 C36,36 23,33 18,29 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.6"
      />
      <circle cx="70" cy="28" r="3.4" fill="none" stroke={TEAL} strokeWidth="1.6" />
      <path d="M44,22 L47,17 L51,22" fill="none" stroke={INK} strokeWidth="1.1" />
      <path d="M16,29 C13,25 12,22 13,18 M16,29 C13,33 12,36 13,40" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <Eye x={86} y={27} r={1.8} />
    </svg>
  ),
  // Elongated, blunt rounded nose (not pointed like tailor), deep round belly curve.
  salmon: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M12,29 C16,19 32,13 52,13 C68,13 82,18 100,27 C100,29 100,29 100,29 C82,40 68,45 52,45 C32,45 16,39 12,29 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M30,15 L60,9 L94,20" fill="none" stroke={TEAL} strokeWidth="1.4" />
      <path d="M98,26 C101,23 101,20 99,17 M98,30 C101,33 101,36 99,39" fill="none" stroke={INK} strokeWidth="1.4" />
      <Eye x={88} y={24} />
    </svg>
  ),
  // The defining shape: a broad, dead-flat head running most of the body
  // length with eyes on top, tapering to a small soft (unforked) tail.
  flathead: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M4,34 C4,25 12,20 28,19 C50,17.5 74,17 90,20 C98,22 103,26 105,30 C99,35 84,39 66,40.5 C42,42 16,41 6,37 C5,36 4,35 4,34 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M90,20 C97,18 102,18.5 105,21" fill="none" stroke={TEAL} strokeWidth="1.4" />
      <path d="M2,34 C-1,33 -2,30 0,27 M2,35 C-1,38 -2,41 1,45" fill="none" stroke={INK} strokeWidth="1.5" />
      <Eye x={86} y={22} r={2.4} />
      <Eye x={97} y={20} r={1.9} />
    </svg>
  ),
  // Smooth, evenly rounded oval (no spikes, unlike bream), small round mouth
  // low on a blunt snout, long low continuous dorsal ridge.
  luderick: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M20,29 C20,13 38,6 56,6 C74,6 88,15 98,28 C88,41 74,50 56,50 C38,50 20,45 20,29 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M26,10 C38,4 52,3 64,6 C74,8.5 82,13 90,19" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M97,27 C100,22 101,17 99,12 M97,30 C100,35 101,40 99,45" fill="none" stroke={INK} strokeWidth="1.6" />
      <circle cx="84" cy="31" r="2.4" fill="none" stroke={INK} strokeWidth="1.3" />
      <Eye x={86} y={23} r={2.2} />
    </svg>
  ),
  // Slender, sharply pointed snout, small DOWNTURNED undershot mouth, light tail.
  whiting: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M14,29 C19,25 32,22 50,22 C68,22 82,24 106,29 C82,34 68,36 50,36 C32,36 19,33 14,29 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.6"
      />
      <path d="M98,27 C102,26 105,27 106,29 C105,31 102,32 98,31" fill="none" stroke={TEAL} strokeWidth="1.3" />
      <path d="M96,33 L99,38" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12,29 C9,26 8,23 9,20 M12,29 C9,32 8,35 9,38" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <Eye x={94} y={26} r={1.7} />
    </svg>
  ),
  // Robust, moderately deep body with a tall, unmistakable humped forehead
  // rising above the eye -- the classic old-man-snapper profile.
  snapper: (
    <svg viewBox="0 0 110 56" aria-hidden="true">
      <path
        d="M18,32 C19,20 28,10 40,7 C46,5.5 50,-2 58,0 C64,1.5 63,8 57,11 C70,13 84,19 98,28 C84,39 70,46 54,48 C36,50 18,46 18,32 Z"
        fill={FILL}
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M52,9 C56,4 61,2 66,3" fill="none" stroke={TEAL} strokeWidth="1.5" />
      <path d="M96,27 C100,21 101,15 99,9 M96,31 C100,37 101,43 99,49" fill="none" stroke={INK} strokeWidth="1.8" />
      <Eye x={58} y={18} r={2.4} />
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
