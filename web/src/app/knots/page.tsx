import type { Metadata } from "next";

export const metadata: Metadata = { title: "Knot guide — Bite Index" };

/* Original abstract schematics. These show the SHAPE of each knot, not every
   wrap — the steps are the instructions, the drawing is a memory aid. */

const INK = "#16232b";
const TEAL = "#0f6e73";

function Coils({ x, y, n, dx = 9 }: { x: number; y: number; n: number; dx?: number }) {
  return (
    <g stroke={INK} strokeWidth="1.6" fill="none">
      {Array.from({ length: n }).map((_, i) => (
        <path key={i} d={`M${x + i * dx} ${y - 6} a6 6 0 0 1 0 12`} />
      ))}
    </g>
  );
}

const knots = [
  {
    id: "uni",
    name: "Uni knot",
    use: "line → hook, swivel, jig · the one knot that covers a beginner's whole kit",
    steps: [
      "Thread the line through the eye and double it back so you have about 15 cm running alongside the standing line.",
      "Fold the tag end back toward the eye to form a loop sitting above the doubled line.",
      "Wrap the tag end around the doubled line and through the loop 5–6 times.",
      "Wet the knot, then pull the tag end so the coils bed down neatly.",
      "Slide the knot down against the eye by pulling the standing line, and trim the tag.",
    ],
    svg: (
      <svg viewBox="0 0 260 70" role="img" aria-label="Uni knot schematic">
        <circle cx="22" cy="35" r="9" fill="none" stroke={INK} strokeWidth="2.4" />
        <line x1="31" y1="35" x2="230" y2="35" stroke={INK} strokeWidth="1.8" />
        <line x1="31" y1="41" x2="150" y2="41" stroke={TEAL} strokeWidth="1.6" />
        <path d="M150 41 q28 -26 56 -2" fill="none" stroke={TEAL} strokeWidth="1.6" />
        <Coils x={112} y={38} n={5} />
        <text x="238" y="39" fontSize="9" fontFamily="IBM Plex Mono" fill="#51646a">main</text>
      </svg>
    ),
  },
  {
    id: "clinch",
    name: "Improved clinch",
    use: "light line → small hooks · quick to tie with cold fingers",
    steps: [
      "Pass the tag end through the eye and make 5–7 wraps up around the standing line.",
      "Bring the tag back down and through the small loop right next to the eye.",
      "Then pass it through the big loose loop you just created.",
      "Wet it and pull the standing line steadily so the wraps spiral down tight.",
      "Trim the tag close. Not for heavy leader — it slips above roughly 20 lb.",
    ],
    svg: (
      <svg viewBox="0 0 260 70" role="img" aria-label="Improved clinch knot schematic">
        <circle cx="22" cy="35" r="9" fill="none" stroke={INK} strokeWidth="2.4" />
        <line x1="31" y1="35" x2="230" y2="35" stroke={INK} strokeWidth="1.8" />
        <Coils x={60} y={35} n={6} />
        <path d="M118 32 q-42 -20 -84 -2" fill="none" stroke={TEAL} strokeWidth="1.6" />
        <path d="M36 33 q30 16 44 8" fill="none" stroke={TEAL} strokeWidth="1.6" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    id: "double_uni",
    name: "Double uni",
    use: "braid → mono/fluoro leader · the forgiving join to learn first",
    steps: [
      "Overlap the two lines by about 25 cm, tags pointing opposite ways.",
      "With one tag, tie a uni knot around the other line: loop, 5–6 wraps through (8–10 if it's thin braid), snug it up.",
      "Repeat with the other tag around the first line, wrapping the opposite direction.",
      "Wet everything, then pull the two standing lines apart so the knots slide together and jam.",
      "Trim both tags. Bulkier than an FG, but nearly impossible to get wrong.",
    ],
    svg: (
      <svg viewBox="0 0 260 70" role="img" aria-label="Double uni knot schematic">
        <line x1="10" y1="32" x2="180" y2="32" stroke={INK} strokeWidth="1.8" />
        <line x1="80" y1="40" x2="250" y2="40" stroke={TEAL} strokeWidth="1.8" />
        <Coils x={98} y={36} n={4} />
        <Coils x={150} y={36} n={4} />
        <path d="M138 20 l6 6 m-6 0 l6 -6" stroke="#51646a" strokeWidth="1.2" />
        <text x="10" y="22" fontSize="9" fontFamily="IBM Plex Mono" fill="#51646a">braid</text>
        <text x="218" y="58" fontSize="9" fontFamily="IBM Plex Mono" fill="#51646a">leader</text>
      </svg>
    ),
  },
  {
    id: "fg",
    name: "FG knot",
    use: "braid → leader when casting matters · slimmest join, flies through guides",
    steps: [
      "Keep the leader under tension (bite it, or hook it under a foot) and hold the braid at right angles to it.",
      "Weave the braid over and under the leader in alternating wraps — aim for about 20 wraps, keeping them stacked tight.",
      "Lock the wraps with two half-hitches of braid around both lines.",
      "Trim the leader tag flush, then finish with 4–5 more half-hitches over the braid and a final locking hitch.",
      "Test it hard before fishing. This one takes practice — learn it at home, not on the rocks at dawn.",
    ],
    svg: (
      <svg viewBox="0 0 260 70" role="img" aria-label="FG knot schematic">
        <line x1="10" y1="36" x2="250" y2="36" stroke={INK} strokeWidth="2.6" />
        <g stroke={TEAL} strokeWidth="1.3" fill="none">
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M${58 + i * 7} 29 l5 14`} />
          ))}
        </g>
        <path d="M156 36 q10 -14 22 0 q-12 14 -22 0" fill="none" stroke={TEAL} strokeWidth="1.3" />
        <text x="10" y="24" fontSize="9" fontFamily="IBM Plex Mono" fill="#51646a">leader</text>
        <text x="196" y="24" fontSize="9" fontFamily="IBM Plex Mono" fill="#51646a">braid weave</text>
      </svg>
    ),
  },
];

export default function KnotsPage() {
  return (
    <main className="wrap">
      <header className="hero">
        <p className="dateline">KNOT GUIDE · FOUR KNOTS COVER 95% OF SYDNEY FISHING</p>
        <h1 className="headline">Tie these four and you&apos;re set</h1>
        <p className="prose" style={{ marginTop: 12 }}>
          Learn them in this order. The drawings below are schematics of the finished shape, not wrap-by-wrap
          plans — follow the written steps, and if you want a moving picture,{" "}
          <a href="https://www.animatedknots.com/fishing-knots" rel="noopener">Animated Knots</a> shows every one
          of these in slow motion. Always wet a knot before pulling it tight: dry friction burns and weakens line.
        </p>
      </header>

      {knots.map((k) => (
        <article className="card knot" id={k.id} key={k.id}>
          <h3>{k.name}</h3>
          <p className="use">{k.use}</p>
          {k.svg}
          <ol>
            {k.steps.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
        </article>
      ))}
    </main>
  );
}
