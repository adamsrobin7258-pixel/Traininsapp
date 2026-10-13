import { useId } from 'react';
import type { SceneName } from './sceneTone';

/**
 * Atmospheric scenes for the top of a page (Phase 25): drawn inline in Kalethra's own natural
 * palette – no photo, no image request, nothing to license, works offline. Always decorative.
 * The scenes and the text tone each needs: `sceneTone.ts`.
 */
export function SceneArt({ name, className }: { name: SceneName; className?: string }) {
  const id = `scene-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      data-scene={name}
      aria-hidden="true"
      focusable="false"
    >
      {name === 'mountains' ? <Mountains id={id} /> : null}
      {name === 'harvest' ? <Harvest id={id} /> : null}
      {name === 'meadow' ? <Meadow id={id} /> : null}
    </svg>
  );
}

function Mountains({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e4934" />
          <stop offset="0.38" stopColor="#56704f" />
          <stop offset="0.7" stopColor="#c7a86c" />
          <stop offset="1" stopColor="#ecd39c" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.72" cy="0.62" r="0.42">
          <stop offset="0" stopColor="#fbecc4" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#f4d796" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f4d796" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2dfb2" stopOpacity="0" />
          <stop offset="1" stopColor="#f2dfb2" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <rect width="400" height="240" fill={`url(#${id}-sun)`} />
      <circle cx="290" cy="150" r="17" fill="#fdf1d2" opacity="0.9" />
      {/* Far ridge, mist, middle ridge, forest, near hill. */}
      <path
        d="M0 150 L38 122 L66 136 L104 96 L140 128 L176 108 L214 132 L252 100 L292 130 L330 112 L366 126 L400 104 V240 H0Z"
        fill="#8b9a72"
        opacity="0.75"
      />
      <rect y="120" width="400" height="60" fill={`url(#${id}-mist)`} />
      <path
        d="M0 172 L52 140 L92 160 L138 128 L186 158 L230 142 L268 162 L318 134 L360 156 L400 144 V240 H0Z"
        fill="#5d7756"
      />
      <path
        d="M0 196 l10-24 10 24 6-16 8 18 9-28 9 28 7-18 7 16 10-30 10 30 6-14 8 16 9-26 9 26 7-18 8 18 10-30 10 30 6-16 8 18 9-24 9 24 7-14 7 14 10-32 10 32 6-18 8 18 9-26 9 26 7-16 7 16 10-28 10 28 6-14 8 14 9-30 9 30 7-18 8 18 10-26 10 26 6-16 8 16 9-24 9 24 7-18 7 18 10-30 V240 H0Z"
        fill="#3a5640"
      />
      <path d="M0 214 C80 196 170 204 250 210 C320 215 370 204 400 198 V240 H0Z" fill="#2c4532" />
    </>
  );
}

