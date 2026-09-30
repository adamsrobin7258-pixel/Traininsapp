/**
 * Read access to body weight for nutrition calculations (e.g. protein per kg, later automatic
 * goals). Weight is owned by the health module (`weight_entries`); this is only a view on it,
 * wired in the app's composition root – nutrition never stores weight itself.
 */
export interface BodyWeightSource {
  /** Latest weight in kg on or before a local day, `null` if none is known. */
  latestKgOnOrBefore(profileId: string, localDate: string): Promise<number | null>;
}
