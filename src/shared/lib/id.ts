/**
 * Creates a globally unique identifier for locally created records.
 * UUIDs allow records to be created offline on several devices and merged later
 * without id collisions (see docs/DATABASE.md, "Synchronisierung").
 */
export function createId(): string {
  return crypto.randomUUID();
}
