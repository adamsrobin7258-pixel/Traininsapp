/**
 * Kalethra muscle maps – generator for the four bundled SVGs (male/female × front/back).
 *
 *   node tools/muscle-maps/build.mjs            writes src/modules/training/muscleMap/svg/*.svg
 *   OUT=<dir> node tools/muscle-maps/build.mjs  writes elsewhere
 *
 * Own drawing, no external source: every shape is a list of support points on the viewer's left
 * half of the figure (dx = distance from the centre line, y = height from the top), smoothed with
 * a closed Catmull-Rom spline and mirrored to the other side. The female body is the same drawing
 * with female proportions (shoulders, waist, hips, thighs) applied as a smooth width transform, so
 * both bodies carry exactly the same regions – the stable muscle ids – by construction.
 *
 * Output is deterministic (same input → byte-identical files). Colours in the files are only a
 * fallback for viewing them on their own; the app overrides them with its theme tokens.
 *
 * Each muscle region is `<path data-region="<id>" data-side="left|right">`. Which muscle group a
 * region belongs to is defined in the app (`src/modules/training/muscleMap/regions.ts`), not here.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.env.OUT ?? join(ROOT, 'src/modules/training/muscleMap/svg');

const WIDTH = 160;
const HEIGHT = 420;
const CX = WIDTH / 2;

// ── Geometry helpers ─────────────────────────────────────────────────────────

const round = (value) => {
  const r = Math.round(value * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

/**
 * Smooth path through points (centripetal-free uniform Catmull-Rom → cubic Bézier). `tension`
 * 1 is the classic spline, smaller is tighter.
 */
function spline(points, closed, tension = 0.85) {
  const n = points.length;
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 6;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** A shape on the centre line: its half outline (top centre → bottom centre) and the mirror. */
const symmetric = (half) => [
  ...half,
  ...half
    .slice(1, -1)
    .reverse()
    .map(([dx, y]) => [-dx, y]),
];

// ── Female proportions ───────────────────────────────────────────────────────

/** Piecewise-linear table lookup (y → factor), flat outside the table. */
function lookup(table, y) {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    const [y0, v0] = table[i - 1];
    if (y <= y1) return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
  }
  return table[table.length - 1][1];
}

/** Width of the trunk at a height, relative to the male drawing. */
const FEMALE_TRUNK = [
  [40, 0.95],
  [66, 0.92],
  [80, 0.88],
  [104, 0.88],
  [126, 0.9],
  [148, 0.86],
  [166, 0.84],
  [182, 0.95],
  [196, 1.07],
  [212, 1.11],
];
/** Width of the legs (about the centre line): fuller hips and thighs, finer calves. */
const FEMALE_LEG = [
  [196, 1.07],
  [214, 1.11],
  [240, 1.09],
  [270, 1.04],
  [300, 0.99],
  [340, 0.95],
  [410, 0.93],
];
/** The arm hangs from the narrower shoulder and is a little finer. */
const SHOULDER_JOINT = 46;
const FEMALE_SHOULDER = 0.88;
const FEMALE_ARM = 0.92;

const transforms = {
  male: () => (point) => point,
  female: (part) => {
    if (part === 'arm')
      return ([dx, y]) => [
        SHOULDER_JOINT * FEMALE_SHOULDER + (dx - SHOULDER_JOINT) * FEMALE_ARM,
        y,
      ];
    if (part === 'leg') return ([dx, y]) => [dx * lookup(FEMALE_LEG, y), y];
    if (part === 'head') return ([dx, y]) => [dx * 0.95, y];
    return ([dx, y]) => [dx * lookup(FEMALE_TRUNK, y), y];
  },
};

// ── The drawing ──────────────────────────────────────────────────────────────
// All points are [dx, y] on the viewer's left half. `part` decides the female transform.