function Harvest({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-linen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6efe2" />
          <stop offset="1" stopColor="#e9dcc3" />
        </linearGradient>
        <radialGradient id={`${id}-bowl`} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fbf7ef" />
          <stop offset="1" stopColor="#e7dcc8" />
        </radialGradient>
        <radialGradient id={`${id}-tomato`} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#f08a6a" />
          <stop offset="0.5" stopColor="#d24b32" />
          <stop offset="1" stopColor="#a8331f" />
        </radialGradient>
        <radialGradient id={`${id}-chick`} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#f3dcae" />
          <stop offset="1" stopColor="#c9a265" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#6b5530" floodOpacity="0.25" />
        </filter>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-linen)`} />
      {/* Linen weave, very faint. */}
      <g stroke="#d9c7a5" strokeWidth="0.6" opacity="0.5">
        <path d="M0 40 H400 M0 82 H400 M0 124 H400 M0 166 H400 M0 208 H400" />
        <path d="M60 0 V240 M150 0 V240 M240 0 V240 M330 0 V240" opacity="0.6" />
      </g>
      {/* Herb sprig at the lower left. */}
      <g fill="#6f9a4f">
        <path d="M18 238 C40 214 62 200 92 192" stroke="#557d3c" strokeWidth="2" fill="none" />
        <ellipse cx="44" cy="214" rx="9" ry="4.5" transform="rotate(-50 44 214)" />
        <ellipse cx="60" cy="204" rx="9" ry="4.5" transform="rotate(30 60 204)" />
        <ellipse cx="74" cy="196" rx="8" ry="4" transform="rotate(-40 74 196)" />
        <ellipse cx="88" cy="190" rx="7" ry="3.5" transform="rotate(20 88 190)" />
      </g>
      {/* Lemon wedge. */}
      <g transform="translate(150 206) rotate(-12)">
        <path d="M-22 0 A22 22 0 0 0 22 0 Z" fill="#f2d35b" />
        <path d="M-18 1 A18 18 0 0 0 18 1 Z" fill="#f8e79a" />
        <path d="M0 1 L-12 12 M0 1 L0 17 M0 1 L12 12" stroke="#f2d35b" strokeWidth="1.4" />
      </g>
      <g transform="translate(38 34)">
        {/* The bowl. */}
        <g filter={`url(#${id}-shadow)`}>
          <circle cx="300" cy="118" r="98" fill={`url(#${id}-bowl)`} />
        </g>
        <circle cx="300" cy="118" r="84" fill="#ede3d0" />
        {/* Greens. */}
        <g>
          <ellipse cx="262" cy="86" rx="34" ry="18" fill="#6c9a4a" transform="rotate(-25 262 86)" />
          <ellipse cx="330" cy="76" rx="32" ry="17" fill="#86ad5e" transform="rotate(20 330 76)" />
          <ellipse
            cx="350"
            cy="140"
            rx="30"
            ry="16"
            fill="#5a8a3f"
            transform="rotate(-35 350 140)"
          />
          <ellipse
            cx="268"
            cy="152"
            rx="30"
            ry="16"
            fill="#79a553"
            transform="rotate(30 268 152)"
          />
          <ellipse
            cx="300"
            cy="112"
            rx="26"
            ry="14"
            fill="#93b96a"
            transform="rotate(-5 300 112)"
          />
          <path
            d="M240 92 C262 84 282 88 296 98 M318 70 C330 80 340 86 356 88 M330 150 C340 140 352 132 368 130"
            stroke="#4b7a33"
            strokeWidth="1.4"
            fill="none"
            opacity="0.7"
          />
        </g>
        {/* Avocado slices. */}
        <g transform="translate(300 160) rotate(-18)">
          <ellipse rx="30" ry="12" fill="#3f6b2e" />
          <ellipse rx="27" ry="9.5" fill="#cbdc7c" />
          <ellipse rx="22" ry="6.5" fill="#e0e9a2" />
        </g>
        {/* Chickpeas. */}
        <g fill={`url(#${id}-chick)`}>
          <circle cx="236" cy="120" r="7" />
          <circle cx="248" cy="130" r="7" />
          <circle cx="232" cy="134" r="6.5" />
          <circle cx="246" cy="114" r="6" />
          <circle cx="356" cy="104" r="7" />
          <circle cx="368" cy="114" r="6.5" />
          <circle cx="352" cy="118" r="6" />
        </g>
        {/* Cherry tomatoes with a small light. */}
        <g>
          <circle cx="286" cy="66" r="11" fill={`url(#${id}-tomato)`} />
          <circle cx="318" cy="118" r="12" fill={`url(#${id}-tomato)`} />
          <circle cx="262" cy="176" r="10" fill={`url(#${id}-tomato)`} />
          <circle cx="342" cy="174" r="10.5" fill={`url(#${id}-tomato)`} />
          <path
            d="M282 57 l4 3 4-3 M314 108 l4 3 4-3"
            stroke="#4b7a33"
            strokeWidth="1.6"
            fill="none"
          />
        </g>
      </g>
    </>
  );
}

function Meadow({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3e5a44" />
          <stop offset="0.6" stopColor="#7f9a74" />
          <stop offset="1" stopColor="#c9c79a" />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="0.2" cy="0.75" r="0.5">
          <stop offset="0" stopColor="#f6e6b8" stopOpacity="0.7" />
          <stop offset="1" stopColor="#f6e6b8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <rect width="400" height="240" fill={`url(#${id}-light)`} />
      <path d="M0 170 C70 140 150 150 220 162 C290 174 350 150 400 140 V240 H0Z" fill="#6f8c64" />
      <path d="M0 196 C90 176 170 190 250 196 C320 202 370 186 400 180 V240 H0Z" fill="#4f6d4d" />
      <path d="M0 220 C100 208 200 214 300 220 C350 223 380 216 400 212 V240 H0Z" fill="#3a5640" />
      {/* A large leaf sprig at the right edge. */}
      <g transform="translate(352 238) rotate(-28)">
        <path d="M0 0 C0 -60 6 -110 16 -150" stroke="#2f4a35" strokeWidth="3" fill="none" />
        <path d="M4 -40 C-30 -50 -44 -78 -40 -96 C-20 -88 -2 -70 4 -40Z" fill="#5c7f55" />
        <path d="M8 -70 C40 -82 56 -108 54 -128 C32 -120 12 -100 8 -70Z" fill="#6f9465" />
        <path d="M12 -100 C-16 -114 -26 -138 -20 -156 C-2 -146 12 -126 12 -100Z" fill="#7fa274" />
        <path d="M16 -130 C36 -142 44 -162 40 -176 C24 -170 14 -154 16 -130Z" fill="#8fb183" />
      </g>
    </>
  );
}
