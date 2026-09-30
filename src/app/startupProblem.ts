import { DatabaseKeyError, MigrationError } from '@/core/database';

/** What went wrong during startup, in terms the user can act on. */
export type StartupProblem = 'key' | 'migration' | 'generic';

export function classifyStartupError(error: unknown): StartupProblem {
  if (error instanceof DatabaseKeyError) return 'key';
  if (error instanceof MigrationError) return 'migration';
  return 'generic';
}
