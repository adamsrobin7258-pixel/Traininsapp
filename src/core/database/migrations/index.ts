import { migration001Initial } from './001_initial';
import type { Migration } from './types';

/** All migrations in ascending order. Append new migrations at the end. */
export const migrations: readonly Migration[] = [migration001Initial];

export type { Migration } from './types';
