import { convertQuantity } from './units';

/** Water, independent of the calorie and macro model. */
export const WATER_UNITS = ['ml', 'l'] as const;
export type WaterUnit = (typeof WATER_UNITS)[number];

export interface WaterEntry {
  id: string;
  profileId: string;
  localDate: string;
  amount: number;
  unit: WaterUnit;
  /** Optional time of drinking (ISO-8601 UTC). */
  drankAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Plausible single entry: up to 5 litres. */
export function isValidWaterAmount(amount: number, unit: WaterUnit): boolean {
  const ml = convertQuantity(amount, unit, 'ml');
  return ml !== null && Number.isFinite(ml) && ml > 0 && ml <= 5000;
}

/** Total millilitres of one local day. */
export function waterTotalMl(
  entries: readonly Pick<WaterEntry, 'localDate' | 'amount' | 'unit'>[],
  localDate: string,
): number {
  return entries
    .filter((entry) => entry.localDate === localDate)
    .reduce((sum, entry) => sum + (convertQuantity(entry.amount, entry.unit, 'ml') ?? 0), 0);
}