const HEAD = [
  [0, 10],
  [9, 11.5],
  [15.5, 17],
  [18.5, 27],
  [18.5, 38],
  [17, 47],
  [14.5, 54],
  [10, 59.5],
  [4.5, 62.5],
  [0, 63.5],
];
const EAR = [
  [17.5, 33],
  [20.5, 34],
  [21.3, 39.5],
  [20, 46],
  [17.5, 47],
];
const NECK = [
  [0, 52],
  [11, 53],
  [11.5, 62],
  [13, 70],
  [16, 74],
  [0, 77],
];
const TRUNK = [
  [0, 70],
  [12, 67],
  [17, 71.5],
  [25, 75],
  [35, 78.5],
  [43, 82],
  [47, 88],
  [46, 98],
  [41.5, 110],
  [40, 120],
  [38.8, 132],
  [36.5, 146],
  [33, 158],
  [31.2, 168],
  [32, 180],
  [34.5, 192],
  [36, 203],
  [30, 208],
  [16, 212],
  [6, 215],
  [0, 216],
];
const ARM = [
  [44, 84],
  [50, 88],
  [55, 96],
  [57.5, 108],
  [59, 122],
  [60.5, 138],
  [62, 152],
  [64, 162],
  [67.5, 172],
  [69, 186],
  [68.5, 200],
  [68.5, 210],
  [71.5, 216],
  [74.5, 222],
  [75.5, 229],
  [73.5, 234],
  [72.5, 240],
  [71.5, 248],
  [69, 254],
  [65.5, 255.5],
  [62.5, 251],
  [60.5, 241],
  [59.5, 228],
  [60, 214],
  [58.5, 204],
  [55.5, 192],
  [52, 178],
  [50, 166],
  [49, 156],
  [46.5, 144],
  [44, 130],
  [42, 116],
  [41, 104],
];
const LEG = [
  [6, 210],
  [18, 206],
  [33, 200],
  [37.5, 212],
  [38, 228],
  [36.5, 248],
  [33.5, 268],
  [30, 286],
  [28.5, 298],
  [29, 306],
  [31, 318],
  [31.5, 332],
  [29.5, 350],
  [26, 366],
  [23.5, 380],
  [24, 388],
  [27, 398],
  [27.5, 405],
  [24, 409],
  [14, 409],
  [11.5, 404],
  [12, 394],
  [14, 386],
  [13.5, 372],
  [12, 355],
  [11, 338],
  [12, 322],
  [14.5, 310],
  [15, 300],
  [13.5, 288],
  [11, 272],
  [8, 252],
  [5, 232],
  [3, 220],
];

const HAIR = {
  male: {
    front: [
      [0, 9],
      [10, 10.5],
      [16, 16],
      [18.8, 26],
      [18.2, 31],
      [16.5, 23],
      [12.5, 17.5],
      [6, 15.5],
      [0, 15],
    ],
    back: [
      [0, 9],
      [10, 10.5],
      [16, 16],
      [18.8, 26],
      [18.6, 37],
      [16.5, 45],
      [11, 49.5],
      [5, 51],
      [0, 51.5],
    ],
  },
  female: {
    front: [
      [0, 7.5],
      [11, 9],
      [18, 15.5],
      [21, 26],
      [21.5, 40],
      [20.5, 52],
      [17.5, 50],
      [17.6, 36],
      [16.8, 24],
      [11.5, 16.5],
      [4, 14.5],
      [0, 15.5],
    ],
    back: [
      [0, 7.5],
      [11, 9],
      [18, 15.5],
      [21, 26],
      [21.5, 40],
      [19.5, 50],
      [13, 56],
      [5, 58],
      [0, 58.5],
    ],
  },
};
/** Low bun of the female hair (back view), centred. */
const BUN = [
  [0, 50],
  [5.5, 51.5],
  [7.5, 56],
  [5.5, 61],
  [0, 62.5],
];

