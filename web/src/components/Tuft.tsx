// Tuft — Featherbound's mascot: the softest white puffball bird in a much-too-big wizard hat.

export type TuftPose = 'hello' | 'wave' | 'read' | 'write' | 'cheer' | 'sleep' | 'think' | 'worry' | 'guard';

type Props = {
  pose?: TuftPose;
  size?: number;
  still?: boolean;
  className?: string;
  title?: string;
};

const FUZZ = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  // Rounded so server and browser render identical numbers (avoids hydration mismatches).
  return { cx: Math.round((100 + Math.cos(a) * 56) * 100) / 100, cy: Math.round((146 + Math.sin(a) * 49) * 100) / 100, r: 9 + (i % 3) };
});

function Star({ x, y, s = 1, fill = '#F6E3AE', className }: { x: number; y: number; s?: number; fill?: string; className?: string }) {
  return (
    <path
      className={className}
      d={`M${x} ${y - 5 * s} L${x + 1.4 * s} ${y - 1.4 * s} L${x + 5 * s} ${y} L${x + 1.4 * s} ${y + 1.4 * s} L${x} ${y + 5 * s} L${x - 1.4 * s} ${y + 1.4 * s} L${x - 5 * s} ${y} L${x - 1.4 * s} ${y - 1.4 * s} Z`}
      fill={fill}
    />
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
        <radialGradient id="tuftBody" cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.65" stopColor="#FBF8FD" />
          <stop offset="1" stopColor="#E9E2F1" />
        </radialGradient>
        <linearGradient id="tuftHat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B63D1" />
          <stop offset="1" stopColor="#4B2E83" />
        </linearGradient>
        <linearGradient id="tuftWing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFE9F5" />
          <stop offset="0.7" stopColor="#D9CFE6" />
          <stop offset="1" stopColor="#5E5373" />
        </linearGradient>
      </defs>

      <g className="tuft-body">
        {/* Long tail */}
        <path d="M124 156 Q158 176 194 206 Q192 214 182 214 Q150 196 120 176 Z" fill="#3A3048" />
        <path d="M128 160 Q160 180 190 207" stroke="#F4EFF8" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M150 178 l8 -6 M162 188 l8 -6 M174 198 l7 -5" stroke="#6E6188" strokeWidth="2" strokeLinecap="round" />

        {/* Feet */}
        <path d="M88 192 v8 M83 200 h10 M112 192 v8 M107 200 h10" stroke="#C99A5B" strokeWidth="3.5" strokeLinecap="round" />

        {/* Fluffy body */}
        {FUZZ.map((f, i) => (
          <circle key={i} cx={f.cx} cy={f.cy} r={f.r} fill="#F4EFF8" />
        ))}
        <ellipse cx="100" cy="146" rx="57" ry="50" fill="url(#tuftBody)" />
        <path d="M70 120 q8 -6 14 -2 M118 116 q8 -4 13 3" stroke="#E6DEEF" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Wings */}
        <g transform={wingUpLeft ? 'rotate(42 60 132)' : 'rotate(14 50 150)'}>
          <ellipse cx="50" cy="152" rx="15" ry="27" fill="url(#tuftWing)" />
        </g>
        <g transform={wingUpRight ? 'rotate(-42 140 132)' : 'rotate(-14 150 150)'}>
          <ellipse cx="150" cy="152" rx="15" ry="27" fill="url(#tuftWing)" />
        </g>

        {/* Face */}
        <ellipse cx="72" cy="155" rx="8" ry="4.5" fill="#F6B8C6" opacity="0.75" />
        <ellipse cx="128" cy="155" rx="8" ry="4.5" fill="#F6B8C6" opacity="0.75" />
        {eyesClosed ? (
          <>
            <path d="M78 143 q6 5 12 0" stroke="#1E1A26" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M110 143 q6 5 12 0" stroke="#1E1A26" strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <g className="tuft-eye">
              <circle cx="84" cy="142" r={bigEyes ? 7.5 : 6.2} fill="#1E1A26" />
              <circle cx="82" cy="139.5" r="2" fill="#fff" />
            </g>
            <g className="tuft-eye">
              <circle cx="116" cy="142" r={bigEyes ? 7.5 : 6.2} fill="#1E1A26" />
              <circle cx="114" cy="139.5" r="2" fill="#fff" />
            </g>
          </>
        )}
        {bigEyes && (
          <>
            <path d="M76 130 l12 -3 M124 130 l-12 -3" stroke="#5E5373" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M146 118 q4 8 0 11 q-4 -3 0 -11z" fill="#9CC7EE" />
          </>
        )}
        <path d={pose === 'cheer' ? 'M94 150 h12 l-6 8 z' : 'M95.5 150 h9 l-4.5 6.5 z'} fill="#2A2433" />
        {pose === 'cheer' && <path d="M95 158 q5 5 10 0" stroke="#2A2433" strokeWidth="2" fill="#E57A8F" />}

        {/* Hat (much too big) */}
        <g className="tuft-hat" transform="rotate(-7 100 104)">
          <path
            d="M46 106 C56 74 74 36 108 14 C120 6 140 6 152 18 C146 22 140 26 136 34 C140 30 146 30 150 34 C138 40 132 48 134 60 C140 78 148 92 154 106 Z"
            fill="url(#tuftHat)"
          />
          <path d="M150 18 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0" fill="#F2C35C" />
          <ellipse cx="100" cy="106" rx="68" ry="13" fill="#3D2470" />
          <path d="M48 101 C78 92 122 92 152 101 L153 108 C122 99 78 99 47 108 Z" fill="#D4A23A" />
          <Star x={88} y={64} s={1.3} />
          <Star x={114} y={50} s={0.9} />
          <Star x={122} y={80} s={1.1} />
          <circle cx="100" cy="84" r="1.6" fill="#F6E3AE" />
          <circle cx="76" cy="86" r="1.3" fill="#F6E3AE" />
        </g>

        {/* Pose props */}
        {pose === 'read' && (
          <g>
            <path d="M58 170 Q80 160 100 170 L100 200 Q80 190 58 200 Z" fill="#FFFDF7" stroke="#B23A52" strokeWidth="3" strokeLinejoin="round" />
            <path d="M142 170 Q120 160 100 170 L100 200 Q120 190 142 200 Z" fill="#FFFDF7" stroke="#B23A52" strokeWidth="3" strokeLinejoin="round" />
            <path d="M68 176 q14 -5 26 0 M68 183 q14 -5 26 0 M106 176 q14 -5 26 0 M106 183 q14 -5 26 0" stroke="#D9CFE6" strokeWidth="2" fill="none" />
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
            <circle cx="160" cy="92" r="4" fill="#D9CFE6" />
            <circle cx="170" cy="78" r="6" fill="#D9CFE6" />
            <circle cx="182" cy="60" r="9" fill="#D9CFE6" />
          </g>
        )}
        {pose === 'sleep' && (
          <g fill="#7A54C4" fontFamily="Fraunces, serif" fontWeight="700">
            <text x="150" y="80" fontSize="20">z</text>
            <text x="164" y="62" fontSize="15">z</text>
            <text x="175" y="48" fontSize="11">z</text>
          </g>
        )}
      </g>

      {(pose === 'cheer' || pose === 'write') && (
        <g>
          <Star className="tuft-spark" x={28} y={70} s={1.4} fill="#D4A23A" />
          <Star className="tuft-spark" x={176} y={150} s={1.1} fill="#B9A5E3" />
          <Star className="tuft-spark" x={22} y={180} s={1} fill="#F6B8C6" />
        </g>
      )}
    </svg>
  );
}
