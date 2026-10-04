import { summarizeDay, type FoodEntry } from './diary';
import { NutritionError } from './errors';
import {
  matchesFoodSearch,
  nutrientsForQuantity,
  toReferenceAmount,
  unitsFor,
  type Food,
} from './food';
import {
  effectiveTargets,
  effectiveValue,
  goalForDate,
  goalProgress,
  type NutritionGoal,
} from './goals';
import { mealDisplayName, orderedMeals } from './meals';
import {
  DETAIL_MIN_COVERAGE,
  detailDayTotal,
  scaleNutrients,
  sumNutrients,
  withoutIncompleteDetails,
  ZERO_NUTRIENTS,
  type Nutrients,
} from './nutrients';
import { recipeNutrition } from './recipe';
import { convertQuantity } from './units';
import { isValidWaterAmount, waterTotalMl } from './water';

const nutrients = (values: Partial<Nutrients>): Nutrients => ({ ...ZERO_NUTRIENTS, ...values });

/** 200 kcal, 20 g protein, 10 g carbs, 8 g fat, 3 g fiber per 100 g. */
const oats: Pick<Food, 'reference' | 'servings' | 'nutrients'> = {
  reference: { amount: 100, unit: 'g' },
  servings: [{ unit: 'serving', amount: 40, amountUnit: 'g', label: null }],
  nutrients: nutrients({ energyKcal: 200, proteinG: 20, carbsG: 10, fatG: 8, fiberG: 3 }),
};
/** Milk per 100 ml. */
const milk: Pick<Food, 'reference' | 'servings' | 'nutrients'> = {
  reference: { amount: 100, unit: 'ml' },
  servings: [],
  nutrients: nutrients({ energyKcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.5, sugarG: 4.8 }),
};
/** Banana per piece, one piece = 120 g. */
const banana: Pick<Food, 'reference' | 'servings' | 'nutrients'> = {
  reference: { amount: 1, unit: 'piece' },
  servings: [{ unit: 'piece', amount: 120, amountUnit: 'g', label: '1 Banane' }],
  nutrients: nutrients({ energyKcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 }),
};

describe('unit conversion', () => {
  it.each([
    [1500, 'g', 'kg', 1.5],
    [0.25, 'kg', 'g', 250],
    [330, 'ml', 'l', 0.33],
    [1.5, 'l', 'ml', 1500],
    [2, 'piece', 'piece', 2],
  ] as const)('%s %s → %s', (amount, from, to, expected) => {
    expect(convertQuantity(amount, from, to)).toBeCloseTo(expected, 10);
  });

  it.each([
    ['g', 'ml'],
    ['l', 'kg'],
    ['piece', 'g'],
    ['g', 'serving'],
    ['piece', 'serving'],
  ] as const)('never converts %s → %s without food data', (from, to) => {
    expect(convertQuantity(1, from, to)).toBeNull();
  });
});