/** Muscle regions per view, in painting order (deeper first). */
const MUSCLES = {
  front: [
    {
      id: 'serratus-anterior',
      part: 'trunk',
      pts: [
        [29, 120],
        [34, 117],
        [37.8, 119],
        [38, 128],
        [36.5, 138],
        [33, 141],
        [28, 136],
        [27.5, 128],
      ],
    },
    {
      id: 'latissimus-dorsi',
      part: 'trunk',
      pts: [
        [38.6, 112],
        [41, 114],
        [40.4, 126],
        [38.8, 138],
        [37, 146],
        [36.4, 137],
        [37.6, 125],
      ],
    },
    {
      id: 'external-oblique',
      part: 'trunk',
      pts: [
        [15.5, 139],
        [22, 135],
        [28.5, 137],
        [33.5, 141],
        [35.5, 148],
        [33.5, 158],
        [31.6, 168],
        [32, 180],
        [32.5, 187],
        [29, 193],
        [22, 200],
        [14, 206],
        [11.6, 199],
        [13.5, 186],
        [15, 170],
        [15.5, 154],
      ],
    },
    {
      id: 'rectus-abdominis',
      part: 'trunk',
      pts: [
        [1.5, 131],
        [8, 129.5],
        [13, 131],
        [14, 142],
        [13.8, 155],
        [13.2, 168],
        [12, 182],
        [9.5, 196],
        [5.5, 206],
        [1.5, 209],
      ],
    },
    {
      id: 'pectoralis-major',
      part: 'trunk',
      pts: [
        [2.5, 84],
        [12, 81],
        [22, 80],
        [31, 81.5],
        [38, 86],
        [42.5, 94],
        [44.5, 101],
        [41, 106],
        [37, 112],
        [31, 119],
        [24, 124.5],
        [15, 127.8],
        [7, 127.5],
        [2.5, 123],
      ],
    },
    {
      id: 'trapezius',
      part: 'trunk',
      pts: [
        [12.5, 66],
        [16, 71],
        [24, 74.5],
        [34, 78.5],
        [26, 79.8],
        [17, 78.4],
        [13, 74],
      ],
    },
    {
      id: 'triceps-brachii',
      part: 'arm',
      pts: [
        [42.5, 112],
        [46, 118],
        [46.5, 130],
        [48.5, 144],
        [50.5, 156],
        [49, 158.5],
        [46.5, 148],
        [44, 134],
        [42.4, 122],
      ],
    },
    {
      id: 'brachialis',
      part: 'arm',
      pts: [
        [57.5, 138],
        [60.2, 146],
        [61.6, 155],
        [61.2, 162],
        [57.6, 162.5],
        [58.6, 152],
      ],
    },
    {
      id: 'biceps-brachii',
      part: 'arm',
      pts: [
        [47, 116],
        [51.5, 118],
        [55.5, 126],
        [57.5, 138],
        [58, 150],
        [57, 159],
        [54, 163.5],
        [51.5, 157],
        [49.5, 146],
        [47.5, 134],
        [46.2, 124],
      ],
    },
    {
      id: 'deltoid-anterior',
      part: 'arm',
      pts: [
        [33, 81],
        [39, 80],
        [45, 82.5],
        [48.5, 90],
        [50.4, 100],
        [51.4, 112],
        [52, 126],
        [48.6, 118],
        [45.4, 108],
        [42, 98],
        [38, 90],
      ],
    },
    {
      id: 'deltoid-lateral',
      part: 'arm',
      pts: [
        [45, 82.5],
        [49.5, 85.5],
        [54, 92],
        [56.8, 102],
        [57.4, 113],
        [55.4, 122],
        [52, 126],
        [51.4, 112],
        [50.4, 100],
        [48.5, 90],
      ],
    },
    {
      id: 'forearm-flexors',
      part: 'arm',
      pts: [
        [51, 166],
        [55, 164.5],
        [58, 166.5],
        [60.5, 176],
        [62.5, 188],
        [64.5, 200],
        [64.5, 208],
        [61, 208.5],
        [57.5, 198],
        [54, 186],
        [51.5, 176],
      ],
    },
    {
      id: 'brachioradialis',
      part: 'arm',
      pts: [
        [60, 161.5],
        [64, 163],
        [67.5, 172],
        [68.5, 184],
        [67.5, 196],
        [66, 206],
        [63.6, 198],
        [62, 184],
        [59.6, 172],
      ],
    },
    {
      id: 'adductors',
      part: 'leg',
      pts: [
        [3.5, 216],
        [10, 211.5],
        [17, 211],
        [22.5, 214],
        [19.5, 226],
        [16.5, 240],
        [14, 254],
        [12, 264],
        [10, 266],
        [8, 252],
        [5.5, 236],
        [4, 224],
      ],
    },
    {
      id: 'tensor-fasciae-latae',
      part: 'leg',
      pts: [
        [31, 196],
        [35.5, 199],
        [37.8, 210],
        [37.5, 222],
        [35, 228],
        [32.5, 216],
        [30.5, 204],
      ],
    },
    {
      id: 'vastus-lateralis',
      part: 'leg',
      pts: [
        [34.5, 216],
        [37.8, 222],
        [37, 240],
        [35, 258],
        [32.4, 274],
        [29, 289],
        [26.5, 294],
        [26, 286],
        [28.6, 270],
        [30.4, 252],
        [31.6, 236],
        [33, 224],
      ],
    },
    {
      id: 'vastus-medialis',
      part: 'leg',
      pts: [
        [15.5, 258],
        [19, 262],
        [21.5, 272],
        [22.8, 284],
        [21, 292],
        [17, 294.5],
        [15.2, 288],
        [14.8, 274],
      ],
    },
    {
      id: 'rectus-femoris',
      part: 'leg',
      pts: [
        [27, 207],
        [30.5, 215],
        [31.5, 230],
        [31, 248],
        [28.8, 266],
        [25.8, 280],
        [22.6, 289],
        [20, 281],
        [19, 264],
        [19.4, 244],
        [21, 226],
        [24, 212],
      ],
    },
    {
      id: 'sartorius',
      part: 'leg',
      pts: [
        [29, 196],
        [32, 199],
        [27, 210],
        [23, 224],
        [19.8, 240],
        [17.4, 256],
        [16.2, 272],
        [16, 288],
        [16.6, 297],
        [13.6, 297],
        [12.8, 286],
        [13.2, 270],
        [14.6, 254],
        [17, 238],
        [20.4, 222],
        [24.5, 207],
      ],
    },
    {
      id: 'gastrocnemius-medial',
      part: 'leg',
      pts: [
        [14.6, 308],
        [17, 314],
        [17.8, 328],
        [17.2, 342],
        [15.2, 352],
        [12.6, 346],
        [11.6, 332],
        [12.6, 318],
      ],
    },
    {
      id: 'soleus',
      part: 'leg',
      pts: [
        [13, 350],
        [15.6, 355],
        [16.8, 366],
        [16, 378],
        [14.2, 376],
        [13.2, 364],
      ],
    },
    {
      id: 'tibialis-anterior',
      part: 'leg',
      pts: [
        [22, 308],
        [26.5, 311],
        [27.8, 322],
        [27.4, 338],
        [25.5, 352],
        [23, 366],
        [20.8, 378],
        [19.8, 376],
        [20.6, 362],
        [21.2, 344],
        [21, 326],
        [21, 314],
      ],
    },
    {
      id: 'fibularis-longus',
      part: 'leg',
      pts: [
        [28.4, 314],
        [30.8, 322],
        [31, 336],
        [29.5, 350],
        [27, 362],
        [25.5, 366],
        [26.8, 350],
        [28.2, 334],
        [28.3, 322],
      ],
    },
  ],
  back: [
    {
      id: 'erector-spinae',
      part: 'trunk',
      pts: [
        [1.5, 140],
        [6, 138],
        [9.5, 150],
        [13, 166],
        [17, 180],
        [16, 192],
        [10, 202],
        [4, 206],
        [1.5, 205],
      ],
    },
    {
      id: 'external-oblique',
      part: 'trunk',
      pts: [
        [33.5, 164],
        [35.5, 178],
        [34.8, 191],
        [29, 192.5],
        [24, 190],
        [30.5, 180],
      ],
    },
    {
      id: 'latissimus-dorsi',
      part: 'trunk',
      pts: [
        [14, 118],
        [24, 116],
        [34, 120],
        [42.5, 118],
        [41.5, 130],
        [39, 144],
        [36, 158],
        [33.5, 170],
        [31, 182],
        [24, 186],
        [16, 176],
        [11, 164],
        [10, 150],
        [11, 135],
        [12.5, 124],
      ],
    },
    {
      id: 'teres-major',
      part: 'trunk',
      pts: [
        [30, 116],
        [38, 111],
        [42.5, 108.5],
        [45.5, 114],
        [42, 119.5],
        [35, 121],
      ],
    },
    {
      id: 'infraspinatus',
      part: 'trunk',
      pts: [
        [20, 99],
        [27, 93],
        [35, 90],
        [41, 94],
        [42.2, 102],
        [38, 110],
        [30, 114],
        [22.5, 112],
      ],
    },
    {
      id: 'trapezius',
      part: 'trunk',
      pts: [
        [1, 54],
        [5, 55],
        [10.5, 61],
        [13, 68],
        [20, 73],
        [30, 77.5],
        [40, 81],
        [43, 84],
        [36, 87],
        [28, 90],
        [21, 96],
        [15, 108],
        [10, 124],
        [5, 142],
        [1.5, 156],
        [1, 157],
      ],
    },
    {
      id: 'gluteus-medius',
      part: 'leg',
      pts: [
        [14, 192.5],
        [22, 190.5],
        [30, 191],
        [35.5, 196],
        [37, 206],
        [34.8, 210],
        [27, 204.5],
        [19, 199.5],
        [12, 196],
      ],
    },
    {
      id: 'gluteus-maximus',
      part: 'leg',
      pts: [
        [2, 212],
        [5, 203],
        [10, 197.5],
        [18, 199],
        [27, 204],
        [34, 211],
        [37, 220],
        [35.6, 230],
        [30, 237],
        [20, 241.5],
        [10, 241],
        [3.5, 237],
        [1.8, 226],
      ],
    },
    {
      id: 'adductors',
      part: 'leg',
      pts: [
        [3.5, 241],
        [9, 242],
        [11.6, 254],
        [11.8, 268],
        [10, 276],
        [7.5, 262],
        [4.6, 250],
      ],
    },
    {
      id: 'medial-hamstrings',
      part: 'leg',
      pts: [
        [10, 243],
        [18.5, 244],
        [21.2, 256],
        [21.6, 274],
        [19.6, 290],
        [16, 295],
        [13, 283],
        [12.6, 264],
        [11.8, 250],
      ],
    },
    {
      id: 'biceps-femoris',
      part: 'leg',
      pts: [
        [20, 243.5],
        [29, 240.5],
        [34, 248],
        [33, 264],
        [30, 280],
        [26.5, 293],
        [23.6, 290],
        [23.6, 272],
        [22.8, 256],
      ],
    },
    {
      id: 'soleus',
      part: 'leg',
      pts: [
        [12, 338],
        [14.5, 350],
        [17.5, 358],
        [21.8, 356],
        [26, 348],
        [29.6, 336],
        [28.5, 352],
        [25.6, 364],
        [22.4, 374],
        [17, 375],
        [13.4, 364],
        [12.2, 350],
      ],
    },
    {
      id: 'gastrocnemius-medial',
      part: 'leg',
      pts: [
        [12.5, 304],
        [17.5, 301],
        [21, 306],
        [21.6, 320],
        [21.2, 336],
        [20, 350],
        [17.5, 357],
        [14, 350],
        [11.8, 334],
        [11.4, 316],
      ],
    },
    {
      id: 'gastrocnemius-lateral',
      part: 'leg',
      pts: [
        [22.4, 301],
        [27.5, 303],
        [30.6, 312],
        [30.6, 326],
        [28, 340],
        [24, 350],
        [21.8, 354],
        [21.8, 336],
        [21.9, 318],
        [22, 306],
      ],
    },
    {
      id: 'triceps-brachii',
      part: 'arm',
      pts: [
        [43.5, 112],
        [49, 114],
        [54, 121],
        [57.5, 132],
        [59.5, 146],
        [60, 158],
        [56, 162],
        [52, 158],
        [48.5, 146],
        [45.5, 132],
        [43.5, 122],
      ],
    },
    {
      id: 'deltoid-posterior',
      part: 'arm',
      pts: [
        [34, 86.5],
        [40, 83.5],
        [45.5, 84],
        [50, 90],
        [52.6, 100],
        [53.4, 112],
        [53, 125],
        [49.5, 117],
        [45.5, 107],
        [41, 98],
        [37, 91],
      ],
    },
    {
      id: 'deltoid-lateral',
      part: 'arm',
      pts: [
        [45.5, 84],
        [49.5, 85.5],
        [54, 92],
        [56.8, 102],
        [57.4, 113],
        [55.4, 122],
        [53, 125],
        [53.4, 112],
        [52.6, 100],
        [50, 90],
      ],
    },
    {
      id: 'forearm-flexors',
      part: 'arm',
      pts: [
        [50.5, 164],
        [55, 166],
        [58, 176],
        [60.5, 190],
        [62, 206],
        [60, 207],
        [56.5, 196],
        [53, 182],
        [50.5, 172],
      ],
    },
    {
      id: 'forearm-extensors',
      part: 'arm',
      pts: [
        [56, 162.5],
        [61, 161],
        [65.5, 168],
        [68.5, 180],
        [68.5, 194],
        [67, 206],
        [63.5, 205],
        [61.5, 194],
        [59, 180],
        [56, 170],
      ],
    },
  ],
};

