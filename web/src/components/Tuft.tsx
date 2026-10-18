// Tuft — Featherbound's mascot: a tiny, fluffy long-tailed tit (shima enaga) in a much-too-big wizard hat.
// Built from layered shapes so CSS can animate the parts (see .tuft rules in base.css).

export type TuftPose = 'hello' | 'wave' | 'read' | 'write' | 'cheer' | 'sleep' | 'think' | 'worry' | 'guard';

type Props = {
  pose?: TuftPose;
  size?: number;
  still?: boolean;
  className?: string;
  title?: string;
};

// Rounded so server and browser render identical numbers (avoids hydration mismatches).
const r2 = (n: number) => Math.round(n * 100) / 100;

// Scalloped fluff around the body: small feather tufts poking past its edge.
const FLUFF = (() => {
  const cx = 100, cy = 142, rx = 58, ry = 54, n = 28;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i === 0) { d += `M${r2(x)} ${r2(y)}`; continue; }
    const m = a - Math.PI / n, k = 1.07 + (i % 3) * 0.025;
    d += ` Q${r2(cx + Math.cos(m) * rx * k)} ${r2(cy + Math.sin(m) * ry * k)} ${r2(x)} ${r2(y)}`;
  }
  return d + 'Z';
})();

// One long, slender tail feather from (x0,y0) to (x1,y1), w wide at its middle.
function feather(x0: number, y0: number, x1: number, y1: number, w: number) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const px = (-dy / len) * w, py = (dx / len) * w;
  const mx = x0 + dx * 0.55, my = y0 + dy * 0.55;
  return `M${x0} ${y0} Q${r2(mx + px)} ${r2(my + py)} ${x1} ${y1} Q${r2(mx - px)} ${r2(my - py)} ${x0} ${y0}Z`;
}

function Star({ x, y, s = 1, fill = '#F6E3AE', className }: { x: number; y: number; s?: number; fill?: string; className?: string }) {
  return (
    <path
      className={className}
      d={`M${x} ${y - 5 * s} L${x + 1.4 * s} ${y - 1.4 * s} L${x + 5 * s} ${y} L${x + 1.4 * s} ${y + 1.4 * s} L${x} ${y + 5 * s} L${x - 1.4 * s} ${y + 1.4 * s} L${x - 5 * s} ${y} L${x - 1.4 * s} ${y - 1.4 * s} Z`}
      fill={fill}
    />
  );
}

