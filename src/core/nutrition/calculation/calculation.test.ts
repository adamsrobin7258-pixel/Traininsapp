import {
  adjustForGoal,
  ageOn,
  calculateNutrition,
  everydayEnergy,
  proteinTarget,
  restingEnergy,
  splitMacros,
  trainingEnergy,
  weightTrend,
  type CalculationInput,
  type TrainingSession,
  type WeightPoint,
} from './index';

const DAY = '2026-10-03';

/** A complete input: man, 30 years, 180 cm, 80 kg (stable), moderately active, maintain. */
function input(change: Partial<CalculationInput> = {}): CalculationInput {
  return {
    onDate: DAY,
    personal: { sex: 'male', birthDate: '1996-01-15', heightCm: 180 },
    params: {
      goalType: 'maintain',
      goalLevel: null,
      activityLevel: 'moderate',
      includeTraining: false,
      targetWeightKg: null,
    },
    weights: [{ date: '2026-10-02', kg: 80 }],
    training: [],
    overrides: {},
    ...change,
  };
}

const strength = (count: number, minutes = 60): TrainingSession[] =>
  Array.from({ length: count }, (_, i) => ({
    localDate: `2026-09-${String(10 + i).padStart(2, '0')}`,
    durationMinutes: minutes,
    category: 'strength',
  }));

const allFinite = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allFinite);
  return true;
};

