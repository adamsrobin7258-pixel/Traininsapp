export interface Migration {
  /** Strictly increasing integer. Never change or reuse a released version. */
  version: number;
  /** Short snake_case description, stored for diagnostics. */
  name: string;
  /** SQL executed inside a transaction. */
  up: string;
}