// A wing: soft white coverts with scalloped feather tips and a dark flight-feather edge. The wing on the
// viewer's left is mirrored and smaller, so Tuft reads as turned slightly toward the right.
function Wing({ up, near }: { up: boolean; near: boolean }) {
  const place = near ? undefined : 'translate(200 0) scale(-1 1) translate(144 146) scale(0.8) translate(-144 -146)';
  return (
    <g transform={place}>
      <g transform={up ? 'rotate(-62 142 136)' : undefined}>
        <path d="M140 133 C152 135 160 146 161 160 C162 170 158 178 153 182 Q150 187 146 182 Q143 187 139 181 C136 172 135 160 136 150 C136 143 137 138 140 133 Z" fill="#3E354F" transform="translate(2.5 3.5)" />
        <path d="M140 133 C152 135 160 146 161 160 C162 170 158 178 153 182 Q150 187 146 182 Q143 187 139 181 C136 172 135 160 136 150 C136 143 137 138 140 133 Z" fill="url(#tuftWing)" />
        <path d="M139 152 Q149 149 158 156 M138 165 Q147 162 156 168" stroke="#D8CEE6" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

export default function Tuft({ pose = 'hello', size = 96, still = false, className = '', title = 'Tuft, the Featherbound bird' }: Props) {
  const wingUpLeft = pose === 'cheer';
  const wingUpRight = pose === 'wave' || pose === 'cheer';
  const eyesClosed = pose === 'sleep';
  const bigEyes = pose === 'worry';

  return (
    <svg
      className={`tuft ${still ? 'still' : ''} ${className}`}
      width={size}
      height={size * 1.1}
      viewBox="0 0 200 220"
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient id="tuftBody" cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#F8F5FB" />
          <stop offset="1" stopColor="#DCD3E8" />
        </radialGradient>
        <linearGradient id="tuftHat" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#8F68D6" />
          <stop offset="0.55" stopColor="#5E3CA0" />
          <stop offset="1" stopColor="#3D2470" />
        </linearGradient>
        <linearGradient id="tuftBrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7C56C2" />
          <stop offset="1" stopColor="#4E2F8C" />
        </linearGradient>
        <linearGradient id="tuftBand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F2CB6B" />
          <stop offset="1" stopColor="#C08F2C" />
        </linearGradient>
        <linearGradient id="tuftWing" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2DAEC" />
        </linearGradient>
        <radialGradient id="tuftBlush">
          <stop offset="0" stopColor="#F4A7B9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#F4A7B9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="tuft-body">
        {/* Long tail: alternating dark and pale feathers fanning out behind */}
        <g className="tuft-tail">
          <path d={feather(124, 164, 194, 102, 8)} fill="#E9E4F0" />
          <path d={feather(126, 168, 199, 122, 8.5)} fill="#2F2840" />
          <path d={feather(126, 173, 197, 142, 7.5)} fill="#D2C9DE" />
          <path d={feather(126, 168, 199, 122, 0.7)} fill="#6E6188" />
        </g>

        {/* Feet */}
        <g stroke="#C4955A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M88 192 v9 M82 205 L88 200 L94 205 M88 200 v5" />
          <path d="M112 192 v9 M106 205 L112 200 L118 205 M112 200 v5" />
        </g>

        {/* Fluffy body */}
        <path d={FLUFF} fill="#F1ECF7" />
        <ellipse cx="100" cy="142" rx="58" ry="54" fill="url(#tuftBody)" />

        {/* Wings */}
        <Wing up={wingUpLeft} near={false} />
        <Wing up={wingUpRight} near />

        {/* Shadow under the brim */}
        <ellipse cx="100" cy="110" rx="50" ry="9" fill="#CFC3E0" opacity="0.55" />

        {/* Face */}
        <ellipse cx="70" cy="153" rx="10" ry="6" fill="url(#tuftBlush)" />
        <ellipse cx="130" cy="153" rx="10" ry="6" fill="url(#tuftBlush)" />
        {eyesClosed ? (
          <>
            <path d="M77 141 q7 6 14 0" stroke="#1E1A26" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M109 141 q7 6 14 0" stroke="#1E1A26" strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <g className="tuft-eye">
              <circle cx="84" cy="140" r={bigEyes ? 7.8 : 6.6} fill="#1E1A26" />
              <circle cx="81.8" cy="137.4" r="2.3" fill="#fff" />
              <circle cx="86.2" cy="142.6" r="0.9" fill="#fff" opacity="0.8" />
            </g>
            <g className="tuft-eye">
              <circle cx="116" cy="140" r={bigEyes ? 7.8 : 6.6} fill="#1E1A26" />
              <circle cx="113.8" cy="137.4" r="2.3" fill="#fff" />
              <circle cx="118.2" cy="142.6" r="0.9" fill="#fff" opacity="0.8" />
            </g>
          </>
        )}
        {bigEyes && (
          <>
            <path d="M76 128 l12 -3 M124 128 l-12 -3" stroke="#5E5373" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M146 118 q4 8 0 11 q-4 -3 0 -11z" fill="#9CC7EE" />
          </>
        )}
        {/* Beak */}
        <path d="M94.5 147 Q100 144 105.5 147 Q102.5 153 100 156 Q97.5 153 94.5 147 Z" fill="#2A2433" />
        <path d="M97 147.4 Q100 146.2 102 147.2" stroke="#6E6188" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {pose === 'cheer' && <path d="M96 157 q4 5 8 0" stroke="#2A2433" strokeWidth="1.8" fill="#E57A8F" />}

        {/* Hat (much too big): brim, cone with one floppy tip, gold band */}
        <g transform="rotate(-6 100 100)"><g className="tuft-hat">
          <ellipse cx="100" cy="104" rx="67" ry="17" fill="#3D2470" />
          <ellipse cx="100" cy="100" rx="67" ry="16" fill="url(#tuftBrim)" />
          <path
            d="M64 100 C68 76 78 52 94 36 C102 28 114 22 125 24 C138 27 150 38 157 50 Q161 57 161 65 Q153 54 137 50 C133 58 134 68 136 80 C137 88 138 94 138 100 Q101 108 64 100 Z"
            fill="url(#tuftHat)"
          />
          <path d="M72 92 C76 72 84 54 96 41" stroke="#A98AE0" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
          <path d="M65 91 Q101 99 137 91 L138 100 Q101 108 64 100 Z" fill="url(#tuftBand)" />
          <Star x={90} y={70} s={1.4} />
          <Star x={112} y={50} s={1} />
          <Star x={122} y={78} s={1.15} />
          <Star x={145} y={44} s={0.7} />
          <circle cx="102" cy="84" r="1.6" fill="#F6E3AE" />
          <circle cx="80" cy="84" r="1.3" fill="#F6E3AE" />
          <circle cx="106" cy="34" r="1.2" fill="#F6E3AE" />
        </g></g>

        {/* Pose props */}
        {pose === 'read' && (
          <g>
            <path d="M56 168 Q78 158 100 168 L100 200 Q78 190 56 200 Z" fill="#FFFDF7" stroke="#4B2E83" strokeWidth="3" strokeLinejoin="round" />
            <path d="M144 168 Q122 158 100 168 L100 200 Q122 190 144 200 Z" fill="#FFFDF7" stroke="#4B2E83" strokeWidth="3" strokeLinejoin="round" />
            <path d="M66 174 q14 -5 26 0 M66 181 q14 -5 26 0 M66 188 q10 -4 18 0 M108 174 q14 -5 26 0 M108 181 q14 -5 26 0" stroke="#D9CFE6" strokeWidth="2" fill="none" />
            <Star x={124} y={190} s={0.8} fill="#D4A23A" />
          </g>
        )}
        {pose === 'write' && (
          <g className="tuft-quill">
            <path d="M150 178 C160 150 172 128 186 112 C182 130 172 152 156 176 Z" fill="#fff" stroke="#D4A23A" strokeWidth="2.5" />
            <path d="M152 180 L186 112" stroke="#D4A23A" strokeWidth="2" />
            <circle cx="150" cy="182" r="2.5" fill="#2E1B55" />
          </g>
        )}
        {pose === 'guard' && (
          <g>
            <rect x="80" y="166" width="40" height="32" rx="7" fill="#D4A23A" stroke="#9C6F12" strokeWidth="2.5" />
            <path d="M88 166 v-8 a12 12 0 0 1 24 0 v8" stroke="#9C6F12" strokeWidth="5" fill="none" />
            <circle cx="100" cy="180" r="4" fill="#2E1B55" />
            <rect x="98" y="182" width="4" height="8" rx="2" fill="#2E1B55" />
          </g>
        )}
        {pose === 'think' && (
          <g>
            <circle cx="164" cy="96" r="4" fill="#D9CFE6" />
            <circle cx="174" cy="82" r="6" fill="#D9CFE6" />
            <circle cx="186" cy="64" r="9" fill="#D9CFE6" />
          </g>
        )}
        {pose === 'sleep' && (
          <g fill="#7A54C4" fontFamily="Fraunces, serif" fontWeight="700">
            <text x="160" y="96" fontSize="20">z</text>
            <text x="174" y="78" fontSize="15">z</text>
            <text x="185" y="64" fontSize="11">z</text>
          </g>
        )}
      </g>

      {(pose === 'cheer' || pose === 'write') && (
        <g>
          <Star className="tuft-spark" x={24} y={70} s={1.4} fill="#D4A23A" />
          <Star className="tuft-spark" x={180} y={104} s={1.1} fill="#B9A5E3" />
          <Star className="tuft-spark" x={22} y={180} s={1} fill="#F6B8C6" />
        </g>
      )}
    </svg>
  );
}
