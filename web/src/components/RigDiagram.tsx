/* Original stylised rig schematics — deliberately simple, labelled, and ours
   (nothing traced or copied from existing tackle diagrams). */

const INK = "#16232b";
const TEAL = "#0f6e73";
const SOFT = "#51646a";

function Label({ x, y, children, anchor = "start" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fill={SOFT} textAnchor={anchor}>
      {children}
    </text>
  );
}

function Hook({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x},${y} v14 a8,8 0 1 0 12,-6 l-3,4`}
      fill="none"
      stroke={INK}
      strokeWidth="2"
      strokeLinecap="round"
    />
  );
}

function Swivel({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeWidth="1.6" fill="none">
      <circle cx={x} cy={y - 4} r="3.4" />
      <circle cx={x} cy={y + 4} r="3.4" />
    </g>
  );
}

const diagrams: Record<string, { caption: string; svg: React.ReactNode }> = {
  running_sinker: {
    caption: "Running sinker rig",
    svg: (
      <svg viewBox="0 0 150 170">
        <line x1="60" y1="6" x2="60" y2="60" stroke={INK} strokeWidth="1.6" />
        <circle cx="60" cy="34" r="8" fill={SOFT} />
        <path d="M60 22 l0 -6 M57 19 l3 -3 3 3" stroke={INK} strokeWidth="1.2" fill="none" />
        <Swivel x={60} y={68} />
        <line x1="60" y1="76" x2="60" y2="122" stroke={TEAL} strokeWidth="1.6" />
        <Hook x={60} y={122} />
        <Label x={72} y={36}>ball sinker</Label>
        <Label x={72} y={20}>runs free</Label>
        <Label x={72} y={70}>swivel</Label>
        <Label x={72} y={100}>leader</Label>
        <Label x={78} y={140}>hook</Label>
      </svg>
    ),
  },
  paternoster: {
    caption: "Paternoster (dropper) rig",
    svg: (
      <svg viewBox="0 0 150 170">
        <line x1="45" y1="6" x2="45" y2="140" stroke={INK} strokeWidth="1.6" />
        <path d="M45 46 h22" stroke={TEAL} strokeWidth="1.4" fill="none" />
        <Hook x={67} y={46} />
        <path d="M45 92 h22" stroke={TEAL} strokeWidth="1.4" fill="none" />
        <Hook x={67} y={92} />
        <path d="M45 140 q-8 4 -8 12 q0 10 8 12 q8 -2 8 -12 q0 -8 -8 -12z" fill={SOFT} />
        <Label x={50} y={40}>dropper</Label>
        <Label x={50} y={86}>dropper</Label>
        <Label x={58} y={158}>sinker on bottom</Label>
      </svg>
    ),
  },
  livebait_float: {
    caption: "Live bait under a float",
    svg: (
      <svg viewBox="0 0 150 170">
        <line x1="60" y1="4" x2="60" y2="26" stroke={INK} strokeWidth="1.6" />
        <ellipse cx="60" cy="40" rx="9" ry="15" fill="none" stroke={INK} strokeWidth="2" />
        <line x1="60" y1="55" x2="60" y2="78" stroke={INK} strokeWidth="1.6" />
        <Swivel x={60} y={86} />
        <line x1="60" y1="94" x2="60" y2="120" stroke={TEAL} strokeWidth="1.6" />
        <Hook x={60} y={120} />
        <path d="M52 152 q10 -8 22 0 q-10 8 -22 0z M74 152 l7 -4 v8 z" fill="none" stroke={SOFT} strokeWidth="1.4" />
        <Label x={74} y={42}>float</Label>
        <Label x={74} y={88}>swivel</Label>
        <Label x={74} y={108}>leader</Label>
        <Label x={64} y={166} anchor="middle">livie pinned near hook</Label>
      </svg>
    ),
  },
  squid_jig: {
    caption: "Squid jig, tied direct",
    svg: (
      <svg viewBox="0 0 150 170">
        <line x1="60" y1="6" x2="60" y2="58" stroke={TEAL} strokeWidth="1.6" />
        <path d="M60 58 q-14 10 -10 34 q4 22 10 26 q6 -4 10 -26 q4 -24 -10 -34z" fill="none" stroke={INK} strokeWidth="2" />
        <path d="M52 118 l-5 9 M56 121 l-3 10 M64 121 l3 10 M68 118 l5 9" stroke={INK} strokeWidth="1.4" />
        <circle cx="56" cy="76" r="2" fill={INK} />
        <Label x={74} y={30}>leader, tied direct</Label>
        <Label x={74} y={92}>2.5–3.5 jig</Label>
        <Label x={64} y={150} anchor="middle">spikes, no hook</Label>
      </svg>
    ),
  },
  float_rig: {
    caption: "Light float rig",
    svg: (
      <svg viewBox="0 0 150 170">
        <line x1="60" y1="4" x2="60" y2="30" stroke={INK} strokeWidth="1.4" />
        <ellipse cx="60" cy="42" rx="7" ry="12" fill="none" stroke={INK} strokeWidth="1.8" />
        <line x1="60" y1="54" x2="60" y2="104" stroke={INK} strokeWidth="1.4" />
        <circle cx="60" cy="80" r="3.4" fill={SOFT} />
        <Hook x={60} y={104} />
        <Label x={72} y={44}>small float</Label>
        <Label x={72} y={83}>split shot</Label>
        <Label x={76} y={122}>size 8–12 hook</Label>
      </svg>
    ),
  },
};

export default function RigDiagram({ id }: { id: string }) {
  const d = diagrams[id];
  if (!d) return null;
  return (
    <figure className="rig-fig">
      {d.svg}
      <figcaption>{d.caption}</figcaption>
    </figure>
  );
}
