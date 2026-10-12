/**
 * Kalethra brand geometry – the single source of the symbol and the wordmark (own drawing, no
 * external template). Pure: numbers in, SVG path data out. Used by `build.mjs` (SVG, TS,
 * Android vector) and `render.mjs` (raster images for the platforms).
 *
 * The symbol is an abstract human figure in a forward step with a raised, reaching arm: body and
 * back leg form one upright stroke, arm and front leg branch from it – together they read as the
 * "K" of Kalethra. Shapes are filled outlines (no strokes), so they render the same everywhere,
 * from a 16 px favicon to the 1024 px store icon.
 */

/** Symbol design grid: 48 × 48, content optically centred. */
export const SYMBOL_SIZE = 48;

const round = (value) => {
  const r = Math.round(value * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

/** Closed smooth path through points (uniform Catmull-Rom → cubic Bézier). */
function spline(points, tension = 1) {
  const n = points.length;
  const at = (i) => points[(i + n) % n];
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const k = tension / 6;
    d += `C${round(p1[0] + (p2[0] - p0[0]) * k)} ${round(p1[1] + (p2[1] - p0[1]) * k)} ${round(
      p2[0] - (p3[0] - p1[0]) * k,
    )} ${round(p2[1] - (p3[1] - p1[1]) * k)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * A tapered limb along a quadratic curve a → c → b, width w0 at a and w1 at b, with round ends.
 */
function limb(a, c, b, w0, w1, steps = 10) {
  return spline(limbOutline(a, c, b, w0, w1, steps));
}

function limbOutline(a, c, b, w0, w1, steps) {
  const point = (t) => [
    (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0],
    (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1],
  ];
  const tangent = (t) => {
    const x = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const y = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const l = Math.hypot(x, y);
    return [x / l, y / l];
  };
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = point(t);
    const [tx, ty] = tangent(t);
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push([x - ty * w, y + tx * w]);
    right.push([x + ty * w, y - tx * w]);
  }
  const cap = (centre, dir, w, from) => {
    const out = [];
    for (let i = 1; i < 4; i++) {
      const angle = from + (Math.PI * i) / 4;
      const [tx, ty] = dir;
      // Rotate the normal around the tangent: half circle beyond the end.
      const nx = -ty;
      const ny = tx;
      out.push([
        centre[0] + (nx * Math.cos(angle) + tx * Math.sin(angle)) * w,
        centre[1] + (ny * Math.cos(angle) + ty * Math.sin(angle)) * w,
      ]);
    }
    return out;
  };
  const end = cap(point(1), tangent(1), w1 / 2, 0);
  const start = cap(
    point(0),
    tangent(0).map((v) => -v),
    w0 / 2,
    0,
  );
  return [...left, ...end, ...right.reverse(), ...start];
}

function circle(cx, cy, r) {
  return `M${round(cx - r)} ${round(cy)}a${round(r)} ${round(r)} 0 1 0 ${round(2 * r)} 0a${round(
    r,
  )} ${round(r)} 0 1 0 ${round(-2 * r)} 0Z`;
}

/**
 * The figure as drawn (before centring): head, body with back leg, reaching arm, stepping leg.
 * Arm and leg start just clear of the body – the small gaps keep the "K" open and give the
 * figure its rhythm.
 */
const HEAD = { cx: 28.6, cy: 8.4, r: 4.3 };
const LIMBS = {
  body: [[25, 16], [22.4, 29.5], [20, 43.6], 6.8, 4.6],
  arm: [[28.6, 25.8], [33.2, 19.4], [40.6, 14.6], 4.6, 3.2],
  leg: [[28.4, 31.6], [33.6, 35.6], [37.2, 43.6], 5, 4],
};

/** Offset that centres the figure's bounds in the 48 × 48 grid (optical centre = geometric). */
const OFFSET = (() => {
  const points = Object.values(LIMBS).flatMap(([a, c, b, w0, w1]) =>
    limbOutline(a, c, b, w0, w1, 10),
  );
  const xs = [...points.map((p) => p[0]), HEAD.cx - HEAD.r, HEAD.cx + HEAD.r];
  const ys = [...points.map((p) => p[1]), HEAD.cy - HEAD.r, HEAD.cy + HEAD.r];
  return [
    SYMBOL_SIZE / 2 - (Math.min(...xs) + Math.max(...xs)) / 2,
    SYMBOL_SIZE / 2 - (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
})();

const shift = ([x, y]) => [x + OFFSET[0], y + OFFSET[1]];

/** The four parts of the symbol, each one closed shape, centred in the 48 × 48 grid. */
export const SYMBOL_PARTS = {
  head: circle(HEAD.cx + OFFSET[0], HEAD.cy + OFFSET[1], HEAD.r),
  ...Object.fromEntries(
    Object.entries(LIMBS).map(([name, [a, c, b, w0, w1]]) => [
      name,
      limb(shift(a), shift(c), shift(b), w0, w1),
    ]),
  ),
};

export const SYMBOL_PATH = Object.values(SYMBOL_PARTS).join('');

// ── Wordmark ─────────────────────────────────────────────────────────────────
// "Kalethra" in calm, geometric monoline letters (own construction from lines and arcs, no
// font). Baseline y = 20, x-height 10, ascender 14; drawn as strokes of WORDMARK_STROKE with
// round ends. The K echoes the symbol: upright stem, open diagonals.

export const WORDMARK_STROKE = 1.7;
const TRACKING = 2.9;

const letters = {
  K: {
    width: 8.4,
    d: (x) => `M${x} 6V20M${x + 8.2} 6.4L${x + 2.4} 13.2M${x + 3.6} 12L${x + 8.4} 20`,
  },
  a: {
    width: 10,
    d: (x) => `M${x} 15a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M${x + 10} 10V20`,
  },
  l: { width: 0, d: (x) => `M${x} 6V20` },
  e: {
    width: 10,
    d: (x) => `M${x} 15H${x + 10}A5 5 0 1 0 ${round(x + 8.54)} 18.54`,
  },
  t: { width: 4.6, d: (x) => `M${x + 1.4} 7V17.4Q${x + 1.4} 20 ${x + 4.6} 20M${x} 10H${x + 4.4}` },
  h: { width: 9, d: (x) => `M${x} 6V20M${x} 14.6a4.5 4.5 0 0 1 9 0V20` },
  r: { width: 5.6, d: (x) => `M${x} 10V20M${x} 15a5 5 0 0 1 5.6 -4.95` },
};

/** Wordmark path data and its bounds (stroke included). */
export const WORDMARK = (() => {
  let x = 0;
  const parts = [];
  for (const char of 'Kalethra') {
    const letter = letters[char];
    parts.push(letter.d(x));
    x += letter.width + TRACKING;
  }
  const width = x - TRACKING;
  const pad = WORDMARK_STROKE / 2;
  return {
    d: parts.join(''),
    viewBox: [-pad, 6 - pad, round(width + 2 * pad), round(14 + 2 * pad)].map(String).join(' '),
    width: width + 2 * pad,
    height: 14 + 2 * pad,
  };
})();
