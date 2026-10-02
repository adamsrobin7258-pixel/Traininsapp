import { de } from '@/core/i18n/locales/de';
import { en } from '@/core/i18n/locales/en';
import { activeKcal, estimateCalories, resolveMet } from './calories';
import {
  defaultIntensity,
  defaultVariant,
  INTENSITIES,
  SPORT_CATEGORIES,
  sportById,
  sportIntensities,
  SPORTS,
  sportVariants,
  VARIANT_OPTIONS,
  type SportDefinition,
} from './catalog';
import { searchSports } from './sportSearch';

const sport = (id: string): SportDefinition => {
  const found = sportById(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

const input = (minutes: number, extra: Partial<Parameters<typeof resolveMet>[1]> = {}) => ({
  durationS: minutes * 60,
  distanceM: null,
  intensity: null,
  variant: null,
  ...extra,
});

describe('sport catalog', () => {
  it('has a broad but manageable set of sports with unique, stable IDs', () => {
    expect(SPORTS.length).toBeGreaterThanOrEqual(40);
    expect(SPORTS.length).toBeLessThanOrEqual(70);
    expect(new Set(SPORTS.map((s) => s.id)).size).toBe(SPORTS.length);
    for (const s of SPORTS) expect(s.id).toMatch(/^[a-z][a-z-]*$/);
  });

  it('contains the required sports', () => {
    const names = SPORTS.map((s) => s.nameDe);
    for (const name of [
      'Spazieren',
      'Zügiges Gehen',
      'Wandern',
      'Bergwandern',
      'Joggen',
      'Laufen',
      'Schneller Lauf',
      'Radfahren',
      'Indoor Cycling / Spinning',
      'Mountainbike',
      'Schwimmen',
      'Brustschwimmen',
      'Freistil / Kraulen',
      'Wassergymnastik',
      'Rudern (Boot)',
      'Tennis',
      'Badminton',
      'Tischtennis',
      'Squash',
      'Padel',
      'Fußball',
      'Basketball',
      'Volleyball',
      'Handball',
      'HIIT',
      'Hyrox',
      'CrossFit',
      'Zirkeltraining',
      'Seilspringen',
      'Crosstrainer',
      'Stairmaster / Treppensteigen',
      'Boxen',
      'Kickboxen',
      'Muay Thai',
      'Judo / Grappling',
      'Kampfsport allgemein',
      'Skifahren',
      'Langlauf',
      'Snowboard',
      'Eislaufen',
      'Yoga',
      'Pilates',
      'Stretching',
      'Tanzen',
      'Klettern / Bouldern',
      'Inline-Skating',
      'Golf',
      'Reiten',
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it('gives every sport German and English names, a category and a sourced MET model', () => {
    for (const s of SPORTS) {
      expect(s.nameDe.length, s.id).toBeGreaterThan(1);
      expect(s.nameEn.length, s.id).toBeGreaterThan(1);
      expect(SPORT_CATEGORIES).toContain(s.category);
      const values =
        s.met.kind === 'fixed'
          ? [s.met.value]
          : s.met.kind === 'intensity'
            ? Object.values(s.met.levels)
            : s.met.kind === 'variant'
              ? Object.values(s.met.options)
              : [
                  s.met.fallback,
                  ...s.met.bands.map((b) => b.value),
                  ...Object.values(s.met.levels ?? {}),
                ];
      for (const value of values) {
        expect(value.met, s.id).toBeGreaterThanOrEqual(1);
        expect(value.met, s.id).toBeLessThanOrEqual(25);
        expect(value.ref.length, s.id).toBeGreaterThan(5);
        expect(['specific', 'general']).toContain(value.basis);
      }
    }
  });

  it('offers form fields that fit the MET model', () => {
    for (const s of SPORTS) {
      if (s.fields.intensity) {
        expect(sportIntensities(s).length, s.id).toBeGreaterThanOrEqual(2);
        expect(sportIntensities(s), s.id).toContain(defaultIntensity(s));
      } else {
        expect(sportIntensities(s), s.id).toEqual([]);
      }
      if (s.fields.variant) {
        expect(s.met.kind, s.id).toBe('variant');
        expect(sportVariants(s).length, s.id).toBeGreaterThanOrEqual(2);
        expect(defaultVariant(s), s.id).not.toBeNull();
      }
    }
    expect(sport('tennis').fields.variant).toBe('tennisFormat');
    expect(sport('jog').fields.distance).toBe('optional');
    expect(sport('yoga').fields.distance).toBeUndefined();
  });

  it('translates categories, intensities and variant options', () => {
    for (const category of SPORT_CATEGORIES) {
      expect(de.activities.categories[category]).toBeTruthy();
      expect(en.activities.categories[category]).toBeTruthy();
    }
    for (const level of INTENSITIES) {
      expect(de.activities.manual.intensities[level]).toBeTruthy();
      expect(en.activities.manual.intensities[level]).toBeTruthy();
    }
    for (const option of Object.values(VARIANT_OPTIONS).flat()) {
      expect(de.activities.manual.variantOptions[option]).toBeTruthy();
      expect(en.activities.manual.variantOptions[option]).toBeTruthy();
    }
  });

  it('finds sports in both languages, with spelling variants', () => {
    expect(searchSports('fussball', 'de')[0]?.id).toBe('soccer');
    expect(searchSports('soccer', 'de')[0]?.id).toBe('soccer');
    expect(searchSports('jogg', 'de')[0]?.id).toBe('jog');
    expect(searchSports('tennis', 'en').map((s) => s.id)).toEqual(['tennis', 'table-tennis']);
    expect(searchSports('', 'de')).toHaveLength(SPORTS.length);
    expect(searchSports('xyzq', 'de')).toEqual([]);
  });
});

describe('MET selection', () => {
  it('uses the fixed value', () => {
    expect(resolveMet(sport('table-tennis'), input(30))).toMatchObject({ met: 4.0 });
  });

  it('uses the chosen intensity and falls back to the default', () => {
    const soccer = sport('soccer');
    expect(resolveMet(soccer, input(60, { intensity: 'moderate' })).met).toBe(7.0);
    expect(resolveMet(soccer, input(60, { intensity: 'vigorous' })).met).toBe(10.0);
    // Not offered for soccer → default (moderate).
    expect(resolveMet(soccer, input(60, { intensity: 'light' })).met).toBe(7.0);
    expect(resolveMet(soccer, input(60)).met).toBe(7.0);
  });

  it('uses the chosen variant', () => {
    expect(resolveMet(sport('tennis'), input(60, { variant: 'singles' })).met).toBe(8.0);
    expect(resolveMet(sport('tennis'), input(60, { variant: 'doubles' })).met).toBe(6.0);
    expect(resolveMet(sport('tennis'), input(60)).met).toBe(8.0);
  });

  it('picks the running speed band from distance and duration', () => {
    const jog = sport('jog');
    // 7.2 km in 48 min = 9.0 km/h → nearest entry 6 mph (9.7 km/h): 9.8 MET.
    expect(resolveMet(jog, input(48, { distanceM: 7200 }))).toMatchObject({
      met: 9.8,
      speedKmh: 9,
    });
    // 6 km in 45 min = 8.0 km/h → 5 mph (8.0 km/h): 8.3 MET.
    expect(resolveMet(jog, input(45, { distanceM: 6000 })).met).toBe(8.3);
    // Bands switch half-way between two entries: 8.8 km/h → 8.3, 8.9 km/h → 9.8.
    expect(resolveMet(jog, input(60, { distanceM: 8800 })).met).toBe(8.3);
    expect(resolveMet(jog, input(60, { distanceM: 8900 })).met).toBe(9.8);
    // 10 km in 50 min = 12 km/h → 11.0 MET (7 mph band).
    expect(resolveMet(jog, input(50, { distanceM: 10000 })).met).toBe(11.0);
    // Without a distance: jogging, general.
    expect(resolveMet(jog, input(48))).toMatchObject({ met: 7.0, speedKmh: null });
  });

  it('picks the cycling band from speed, otherwise the intensity', () => {
    const cycle = sport('cycle');
    expect(resolveMet(cycle, input(60, { distanceM: 21000 })).met).toBe(8.0);
    expect(resolveMet(cycle, input(60, { intensity: 'vigorous' })).met).toBe(10.0);
    expect(resolveMet(cycle, input(60)).met).toBe(7.5);
  });

  it('marks values without a specific Compendium entry as general', () => {
    expect(resolveMet(sport('padel'), input(60)).basis).toBe('general');
    expect(resolveMet(sport('hyrox'), input(60)).basis).toBe('general');
    expect(resolveMet(sport('tennis'), input(60)).basis).toBe('specific');
  });
});

describe('active calories', () => {
  it('is (MET − 1) × 3.5 × kg ÷ 200 × minutes, rounded to whole kcal', () => {
    // (8.0 − 1) × 3.5 × 80 ÷ 200 × 90 = 882
    expect(activeKcal(8.0, 80, 90 * 60)).toBe(882);
    // (8.3 − 1) × 3.5 × 84.6 ÷ 200 × 48 = 518.8 → 519
    expect(activeKcal(8.3, 84.6, 48 * 60)).toBe(519);
  });

  it('scales with weight and duration', () => {
    expect(activeKcal(7, 100, 3600)).toBe(2 * activeKcal(7, 50, 3600));
    expect(activeKcal(7, 80, 7200)).toBe(2 * activeKcal(7, 80, 3600));
  });

  it('is 0 at rest level and never negative', () => {
    expect(activeKcal(1, 80, 3600)).toBe(0);
    expect(activeKcal(0.5, 80, 3600)).toBe(0);
    expect(activeKcal(5, 80, 0)).toBe(0);
  });

  it('is deterministic', () => {
    const run = () => estimateCalories(sport('jog'), input(48, { distanceM: 7200 }), 84.6);
    expect(run()).toEqual(run());
  });

  it('calculates nothing without a body weight – no guessed value', () => {
    expect(estimateCalories(sport('tennis'), input(90), null).kcal).toBeNull();
    expect(estimateCalories(sport('tennis'), input(90), 0).kcal).toBeNull();
  });

  it('gives plausible values for typical sessions', () => {
    // Tennis singles, 90 min, 80 kg → (8 − 1) × 3.5 × 80 / 200 × 90 = 882 kcal.
    expect(estimateCalories(sport('tennis'), input(90, { variant: 'singles' }), 80).kcal).toBe(882);
    // Yoga (Hatha), 60 min, 70 kg → (2.5 − 1) × 3.5 × 70 / 200 × 60 = 110 kcal.
    expect(estimateCalories(sport('yoga'), input(60), 70).kcal).toBe(110);
  });
});