describe('nutrients of a quantity', () => {
  it.each([
    [100, { energyKcal: 200, proteinG: 20, carbsG: 10, fatG: 8, fiberG: 3 }],
    [50, { energyKcal: 100, proteinG: 10, carbsG: 5, fatG: 4, fiberG: 1.5 }],
    [150, { energyKcal: 300, proteinG: 30, carbsG: 15, fatG: 12, fiberG: 4.5 }],
    [37.5, { energyKcal: 75, proteinG: 7.5, carbsG: 3.75, fatG: 3, fiberG: 1.13 }],
  ])('%s g of a per-100-g food', (grams, expected) => {
    expect(nutrientsForQuantity(oats, grams, 'g')).toEqual(nutrients(expected));
  });

  it('converts kg, servings, pieces and litres through the reference', () => {
    expect(nutrientsForQuantity(oats, 0.15, 'kg').energyKcal).toBe(300);
    // 1 serving = 40 g
    expect(nutrientsForQuantity(oats, 2, 'serving').energyKcal).toBe(160);
    expect(nutrientsForQuantity(milk, 0.25, 'l')).toMatchObject({ energyKcal: 160, sugarG: 12 });
    expect(nutrientsForQuantity(banana, 2, 'piece').energyKcal).toBe(210);
    // 60 g of a per-piece food with a 120 g piece = half a banana
    expect(nutrientsForQuantity(banana, 60, 'g').carbsG).toBe(13.5);
  });

  it('keeps unknown detail values unknown', () => {
    expect(nutrientsForQuantity(oats, 50, 'g').sugarG).toBeNull();
  });

  it('refuses units that need information the food does not have', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
        return 'ok';
      } catch (error) {
        return error instanceof NutritionError ? error.code : 'other';
      }
    };
    expect(code(() => nutrientsForQuantity(milk, 100, 'g'))).toBe('incompatible-unit');
    expect(code(() => nutrientsForQuantity(milk, 1, 'piece'))).toBe('incompatible-unit');
    expect(code(() => nutrientsForQuantity(oats, 0, 'g'))).toBe('invalid-value');
    expect(code(() => nutrientsForQuantity(oats, -5, 'g'))).toBe('invalid-value');
    expect(toReferenceAmount(banana, 1, 'ml')).toBeNull();
  });

  it('lists the units a food can be entered in', () => {
    expect(unitsFor(oats)).toEqual(['g', 'kg', 'serving']);
    expect(unitsFor(milk)).toEqual(['ml', 'l']);
    expect(unitsFor(banana)).toEqual(['g', 'kg', 'piece']);
  });
});

describe('sums', () => {
  it('adds values and marks incomplete details', () => {
    const { totals, incomplete } = sumNutrients([
      nutrients({ energyKcal: 100.005, proteinG: 1, fiberG: 2 }),
      nutrients({ energyKcal: 50, proteinG: 2.5 }),
    ]);
    expect(totals).toMatchObject({ energyKcal: 150.01, proteinG: 3.5, fiberG: 2, sugarG: null });
    expect(incomplete).toEqual(['fiberG', 'sugarG', 'saturatedFatG']);
  });

  it('scales without float noise', () => {
    expect(scaleNutrients(nutrients({ proteinG: 0.1 }), 3).proteinG).toBe(0.3);
  });
});

describe('fiber of a day', () => {
  it('is complete when every entry states it – a known 0 g counts, unknown never does', () => {
    expect(
      detailDayTotal(
        [nutrients({ energyKcal: 300, fiberG: 6.2 }), nutrients({ energyKcal: 150, fiberG: 0 })],
        'fiberG',
      ),
    ).toEqual({ status: 'complete', grams: 6.2 });
    expect(detailDayTotal([nutrients({ energyKcal: 150, fiberG: 0 })], 'fiberG')).toEqual({
      status: 'complete',
      grams: 0,
    });
  });

  it('is unknown without entries or when no entry states it (never 0 g)', () => {
    expect(detailDayTotal([], 'fiberG')).toEqual({ status: 'unknown' });
    expect(detailDayTotal([nutrients({ energyKcal: 500 })], 'fiberG')).toEqual({
      status: 'unknown',
    });
  });

  it('is a lower bound when most of the energy is covered, else not enough to say', () => {
    expect(DETAIL_MIN_COVERAGE).toBe(0.8);
    // 800 of 1000 kcal state fiber: 80 % → "at least 12 g".
    expect(
      detailDayTotal(
        [nutrients({ energyKcal: 800, fiberG: 12 }), nutrients({ energyKcal: 200 })],
        'fiberG',
      ),
    ).toEqual({ status: 'partial', grams: 12 });
    // 700 of 1000 kcal: too little.
    expect(
      detailDayTotal(
        [nutrients({ energyKcal: 700, fiberG: 12 }), nutrients({ energyKcal: 300 })],
        'fiberG',
      ),
    ).toEqual({ status: 'insufficient' });
    // Without energy the share of entries decides.
    expect(
      detailDayTotal([nutrients({ fiberG: 1 }), nutrients({}), nutrients({})], 'fiberG'),
    ).toEqual({ status: 'insufficient' });
  });

  it('is part of the day summary', () => {
    const entry = (fiberG: number | null) =>
      ({
        localDate: '2026-10-03',
        mealId: 'm',
        nutrients: nutrients({ energyKcal: 100, fiberG }),
      }) as FoodEntry;
    expect(summarizeDay('2026-10-03', [entry(2), entry(3.5)]).fiber).toEqual({
      status: 'complete',
      grams: 5.5,
    });
    expect(summarizeDay('2026-10-03', []).fiber).toEqual({ status: 'unknown' });
  });

  it('turns details unknown for any part into unknown for the whole', () => {
    expect(
      withoutIncompleteDetails(nutrients({ energyKcal: 300, fiberG: 4, sugarG: 2 }), ['fiberG']),
    ).toMatchObject({ energyKcal: 300, fiberG: null, sugarG: 2 });
  });
});

