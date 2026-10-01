/**
 * Data catalog: every SQLite table is classified here. The catalog is the single place that
 * decides how a table is protected, exported, deleted and synchronised. A test fails when a
 * migration adds a table without an entry. Rationale: docs/PRIVACY.md.
 */

/** How sensitive the content is. `health` and `location` are special categories (Art. 9 GDPR). */
export type DataSensitivity = 'technical' | 'personal' | 'health' | 'location';

/** Functional area, used for per-area deletion ("delete all nutrition data") and export. */
export type DataCategory =
  'app' | 'profile' | 'training' | 'nutrition' | 'health' | 'activity' | 'location';

export interface TableClassification {
  table: string;
  category: DataCategory;
  sensitivity: DataSensitivity;
  /** Included in the user's data export (right to data portability). */
  exportable: boolean;
  /** Removed when the user deletes the local profile ("delete all my data"). */
  deletedWithProfile: boolean;
  /** Eligible for optional cloud sync once an account exists. */
  syncable: boolean;
}

export const DATA_CATALOG: readonly TableClassification[] = [
  {
    table: 'schema_migrations',
    category: 'app',
    sensitivity: 'technical',
    exportable: false,
    deletedWithProfile: false,
    syncable: false,
  },
  {
    table: 'app_settings',
    category: 'app',
    sensitivity: 'technical',
    exportable: true,
    deletedWithProfile: true,
    syncable: false,
  },
  {
    table: 'diagnostics',
    category: 'app',
    sensitivity: 'technical',
    exportable: false,
    deletedWithProfile: false,
    syncable: false,
  },
  {
    table: 'profiles',
    category: 'profile',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'weight_entries',
    category: 'health',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  // Catalog rows are technical; user rows are personal (custom exercise names).
  {
    table: 'exercises',
    category: 'training',
    sensitivity: 'personal',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'exercise_muscles',
    category: 'training',
    sensitivity: 'technical',
    exportable: false,
    deletedWithProfile: false,
    syncable: false,
  },
  {
    table: 'training_plans',
    category: 'training',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'training_plan_days',
    category: 'training',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'planned_exercises',
    category: 'training',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'workouts',
    category: 'training',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'workout_exercises',
    category: 'training',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'workout_sets',
    category: 'training',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  // Food data itself is not personal; custom foods and favourites are.
  {
    table: 'foods',
    category: 'nutrition',
    sensitivity: 'personal',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'food_servings',
    category: 'nutrition',
    sensitivity: 'personal',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  // Meal configuration (names, order).
  {
    table: 'meal_slots',
    category: 'nutrition',
    sensitivity: 'personal',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'recipes',
    category: 'nutrition',
    sensitivity: 'personal',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'recipe_ingredients',
    category: 'nutrition',
    sensitivity: 'personal',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  // Templates reveal eating habits: treated like the diary.
  {
    table: 'saved_meals',
    category: 'nutrition',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'saved_meal_items',
    category: 'nutrition',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  // What was eaten when: health data (Art. 9 GDPR).
  {
    table: 'food_entries',
    category: 'nutrition',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'nutrition_goals',
    category: 'nutrition',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
  {
    table: 'water_entries',
    category: 'nutrition',
    sensitivity: 'health',
    exportable: true,
    deletedWithProfile: true,
    syncable: true,
  },
];

/**
 * Whether the local database is encrypted at rest. Must be `true` before any table with
 * `health` or `location` sensitivity is added (enforced by dataCatalog.test.ts).
 * SQLCipher via @capacitor-community/sqlite (Android/iOS), validated on a Xiaomi 15 Ultra with
 * SQLCipher 4.17.0 Community (Phase 2). Browser development builds are not encrypted and say so
 * in the UI. See docs/PRIVACY.md.
 */
export const LOCAL_DATABASE_ENCRYPTED = true;

export function requiresEncryptionAtRest(sensitivity: DataSensitivity): boolean {
  return sensitivity === 'health' || sensitivity === 'location';
}

/** Tables whose sensitivity requires encryption at rest that the current setup does not provide. */
export function findUnprotectedTables(
  catalog: readonly TableClassification[],
  databaseEncrypted: boolean,
): TableClassification[] {
  if (databaseEncrypted) return [];
  return catalog.filter((entry) => requiresEncryptionAtRest(entry.sensitivity));
}

export function findClassification(table: string): TableClassification | undefined {
  return DATA_CATALOG.find((entry) => entry.table === table);
}

export function tablesInCategory(category: DataCategory): string[] {
  return DATA_CATALOG.filter((entry) => entry.category === category).map((entry) => entry.table);
}
