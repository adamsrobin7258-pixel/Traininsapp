import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import { NutritionError } from './errors';
import {
  FOOD_NAME_MAX_LENGTH,
  RECENT_FOODS_LIMIT,
  isValidAmount,
  type Food,
  type FoodServing,
  type ReferenceQuantity,
} from './food';
import { optionalText, requireName } from './names';
import { areValidNutrients, type Nutrients } from './nutrients';
import type { NutritionStore } from './nutritionStore';
import { barcodeVariants, normalizeBarcode } from './barcode';
import type { ExternalFood } from './provider';
import { isQuantityUnit } from './units';

export interface FoodInput {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  reference: ReferenceQuantity;
  nutrients: Nutrients;
  servings?: FoodServing[];
}

/** Custom foods, favourites and the local copy of external products. */
export class FoodService {
  constructor(
    private readonly store: NutritionStore,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  list(profileId: string, options?: { includeInactive?: boolean; favoritesOnly?: boolean }) {
    return this.store.repos.foods.list(profileId, options);
  }

  async get(profileId: string, id: string): Promise<Food> {
    const food = await this.store.repos.foods.findById(profileId, id);
    if (!food) throw new NutritionError('not-found');
    return food;
  }

  /** Several foods by id, including hidden ones (e.g. the items of a saved meal). */
  findMany(profileId: string, ids: readonly string[]): Promise<Food[]> {
    return this.store.repos.foods.findManyById(profileId, ids);
  }

  /** Locally stored foods with this barcode (offline lookup before asking a provider). */
  async findByBarcode(profileId: string, barcode: string): Promise<Food[]> {
    const code = normalizeBarcode(barcode) ?? barcode.trim();
    const found: Food[] = [];
    for (const variant of barcodeVariants(code)) {
      for (const food of await this.store.repos.foods.findByBarcode(profileId, variant)) {
        if (!found.some((f) => f.id === food.id)) found.push(food);
      }
    }
    return found;
  }

  /** Recently used foods, newest use first (see FoodRepository.listRecent). */
  recent(profileId: string, limit: number = RECENT_FOODS_LIMIT): Promise<Food[]> {
    return this.store.repos.foods.listRecent(profileId, limit);
  }

  /** A product already imported from this provider, if any. */
  findImported(profileId: string, provider: string, externalId: string): Promise<Food | null> {
    return this.store.repos.foods.findExternal(profileId, provider, externalId);
  }

  /**
   * Stores a product from an external provider after the user reviewed (and maybe corrected)
   * its values. The result is an ordinary local food (source `external`), usable offline. If
   * the product was imported before, that food is updated instead of creating a duplicate.
   */
  async saveImported(
    profileId: string,
    origin: { provider: string; externalId: string },
    input: FoodInput,
  ): Promise<Food> {
    if (!origin.provider.trim() || !origin.externalId.trim()) {
      throw new NutritionError('invalid-value');
    }
    const data = validated(input);
    const now = this.now();
    return this.store.atomic(async (repos) => {
      const existing = await repos.foods.findExternal(
        profileId,
        origin.provider,
        origin.externalId,
      );
      if (existing) {
        const food: Food = { ...existing, ...data, active: true, updatedAt: now };
        await repos.foods.update(food);
        if (!existing.active) await repos.foods.setFlag(food.id, 'active', true, now);
        return food;
      }
      const food: Food = {
        id: createId(),
        profileId,
        source: 'external',
        provider: origin.provider,
        externalId: origin.externalId,
        ...data,
        favorite: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await repos.foods.insert(food);
      return food;
    });
  }

  async create(profileId: string, input: FoodInput): Promise<Food> {
    const now = this.now();
    const food: Food = {
      id: createId(),
      profileId,
      source: 'custom',
      provider: null,
      externalId: null,
      ...validated(input),
      favorite: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.foods.insert(food));
    return food;
  }

  /** Corrects a food. Past diary entries keep their stored values (snapshots). */
  async update(profileId: string, id: string, input: FoodInput): Promise<Food> {
    const current = await this.owned(profileId, id);
    const food: Food = { ...current, ...validated(input), updatedAt: this.now() };
    await this.store.atomic((repos) => repos.foods.update(food));
    return food;
  }

  async setFavorite(profileId: string, id: string, favorite: boolean): Promise<void> {
    await this.owned(profileId, id);
    await this.store.repos.foods.setFlag(id, 'favorite', favorite, this.now());
  }

  /** Deactivated foods disappear from the search; history, templates and recipes keep them. */
  async setActive(profileId: string, id: string, active: boolean): Promise<void> {
    await this.owned(profileId, id);
    await this.store.repos.foods.setFlag(id, 'active', active, this.now());
  }

  /**
   * "Deletes" a food: removed for good while nothing refers to it, otherwise only deactivated
   * so logged days, saved meals and recipes stay intact.
   */
  async remove(profileId: string, id: string): Promise<'deleted' | 'deactivated'> {
    await this.owned(profileId, id);
    const now = this.now();
    return this.store.atomic(async (repos) => {
      if (await repos.foods.isReferenced(id)) {
        await repos.foods.setFlag(id, 'active', false, now);
        return 'deactivated';
      }
      await repos.foods.delete(id);
      return 'deleted';
    });
  }

  /**
   * Stores a product from an external provider locally (or refreshes the stored copy), so it
   * can be used offline afterwards. Only food data is involved.
   */
  async importExternal(profileId: string, external: ExternalFood): Promise<Food> {
    if (!external.provider.trim() || !external.externalId.trim()) {
      throw new NutritionError('invalid-value');
    }
    const data = validated(external);
    const existing = await this.store.repos.foods.findExternal(
      profileId,
      external.provider,
      external.externalId,
    );
    const now = this.now();
    if (existing) {
      const food: Food = { ...existing, ...data, updatedAt: now };
      await this.store.atomic((repos) => repos.foods.update(food));
      return food;
    }
    const food: Food = {
      id: createId(),
      profileId,
      source: 'external',
      provider: external.provider,
      externalId: external.externalId,
      ...data,
      favorite: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.atomic((repos) => repos.foods.insert(food));
    return food;
  }

  private async owned(profileId: string, id: string): Promise<Food> {
    const food = await this.get(profileId, id);
    // App-provided foods belong to nobody and cannot be changed.
    if (food.profileId !== profileId) throw new NutritionError('not-found');
    return food;
  }
}

function validated(input: FoodInput) {
  const { reference, nutrients } = input;
  if (!isQuantityUnit(reference.unit) || !isValidAmount(reference.amount)) {
    throw new NutritionError('invalid-unit');
  }
  if (!areValidNutrients(nutrients)) throw new NutritionError('invalid-value');
  const servings = input.servings ?? [];
  const units = new Set(servings.map((s) => s.unit));
  if (
    units.size !== servings.length ||
    servings.some((s) => !isValidAmount(s.amount) || !['g', 'ml'].includes(s.amountUnit))
  ) {
    throw new NutritionError('invalid-value');
  }
  return {
    name: requireName(input.name, FOOD_NAME_MAX_LENGTH),
    brand: optionalText(input.brand, FOOD_NAME_MAX_LENGTH),
    barcode: checkedBarcode(input.barcode),
    reference: { ...reference },
    nutrients: { ...nutrients },
    servings: servings.map((s) => ({ ...s, label: optionalText(s.label, 40) })),
  };
}

function checkedBarcode(input: string | null | undefined): string | null {
  const text = input?.trim() ?? '';
  if (text === '') return null;
  const code = normalizeBarcode(text);
  if (!code) throw new NutritionError('invalid-barcode');
  return code;
}
