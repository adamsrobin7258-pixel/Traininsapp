import { externalProduct } from '@/test/fakeFoodProvider';
import { assessProductQuality, dedupeProducts, QUALITY_PENALTY } from './productQuality';
import type { ExternalProduct, ProductQualitySignals } from './provider';

/** Phase 28 – data quality and duplicates of Open Food Facts records in the search. */
const values = externalProduct().nutrients;
const signals = (change: Partial<ProductQualitySignals> = {}): ProductQualitySignals => ({
  completeness: 0.8,
  errors: [],
  warnings: [],
  nutritionComplete: true,
  ...change,
});

describe('quality classes (balanced mode)', () => {
  it('A: name, brand and every main value, consistent, no warning', () => {
    expect(assessProductQuality(externalProduct())).toBe('A');
    expect(assessProductQuality(externalProduct({ qualitySignals: signals() }))).toBe('A');
  });

  it('B: usable, but something is missing or doubtful', () => {
    const cases: ExternalProduct[] = [
      externalProduct({ nutrients: { ...values, fatG: null }, missing: ['fatG'] }),
      externalProduct({ brand: null }),
      externalProduct({ qualitySignals: signals({ nutritionComplete: false }) }),
      externalProduct({ qualitySignals: signals({ completeness: 0.2 }) }),
      externalProduct({
        qualitySignals: signals({ warnings: ['en:nutrition-value-very-high-for-category-sugars'] }),
      }),
    ];
    for (const product of cases) expect(assessProductQuality(product)).toBe('B');
    // A warning about something the app does not use changes nothing.
    expect(
      assessProductQuality(
        externalProduct({ qualitySignals: signals({ warnings: ['en:ingredients-de-5-photos'] }) }),
      ),
    ).toBe('A');
  });

  it('C: no name, no calories, no macro at all, contradictions or provider errors', () => {
    const cases: ExternalProduct[] = [
      externalProduct({ name: '' }),
      externalProduct({ nutrients: { ...values, energyKcal: null }, missing: ['energyKcal'] }),
      externalProduct({
        nutrients: { ...values, proteinG: null, carbsG: null, fatG: null },
        missing: ['proteinG', 'carbsG', 'fatG'],
      }),
      // 500 kcal from 2 g of everything – one of the values is wrong.
      externalProduct({
        nutrients: { ...values, energyKcal: 500, proteinG: 2, carbsG: 2, fatG: 2 },
      }),
      // More than 100 g of macros per 100 g.
      externalProduct({
        nutrients: { ...values, energyKcal: 900, proteinG: 50, carbsG: 60, fatG: 40 },
      }),
      externalProduct({
        qualitySignals: signals({ errors: ['en:energy-value-in-kcal-does-not-match-value-in-kj'] }),
      }),
    ];
    for (const product of cases) expect(assessProductQuality(product)).toBe('C');
  });

  it('completeness alone never decides: a complete record with an error is still C', () => {
    expect(
      assessProductQuality(
        externalProduct({ qualitySignals: signals({ completeness: 1, errors: ['en:x'] }) }),
      ),
    ).toBe('C');
    expect(QUALITY_PENALTY.B).toBeLessThan(0);
    expect(QUALITY_PENALTY.B).toBeGreaterThan(-20);
  });
});

describe('duplicates', () => {
  const quark = (change: Partial<ExternalProduct>) =>
    externalProduct({ name: 'Magerquark', brand: 'Milbona', packageSize: '500 g', ...change });

  it('the same barcode is one product – the better record stays, at the first place', () => {
    const sparse = quark({
      externalId: '4056489000001',
      barcode: '4056489000001',
      nutrients: { ...values, fatG: null },
      missing: ['fatG'],
    });
    const full = quark({ externalId: '4056489000001', barcode: '4056489000001' });
    const other = quark({
      externalId: '4056489000002',
      barcode: '4056489000002',
      packageSize: '250 g',
    });
    const result = dedupeProducts([sparse, other, full]);
    expect(result).toEqual([full, other]);
  });

  it('different package sizes stay apart – 250 g and 500 g are two products', () => {
    const small = quark({ externalId: '1', barcode: '40000001', packageSize: '250 g' });
    const large = quark({ externalId: '2', barcode: '40000002', packageSize: '500 g' });
    expect(dedupeProducts([small, large])).toHaveLength(2);
  });

  it('without a shared barcode only brand, name and size together (and the same energy) merge', () => {
    const a = quark({ externalId: '1', barcode: '40000001' });
    const b = quark({ externalId: '2', barcode: '40000002', packageSize: '500g' });
    expect(dedupeProducts([a, b])).toEqual([a]);
    // A different recipe under the same name stays.
    const lighter = quark({
      externalId: '3',
      barcode: '40000003',
      nutrients: { ...values, energyKcal: 48 },
    });
    expect(dedupeProducts([a, lighter])).toHaveLength(2);
    // Unknown size or brand: never merged.
    const noSize = quark({ externalId: '4', barcode: '40000004', packageSize: null });
    const noBrand = quark({ externalId: '5', barcode: '40000005', brand: null });
    expect(dedupeProducts([a, noSize, noBrand])).toHaveLength(3);
  });
});
