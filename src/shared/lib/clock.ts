/** Injectable time source so that business logic stays deterministic in tests. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
