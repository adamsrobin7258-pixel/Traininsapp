import { createTranslator } from '@/core/i18n';
import { buildGreeting } from './greeting';
import { formatSummaryValue } from './todaySummary';

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

describe('formatSummaryValue', () => {
  it('formats numbers per locale and keeps missing values empty', () => {
    expect(formatSummaryValue(12500, 'de')).toBe('12.500');
    expect(formatSummaryValue(12500, 'en')).toBe('12,500');
    expect(formatSummaryValue(null, 'de')).toBeNull();
  });
});
