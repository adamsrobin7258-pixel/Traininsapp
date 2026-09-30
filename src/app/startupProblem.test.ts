import { DatabaseKeyError, MigrationError } from '@/core/database';
import { classifyStartupError } from './startupProblem';

describe('classifyStartupError', () => {
  it('distinguishes key, migration and other failures', () => {
    expect(classifyStartupError(new DatabaseKeyError('missing-key'))).toBe('key');
    expect(
      classifyStartupError(new MigrationError({ version: 2, name: 'x', up: '' }, { cause: null })),
    ).toBe('migration');
    expect(classifyStartupError(new Error('timeout'))).toBe('generic');
  });
});