/**
 * Fine detail lines (not interactive): `paired` lines are mirrored, others lie on the centre
 * line. `only` restricts a line to one body.
 */
const DETAILS = {
  front: [
    // Sternocleidomastoid
    {
      part: 'trunk',
      paired: true,
      pts: [
        [13.5, 54],
        [10, 63],
        [5, 72],
        [2.5, 77],
      ],
    },
    // Clavicle
    {
      part: 'trunk',
      paired: true,
      pts: [
        [3, 79.5],
        [14, 77.5],
        [26, 78.5],
        [37, 80.5],
      ],
    },
    // Tendinous intersections of the rectus
    {
      part: 'trunk',
      paired: true,
      pts: [
        [2, 143],
        [8, 144.6],
        [13.9, 143],
      ],
    },
    {
      part: 'trunk',
      paired: true,
      only: 'male',
      pts: [
        [2, 156],
        [8, 157.4],
        [13.7, 156],
      ],
    },
    {
      part: 'trunk',
      paired: true,
      only: 'male',
      pts: [
        [2, 169],
        [8, 170],
        [13.1, 169],
      ],
    },
    // Serratus digitations
    {
      part: 'trunk',
      paired: true,
      pts: [
        [29, 127],
        [37.5, 124],
      ],
    },
    {
      part: 'trunk',
      paired: true,
      pts: [
        [29.5, 134],
        [37, 131.5],
      ],
    },
    // Inguinal line
    {
      part: 'trunk',
      paired: true,
      pts: [
        [31, 194],
        [22, 202],
        [13, 208.5],
      ],
    },
    // Biceps tendon, patella, ankle, fingers, toes
    {
      part: 'leg',
      paired: true,
      closed: true,
      pts: [
        [21, 294],
        [25, 298],
        [24.5, 305],
        [21, 308],
        [17.5, 304.5],
        [17.5, 298],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [23.5, 386],
        [19, 389],
        [14.8, 386.5],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [16.5, 404],
        [16.4, 408.6],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [19.5, 404.5],
        [19.4, 408.8],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [22.5, 404],
        [22.4, 408.4],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [64.4, 238],
        [63.8, 250],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [67.3, 239],
        [67.4, 253.5],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [70.2, 238],
        [70.4, 250],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [61.5, 224],
        [66, 229],
        [71.5, 228],
      ],
    },
  ],
  back: [
    // Spine of the scapula and medial border
    {
      part: 'trunk',
      paired: true,
      pts: [
        [19.5, 98.5],
        [30, 91.5],
        [41, 87],
      ],
    },
    {
      part: 'trunk',
      paired: true,
      pts: [
        [19.8, 99.5],
        [19.2, 108],
        [22, 113],
      ],
    },
    // Spine
    {
      part: 'trunk',
      paired: false,
      pts: [
        [0, 60],
        [0, 150],
        [0, 204],
      ],
    },
    // Iliac crest / lumbar fascia
    {
      part: 'trunk',
      paired: true,
      pts: [
        [12, 190],
        [20, 191],
        [30, 189],
      ],
    },
    // Gluteal fold, popliteal crease, Achilles tendon, heel
    {
      part: 'leg',
      paired: true,
      pts: [
        [4, 240],
        [12, 242.5],
        [22, 242],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [15, 299],
        [21, 300.5],
        [28, 299],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [19.5, 374],
        [19.2, 392],
      ],
    },
    {
      part: 'leg',
      paired: true,
      pts: [
        [14, 398],
        [19, 401.5],
        [24.5, 398],
      ],
    },
    // Olecranon and knuckles
    {
      part: 'arm',
      paired: true,
      pts: [
        [52.5, 163],
        [55.5, 165.5],
        [58.5, 163],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [61.5, 232],
        [66.5, 234.5],
        [72, 232.5],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [64.4, 238],
        [63.8, 250],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [67.3, 239],
        [67.4, 253.5],
      ],
    },
    {
      part: 'arm',
      paired: true,
      pts: [
        [70.2, 238],
        [70.4, 250],
      ],
    },
  ],
};