describe('recipes', () => {
  const foods = new Map([
    ['oats', oats],
    ['milk', milk],
    ['banana', banana],
  ]);

  it('adds ingredients in different units and divides by servings', () => {
    const result = recipeNutrition(
      {
        servings: 2,
        ingredients: [
          { id: '1', foodId: 'oats', amount: 80, unit: 'g', position: 0, note: null },
          { id: '2', foodId: 'milk', amount: 0.3, unit: 'l', position: 1, note: null },
          { id: '3', foodId: 'banana', amount: 1, unit: 'piece', position: 2, note: null },
        ],
      },
      foods,
    );
    // 160 + 192 + 105
    expect(result.total.totals.energyKcal).toBe(457);
    expect(result.total.totals.proteinG).toBeCloseTo(16 + 10.2 + 1.3, 5);
    expect(result.perServing.totals.energyKcal).toBe(228.5);
    // Fiber only known for oats, sugar only for milk: partial sums, flagged.
    expect(result.total.totals.fiberG).toBe(2.4);
    expect(result.total.totals.sugarG).toBe(14.4);
    expect(result.total.totals.saturatedFatG).toBeNull();
    expect(result.total.incomplete).toEqual(['fiberG', 'sugarG', 'saturatedFatG']);
  });

  it('fails loudly when an ingredient cannot be computed', () => {
    expect(() =>
      recipeNutrition(
        {
          servings: 1,
          ingredients: [
            { id: '1', foodId: 'milk', amount: 100, unit: 'g', position: 0, note: null },
          ],
        },
        foods,
      ),
    ).toThrow(NutritionError);
  });
});

describe('goals', () => {
  const goal = (effectiveFrom: string): Pick<NutritionGoal, 'effectiveFrom' | 'targets'> => ({
    effectiveFrom,
    targets: {
      energyKcal: { auto: 2400, manual: 2200 },
      proteinG: { auto: 160, manual: null },
      carbsG: { auto: null, manual: 250 },
      fatG: { auto: null, manual: null },
      waterMl: { auto: 2500, manual: null },
    },
  });

  it('prefers manual over automatic values and reports the origin', () => {
    expect(effectiveValue({ auto: 2400, manual: 2200 })).toEqual({ value: 2200, origin: 'manual' });
    expect(effectiveValue({ auto: 2400, manual: null })).toEqual({ value: 2400, origin: 'auto' });
    expect(effectiveValue({ auto: null, manual: null })).toEqual({ value: null, origin: null });
    expect(effectiveTargets(goal('2026-01-01'))).toEqual({
      energyKcal: { value: 2200, origin: 'manual' },
      proteinG: { value: 160, origin: 'auto' },
      carbsG: { value: 250, origin: 'manual' },
      fatG: { value: null, origin: null },
      waterMl: { value: 2500, origin: 'auto' },
    });
  });

  it('uses the goal in force on a day', () => {
    const goals = [goal('2026-09-01'), goal('2026-10-01')];
    expect(goalForDate(goals, '2026-08-31')).toBeNull();
    expect(goalForDate(goals, '2026-09-30')?.effectiveFrom).toBe('2026-09-01');
    expect(goalForDate(goals, '2026-10-01')?.effectiveFrom).toBe('2026-10-01');
  });
});

