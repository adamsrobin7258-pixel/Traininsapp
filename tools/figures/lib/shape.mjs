/**
 * The Kalethra body shapes – MakeHuman macro settings for a young adult athlete (mid/late 20s),
 * trained but not bodybuilder-like, average weight leaning lean, classic proportions.
 */
import { applyTargets } from './makehuman.mjs';

/** Shape settings per variant (0…1). */
export const SHAPES = {
  male: { gender: 'male', muscle: 0.75, lean: 0.45, proportions: 0.7, cup: 0 },
  female: { gender: 'female', muscle: 0.65, lean: 0.4, proportions: 0.7, cup: 0.35 },
};

/** Weighted targets of a variant (see MakeHuman's macro modifier). */
export function shapeTargets(variant) {
  const s = SHAPES[variant];
  const g = s.gender;
  const third = 1 / 3;
  // Muscle from average to max (t_m) and weight from average towards min (t_w) – bilinear.
  const tm = s.muscle;
  const tw = s.lean;
  const targets = [
    [`macrodetails/caucasian-${g}-young.target`, third],
    [`macrodetails/african-${g}-young.target`, third],
    [`macrodetails/asian-${g}-young.target`, third],
    [`macrodetails/universal-${g}-young-maxmuscle-averageweight.target`, tm * (1 - tw)],
    [`macrodetails/universal-${g}-young-averagemuscle-minweight.target`, (1 - tm) * tw],
    [`macrodetails/universal-${g}-young-maxmuscle-minweight.target`, tm * tw],
    [
      `macrodetails/proportions/${g}-young-averagemuscle-averageweight-idealproportions.target`,
      s.proportions,
    ],
  ];
  // Calm, unemphasised chest form under the top (the male chest needs no correction).
  if (g === 'female') {
    targets.push(
      ['breast/nipple-point-decr.target', 1],
      ['breast/nipple-size-decr.target', 1],
      ['breast/breast-point-decr.target', 0.6],
    );
  }
  if (g === 'female' && s.cup > 0) {
    // Natural, unemphasised chest form: towards the smaller cup, firm.
    targets.push([
      `breast/female-young-averagemuscle-averageweight-mincup-averagefirmness.target`,
      s.cup,
    ]);
  }
  return targets;
}

/** Positions in metres (MakeHuman centre, not yet on the floor). */
export function buildShape(dataDir, mesh, variant) {
  const raw = applyTargets(dataDir, mesh.positions, shapeTargets(variant));
  const out = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] * 0.1;
  return out;
}
