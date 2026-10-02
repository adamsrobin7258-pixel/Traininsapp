import { createTranslator } from '@/core/i18n';
import { buildGreeting } from './greeting';

describe('buildGreeting', () => {
  const morning = new Date(2026, 8, 30, 7);
  const evening = new Date(2026, 8, 30, 20);

  it('greets by time of day and name', () => {
    expect(buildGreeting(createTranslator('de'), morning, 'Anna')).toBe('Guten Morgen, Anna');
    expect(buildGreeting(createTranslator('en'), evening, 'Anna')).toBe('Good evening, Anna');
  });

  it('omits the name when none is set', () => {
    expect(buildGreeting(createTranslator('de'), evening, null)).toBe('Guten Abend');
  });
});