/** Female breast contour over the pectoralis (front view). */
const BREAST = [
  [5.5, 106],
  [6, 116],
  [11, 124.5],
  [19.5, 128],
  [28, 124.5],
  [33.5, 116],
  [34.5, 108],
];

// ── Assembly ─────────────────────────────────────────────────────────────────

/** Fallback colours (the app styles the regions with its theme tokens). */
const FALLBACK = {
  base: '#e4dccd',
  outline: '#3f5444',
  muscle: '#f6f1e7',
  stroke: '#6e7f70',
  detail: '#8d9a8e',
  hair: '#cfc4b0',
};

function build(variant, view) {
  const t = transforms[variant];
  const toAbs = (part, side) => (point) => {
    const [dx, y] = t(part)(point);
    return [side === 'left' ? CX - dx : CX + dx, y];
  };
  // Front view: the viewer's left is the body's right; back view: the body's left.
  const anatomical = (screen) =>
    view === 'front' ? (screen === 'left' ? 'right' : 'left') : screen;

  const base = [];
  const centre = (part, half) => symmetric(half).map(toAbs(part, 'left'));
  base.push(spline(centre('trunk', NECK), true));
  base.push(spline(centre('trunk', TRUNK), true));
  for (const side of ['left', 'right']) {
    base.push(spline(LEG.map(toAbs('leg', side)), true));
    base.push(spline(ARM.map(toAbs('arm', side)), true));
    base.push(spline(EAR.map(toAbs('head', side)), true));
  }
  base.push(spline(centre('head', HEAD), true));
  const basePaths = base.map((d) => `<path d="${d}"/>`).join('');

  const hair = [spline(centre('head', HAIR[variant][view]), true)];
  if (variant === 'female' && view === 'back') hair.push(spline(centre('head', BUN), true));

  const regions = [];
  for (const muscle of MUSCLES[view]) {
    for (const side of ['left', 'right']) {
      const d = spline(muscle.pts.map(toAbs(muscle.part, side)), true);
      regions.push(`<path data-region="${muscle.id}" data-side="${anatomical(side)}" d="${d}"/>`);
    }
  }

  const details = [];
  for (const line of DETAILS[view]) {
    if (line.only && line.only !== variant) continue;
    const sides = line.paired ? ['left', 'right'] : ['left'];
    for (const side of sides) {
      details.push(spline(line.pts.map(toAbs(line.part, side)), Boolean(line.closed)));
    }
  }
  if (variant === 'female' && view === 'front') {
    for (const side of ['left', 'right'])
      details.push(spline(BREAST.map(toAbs('trunk', side)), false));
  }
  if (view === 'front') {
    // Navel
    const [nx, ny] = toAbs('trunk', 'left')([0, 172]);
    details.push(`M${round(nx - 1.4)} ${round(ny)}a1.4 2 0 1 0 2.8 0a1.4 2 0 1 0 -2.8 0Z`);
  }
  const detailPaths = details.map((d) => `<path d="${d}"/>`).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" class="kalethra-muscle-map" data-variant="${variant}" data-view="${view}" aria-hidden="true" focusable="false">`,
    `<g class="km-outline" fill="${FALLBACK.base}" stroke="${FALLBACK.outline}" stroke-width="2.4" stroke-linejoin="round">${basePaths}</g>`,
    `<g class="km-body" fill="${FALLBACK.base}">${basePaths}</g>`,
    `<g class="km-hair" fill="${FALLBACK.hair}" stroke="${FALLBACK.stroke}" stroke-width="0.5">${hair.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    `<g class="km-muscles" fill="${FALLBACK.muscle}" stroke="${FALLBACK.stroke}" stroke-width="0.6" stroke-linejoin="round">${regions.join('')}</g>`,
    `<g class="km-details" fill="none" stroke="${FALLBACK.detail}" stroke-width="0.5" stroke-linecap="round">${detailPaths}</g>`,
    `</svg>`,
    '',
  ].join('\n');
}

mkdirSync(OUT, { recursive: true });
for (const variant of ['male', 'female']) {
  for (const view of ['front', 'back']) {
    const file = join(OUT, `${variant}-${view}.svg`);
    writeFileSync(file, build(variant, view));
    console.log(`wrote ${file}`);
  }
}