describe('resting energy (Mifflin-St Jeor)', () => {
  it('uses the published constants for men and women', () => {
    expect(restingEnergy({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1780);
    expect(restingEnergy({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 30 })).toBe(
      1320.25,
    );
  });

  it('uses the mean of both constants when no sex is given', () => {
    const male = restingEnergy({ sex: 'male', weightKg: 70, heightCm: 172, ageYears: 40 });
    const female = restingEnergy({ sex: 'female', weightKg: 70, heightCm: 172, ageYears: 40 });
    const neutral = restingEnergy({
      sex: 'unspecified',
      weightKg: 70,
      heightCm: 172,
      ageYears: 40,
    });
    expect(neutral).toBe((male + female) / 2);
  });

  it('falls with age and rises with height and weight', () => {
    const base = { sex: 'female' as const, weightKg: 65, heightCm: 168, ageYears: 30 };
    expect(restingEnergy({ ...base, ageYears: 60 })).toBe(restingEnergy(base) - 150);
    expect(restingEnergy({ ...base, heightCm: 178 })).toBe(restingEnergy(base) + 62.5);
    expect(restingEnergy({ ...base, weightKg: 75 })).toBe(restingEnergy(base) + 100);
  });

  it('derives the age from the birth date', () => {
    expect(ageOn('1996-10-03', '2026-10-03')).toBe(30);
    expect(ageOn('1996-10-04', '2026-10-03')).toBe(29);
    expect(ageOn('2030-01-01', '2026-10-03')).toBeNull();
  });
});

describe('activity and training', () => {
  it('scales the RMR by everyday activity', () => {
    expect(everydayEnergy(1000, 'sedentary')).toBe(1200);
    expect(everydayEnergy(1000, 'moderate')).toBe(1400);
    expect(everydayEnergy(1000, 'veryActive')).toBe(1700);
  });

  it('adds only the net energy of logged workouts, averaged over 28 days', () => {
    // 8 × 60 min strength at 80 kg: (3.5 − 1) × 80 × 1 h × 8 = 1600 kcal → ≈ 57 kcal/day
    const estimate = trainingEnergy(strength(8), 80);
    expect(estimate.kcalPerDay).toBeCloseTo(1600 / 28);
    expect(estimate.strengthSessions).toBe(8);
  });

  it('caps long sessions and the daily amount', () => {
    expect(trainingEnergy(strength(1, 600), 80).kcalPerDay).toBeCloseTo((2.5 * 80 * 3) / 28);
    const marathon = Array.from({ length: 28 }, (_, i) => ({
      localDate: DAY,
      durationMinutes: 180 + i,
      category: 'endurance' as const,
    }));
    expect(trainingEnergy(marathon, 150).kcalPerDay).toBe(800);
  });

  it('counts training only when the user includes it', () => {
    const off = calculateNutrition(input({ training: strength(8) }));
    const on = calculateNutrition(
      input({ training: strength(8), params: { ...input().params, includeTraining: true } }),
    );
    expect(off.energy?.training).toBeNull();
    expect(on.energy?.maintenanceKcal).toBeCloseTo((off.energy?.maintenanceKcal ?? 0) + 1600 / 28);
  });

  it('distinguishes low, medium and high everyday activity', () => {
    const at = (activityLevel: 'sedentary' | 'moderate' | 'veryActive') =>
      calculateNutrition(input({ params: { ...input().params, activityLevel } })).auto.energyKcal;
    expect(at('sedentary')).toBe(2140); // 1780 × 1.2 = 2136
    expect(at('moderate')).toBe(2490); // 1780 × 1.4 = 2492
    expect(at('veryActive')).toBe(3030); // 1780 × 1.7 = 3026
  });
});

describe('goal adjustment', () => {
  const lose = (goalLevel: 'slow' | 'moderate' | 'fast') =>
    calculateNutrition(input({ params: { ...input().params, goalType: 'lose', goalLevel } }));

  it('applies the deficit of each weight-loss level with its expected pace', () => {
    expect(lose('slow').energy?.adjustment.appliedKcal).toBe(-275);
    expect(lose('moderate').energy?.adjustment.appliedKcal).toBe(-550);
    // −825 would exceed 25 % of 2492 kcal maintenance: limited to −623 and reported.
    expect(lose('fast').energy?.adjustment.requestedKcal).toBe(-825);
    expect(lose('fast').energy?.adjustment.appliedKcal).toBe(-623);
    expect(lose('fast').warnings).toContain('deficit-limited');
    expect(lose('moderate').auto.energyKcal).toBe(1940); // 2492 − 550
    expect(lose('moderate').energy?.adjustment.expectedKgPerWeek).toBeCloseTo(-0.5);
  });

  it('keeps maintenance unchanged', () => {
    const result = calculateNutrition(input());
    expect(result.energy?.adjustment.appliedKcal).toBe(0);
    expect(result.auto.energyKcal).toBe(2490);
  });

  it('uses a conservative surplus for muscle gain', () => {
    const gain = (goalLevel: 'moderate' | 'higher') =>
      calculateNutrition(input({ params: { ...input().params, goalType: 'gain', goalLevel } }));
    expect(gain('moderate').energy?.adjustment.appliedKcal).toBeCloseTo(2492 * 0.05);
    expect(gain('higher').energy?.adjustment.appliedKcal).toBeCloseTo(2492 * 0.1);
    expect(gain('higher').auto.energyKcal).toBe(2740);
  });

  it('bounds the surplus in kcal for very high needs', () => {
    const result = adjustForGoal(6000, 2500, 'gain', 'higher');
    expect(result.appliedKcal).toBe(500);
    expect(result.limitedBy).toBe('surplus-cap');
  });

  it('never goes below 25 % deficit, the RMR or 1200 kcal', () => {
    expect(adjustForGoal(2000, 1300, 'lose', 'fast')).toMatchObject({
      appliedKcal: -500,
      limitedBy: 'deficit-share',
    });
    expect(adjustForGoal(1500, 1250, 'lose', 'moderate')).toMatchObject({
      targetKcal: 1250,
      limitedBy: 'minimum',
    });
    expect(adjustForGoal(1350, 1000, 'lose', 'fast')).toMatchObject({
      targetKcal: 1200,
      limitedBy: 'minimum',
    });
    // Maintenance below the floor: no deficit at all instead of a dangerous target.
    expect(adjustForGoal(1150, 1000, 'lose', 'fast')).toMatchObject({
      appliedKcal: 0,
      targetKcal: 1150,
    });
  });

  it('reports an extremely low result instead of passing it on silently', () => {
    const small = calculateNutrition(
      input({
        personal: { sex: 'female', birthDate: '1950-01-01', heightCm: 150 },
        weights: [{ date: DAY, kg: 45 }],
        params: {
          ...input().params,
          goalType: 'lose',
          goalLevel: 'fast',
          activityLevel: 'sedentary',
        },
      }),
    );
    // Maintenance (≈1016 kcal) is already below the floor: no deficit is applied at all.
    expect(small.energy?.adjustment.appliedKcal).toBe(0);
    expect(small.auto.energyKcal).toBe(1020);
    expect(small.warnings).toContain('deficit-minimum');
  });
});

describe('protein', () => {
  const protein = (change: Partial<Parameters<typeof proteinTarget>[0]>) =>
    proteinTarget({
      weightKg: 80,
      heightCm: 180,
      goalType: 'maintain',
      activityLevel: 'moderate',
      regularStrengthTraining: false,
      ...change,
    });

  it('depends on body weight and activity, not on calories', () => {
    expect(protein({}).grams).toBeCloseTo(112); // 1.4 g/kg
    expect(protein({ activityLevel: 'sedentary' }).grams).toBeCloseTo(96); // 1.2 g/kg
    expect(protein({ weightKg: 70 }).grams).toBeCloseTo(98);
  });

  it('is higher with regular strength training, most in a deficit', () => {
    expect(protein({ regularStrengthTraining: true }).gPerKg).toBe(1.6);
    expect(protein({ regularStrengthTraining: true, goalType: 'gain' }).gPerKg).toBe(1.8);
    expect(protein({ regularStrengthTraining: true, goalType: 'lose' }).gPerKg).toBe(2.0);
    expect(protein({ goalType: 'lose' }).gPerKg).toBe(1.6);
  });

  it('stays within 1.2–2.2 g/kg and uses a reference weight for a high BMI', () => {
    const heavy = protein({ weightKg: 140, regularStrengthTraining: true, goalType: 'lose' });
    expect(heavy.referenceCapped).toBe(true);
    expect(heavy.referenceWeightKg).toBeCloseTo(89.1); // BMI 27.5 at 180 cm
    expect(heavy.grams).toBeLessThan(2.2 * 140);
  });

  it('detects regular strength training from logged workouts', () => {
    const result = calculateNutrition(input({ training: strength(4) }));
    expect(result.protein?.basis).toBe('strength');
    expect(calculateNutrition(input({ training: strength(3) })).protein?.basis).toBe('activity');
  });
});

describe('fat and carbohydrates', () => {
  it('uses 30 % fat and the rest for carbohydrates', () => {
    const split = splitMacros({ energyKcal: 2500, proteinG: 120 });
    expect(split.fatShare).toBeCloseTo(0.3);
    expect(split.carbsG).toBeCloseTo((2500 - 480 - 750) / 4);
    expect(split.carbsStatus).toBe('ok');
  });

  it('lowers fat to 25 % when protein leaves too little for carbohydrates', () => {
    const split = splitMacros({ energyKcal: 1800, proteinG: 180 });
    expect(split.fatShare).toBeCloseTo(0.25);
    expect(split.carbsStatus).toBe('low');
  });

  it('flags results with (almost) nothing left for carbohydrates', () => {
    const split = splitMacros({ energyKcal: 1500, proteinG: 300 });
    expect(split.carbsG).toBe(0);
    expect(split.carbsStatus).toBe('critical');
  });

  it('keeps all values consistent with the energy', () => {
    const result = calculateNutrition(input());
    const { energyKcal, proteinG, carbsG, fatG } = result.effective;
    const total = (proteinG ?? 0) * 4 + (carbsG ?? 0) * 4 + (fatG ?? 0) * 9;
    expect(Math.abs(total - (energyKcal ?? 0))).toBeLessThan(10);
  });
});

describe('manual overrides', () => {
  it('keeps manual values and calculates the rest around them', () => {
    const auto = calculateNutrition(input());
    const kcal = calculateNutrition(input({ overrides: { energyKcal: 2000 } }));
    expect(kcal.effective.energyKcal).toBe(2000);
    expect(kcal.auto.energyKcal).toBe(auto.auto.energyKcal);
    expect(kcal.effective.proteinG).toBe(auto.effective.proteinG);
    expect(kcal.effective.fatG).toBe(Math.round((2000 * 0.3) / 9));

    const protein = calculateNutrition(input({ overrides: { proteinG: 170 } }));
    expect(protein.effective.proteinG).toBe(170);
    expect(protein.effective.carbsG).toBeLessThan(auto.effective.carbsG ?? 0);

    const fat = calculateNutrition(input({ overrides: { fatG: 50 } }));
    expect(fat.effective.fatG).toBe(50);
    expect(fat.auto.fatG).toBe(auto.auto.fatG);

    const carbs = calculateNutrition(input({ overrides: { carbsG: 200 } }));
    expect(carbs.effective.carbsG).toBe(200);
    expect(carbs.effective.energyKcal).toBe(auto.effective.energyKcal);
  });

  it('supports any mix of manual and automatic values', () => {
    const mixed = calculateNutrition(input({ overrides: { proteinG: 170, fatG: 70 } }));
    expect(mixed.effective).toEqual({
      energyKcal: 2490,
      proteinG: 170,
      fatG: 70,
      carbsG: Math.round((2490 - 680 - 630) / 4),
    });
  });

  it('works with manual values only when personal data are missing', () => {
    const result = calculateNutrition(
      input({
        personal: { sex: null, birthDate: null, heightCm: null },
        weights: [],
        overrides: { energyKcal: 2200, proteinG: 150 },
      }),
    );
    expect(result.status).toBe('incomplete');
    expect(result.effective.energyKcal).toBe(2200);
    // 30 % fat would leave carbohydrates below 45 %, so fat is set to 25 %.
    expect(result.effective.fatG).toBe(Math.round((2200 * 0.25) / 9));
  });

  it('warns about a very low manual calorie goal', () => {
    expect(calculateNutrition(input({ overrides: { energyKcal: 900 } })).warnings).toContain(
      'manual-energy-low',
    );
  });
});

describe('weight trend', () => {
  const series = (values: number[]): WeightPoint[] =>
    values.map((kg, i) => ({ date: `2026-09-${String(27 + i).padStart(2, '0')}`, kg }));

  it('uses the median of the last 7 days', () => {
    const trend = weightTrend(series([80, 80.4, 79.8, 80.2, 80.1, 79.9, 80]), '2026-10-03');
    expect(trend).toMatchObject({ kg: 80, method: 'median7', entryCount: 7 });
  });

  it('ignores a single outlier', () => {
    const trend = weightTrend(series([80, 80.2, 79.8, 84.5, 80.1, 79.9, 80]), '2026-10-03');
    expect(trend?.kg).toBe(80);
  });

  it('follows a rising or falling weight', () => {
    expect(weightTrend(series([90, 89.6, 89.2, 88.8, 88.4, 88, 87.6]), '2026-10-03')?.kg).toBe(
      88.8,
    );
    expect(weightTrend(series([70, 70.3, 70.6, 70.9, 71.2, 71.5, 71.8]), '2026-10-03')?.kg).toBe(
      70.9,
    );
  });

  it('uses older data openly when nothing is recent and invents nothing', () => {
    const old = weightTrend([{ date: '2026-08-01', kg: 82 }], DAY);
    expect(old).toMatchObject({ kg: 82, method: 'latest' });
    expect(weightTrend([], DAY)).toBeNull();
    expect(weightTrend([{ date: '2026-10-05', kg: 82 }], DAY)).toBeNull();
    const result = calculateNutrition(input({ weights: [{ date: '2026-08-01', kg: 82 }] }));
    expect(result.warnings).toContain('weight-not-recent');
  });

  it('changes the goal with the trend, not with a single day', () => {
    const before = calculateNutrition(input({ weights: series([90, 90, 90, 90, 90, 90, 90]) }));
    const spike = calculateNutrition(input({ weights: series([90, 90, 90, 90, 90, 90, 93]) }));
    const lower = calculateNutrition(input({ weights: series([87, 87, 87, 87, 87, 87, 87]) }));
    expect(spike.auto.energyKcal).toBe(before.auto.energyKcal);
    expect(lower.auto.energyKcal).toBeLessThan(before.auto.energyKcal ?? 0);
    expect(lower.auto.proteinG).toBeLessThan(before.auto.proteinG ?? 0);
  });
});

describe('safety and missing data', () => {
  it('lists missing data instead of calculating', () => {
    const result = calculateNutrition(
      input({
        personal: { sex: null, birthDate: null, heightCm: null },
        weights: [],
        params: { ...input().params, activityLevel: null },
      }),
    );
    expect(result.status).toBe('incomplete');
    expect(result.missing).toEqual(['sex', 'birthDate', 'height', 'weight', 'activity']);
    expect(result.auto).toEqual({ energyKcal: null, proteinG: null, carbsG: null, fatG: null });
  });

  it('refuses implausible inputs', () => {
    const child = calculateNutrition(
      input({ personal: { sex: 'male', birthDate: '2015-01-01', heightCm: 180 } }),
    );
    expect(child.invalid).toEqual(['age']);
    expect(child.auto.energyKcal).toBeNull();
    const tall = calculateNutrition(
      input({ personal: { sex: 'male', birthDate: '1996-01-15', heightCm: 260 } }),
    );
    expect(tall.invalid).toEqual(['height']);
    expect(calculateNutrition(input({ weights: [{ date: DAY, kg: 500 }] })).invalid).toEqual([
      'weight',
    ]);
  });

  it('flags implausible target weights without replacing the measured weight', () => {
    const low = calculateNutrition(
      input({
        params: { ...input().params, goalType: 'lose', goalLevel: 'slow', targetWeightKg: 55 },
      }),
    );
    expect(low.warnings).toContain('target-weight-low');
    expect(low.inputs.weight?.kg).toBe(80);
    const wrongWay = calculateNutrition(
      input({ params: { ...input().params, goalType: 'lose', targetWeightKg: 85 } }),
    );
    expect(wrongWay.warnings).toContain('target-weight-direction');
    expect(calculateNutrition(input()).warnings).toEqual([]);
  });

  it('never produces NaN or Infinity', () => {
    const cases = [
      input(),
      input({ weights: [] }),
      input({ personal: { sex: 'unspecified', birthDate: 'kaputt', heightCm: Number.NaN } }),
      input({ overrides: { energyKcal: 0, proteinG: 0 } }),
      input({ training: [{ localDate: DAY, durationMinutes: Number.NaN, category: 'other' }] }),
      input({ weights: [{ date: DAY, kg: Number.POSITIVE_INFINITY }] }),
    ];
    for (const value of cases) expect(allFinite(calculateNutrition(value))).toBe(true);
  });
});