describe('water and days', () => {
  it('adds up water per local day in ml', () => {
    const entries = [
      { localDate: '2026-10-03', amount: 500, unit: 'ml' as const },
      { localDate: '2026-10-03', amount: 0.75, unit: 'l' as const },
      { localDate: '2026-10-02', amount: 2, unit: 'l' as const },
    ];
    expect(waterTotalMl(entries, '2026-10-03')).toBe(1250);
    expect(waterTotalMl(entries, '2026-10-02')).toBe(2000);
    expect(waterTotalMl(entries, '2026-10-01')).toBe(0);
    expect(isValidWaterAmount(0, 'ml')).toBe(false);
    expect(isValidWaterAmount(6, 'l')).toBe(false);
  });

  it('summarises a day overall and per meal', () => {
    const entry = (mealId: string, energyKcal: number, localDate = '2026-10-03') =>
      ({
        localDate,
        mealId,
        nutrients: nutrients({ energyKcal, proteinG: energyKcal / 10 }),
      }) as FoodEntry;
    const summary = summarizeDay('2026-10-03', [
      entry('b', 300),
      entry('l', 600),
      entry('b', 150),
      entry('b', 999, '2026-10-02'),
    ]);
    expect(summary.entryCount).toBe(3);
    expect(summary.totals.totals.energyKcal).toBe(1050);
    expect(summary.meals.map((m) => [m.mealId, m.totals.totals.energyKcal])).toEqual([
      ['b', 450],
      ['l', 600],
    ]);
  });
});

describe('meals', () => {
  it('names defaults by translation and custom meals by their name', () => {
    const t = (key: string) => `t:${key}`;
    expect(mealDisplayName({ defaultKey: 'breakfast', name: null }, t)).toBe('t:breakfast');
    expect(mealDisplayName({ defaultKey: 'breakfast', name: 'Morgens' }, t)).toBe('Morgens');
    expect(mealDisplayName({ defaultKey: null, name: 'Pre-Workout' }, t)).toBe('Pre-Workout');
  });

  it('orders active meals by position', () => {
    const meals = [
      { id: 'c', position: 2, active: true },
      { id: 'a', position: 0, active: true },
      { id: 'x', position: 1, active: false },
    ];
    expect(orderedMeals(meals).map((m) => m.id)).toEqual(['a', 'c']);
  });
});

describe('local food search', () => {
  it('matches name and brand, ignoring case, accents and word order', () => {
    const yoghurt = { name: 'Joghurt Natur', brand: 'Müller' };
    expect(matchesFoodSearch(yoghurt, '')).toBe(true);
    expect(matchesFoodSearch(yoghurt, 'joghurt')).toBe(true);
    expect(matchesFoodSearch(yoghurt, 'MULLER')).toBe(true);
    expect(matchesFoodSearch(yoghurt, 'natur müller')).toBe(true);
    expect(matchesFoodSearch(yoghurt, 'quark')).toBe(false);
    expect(matchesFoodSearch({ name: 'Crème fraîche', brand: null }, 'creme')).toBe(true);
  });
});

describe('goal progress', () => {
  it('reports progress, what is left and the excess neutrally', () => {
    expect(goalProgress(500, 2000)).toEqual({ ratio: 0.25, remaining: 1500, over: 0 });
    expect(goalProgress(2000, 2000)).toEqual({ ratio: 1, remaining: 0, over: 0 });
    expect(goalProgress(2300, 2000)).toEqual({ ratio: 1, remaining: 0, over: 300 });
    expect(goalProgress(0, 0)).toEqual({ ratio: 0, remaining: 0, over: 0 });
  });
});
