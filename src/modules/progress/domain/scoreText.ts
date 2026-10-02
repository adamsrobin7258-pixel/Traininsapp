import type { TranslateFn } from '@/core/i18n';
import type { AreaScores, ScoreArea } from '@/core/score';
import type { ProgressPeriod } from './period';

/**
 * Sentences that explain each area of the score – built only from the figures the calculation
 * actually used, never invented. Pure.
 */
export function areaExplanation(
  area: ScoreArea,
  areas: AreaScores,
  period: ProgressPeriod,
  periodDays: number,
  t: TranslateFn,
  locale: string,
): string[] {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  switch (area) {
    case 'nutrition': {
      const { score, detail } = areas.nutrition;
      if (detail.loggedDays === 0) return [t('progress.score.detail.nutrition.none')];
      const lines: string[] = [];
      if (score === null || detail.avgKcalDeviationPct === null) {
        if (score === null) lines.push(t('progress.score.detail.nutrition.notRated'));
      } else if (Math.abs(detail.avgKcalDeviationPct) <= 5) {
        lines.push(t('progress.score.detail.nutrition.near'));
      } else {
        lines.push(
          t(
            detail.avgKcalDeviationPct > 0
              ? 'progress.score.detail.nutrition.over'
              : 'progress.score.detail.nutrition.under',
            { value: Math.abs(detail.avgKcalDeviationPct) },
          ),
        );
      }
      if (detail.proteinRatedDays > 0) {
        lines.push(
          t('progress.score.detail.nutrition.protein', {
            reached: detail.proteinReachedDays,
            total: detail.proteinRatedDays,
          }),
        );
      }
      lines.push(
        t('progress.score.detail.nutrition.logged', {
          count: detail.loggedDays,
          total: periodDays,
        }),
      );
      return lines;
    }
    case 'training': {
      const { detail } = areas.training;
      const lines: string[] = [];
      if (detail.target === null || detail.expected === null) {
        lines.push(t('progress.score.detail.training.noTarget', { done: detail.done }));
      } else if (period === 'today') {
        lines.push(
          t(
            detail.done > 0
              ? 'progress.score.detail.training.todayDone'
              : 'progress.score.detail.training.todayOpen',
          ),
        );
      } else {
        lines.push(
          t('progress.score.detail.training.progress', {
            done: detail.done,
            expected: number.format(detail.expected),
            target: detail.target,
          }),
        );
      }
      if (detail.restDays > 0) {
        lines.push(t('progress.score.detail.training.restDays', { count: detail.restDays }));
      }
      lines.push(t('progress.score.detail.training.separate'));
      return lines;
    }
    case 'activity': {
      const { score, detail } = areas.activity;
      if (detail.target === null || detail.expectedMinutes === null) {
        return [t('progress.score.detail.activity.noTarget', { minutes: detail.minutes })];
      }
      if (detail.minutes === 0) return [t('progress.score.detail.activity.none')];
      const lines = [
        t('progress.score.detail.activity.progress', {
          minutes: detail.minutes,
          expected: detail.expectedMinutes,
          target: detail.target,
          days: detail.activeDays,
        }),
      ];
      if (score === 100 && detail.minutes > detail.expectedMinutes) {
        lines.push(t('progress.score.detail.activity.capped'));
      }
      return lines;
    }
    case 'recovery': {
      const { score, detail } = areas.recovery;
      const lines: string[] = [];
      if (score === null) {
        lines.push(t('progress.score.detail.recovery.none'));
      } else {
        lines.push(
          t(
            score >= 80
              ? 'progress.score.detail.recovery.mostlyGood'
              : score >= 50
                ? 'progress.score.detail.recovery.mixed'
                : 'progress.score.detail.recovery.mostlyPoor',
          ),
          t('progress.score.detail.recovery.counts', {
            good: detail.good,
            moderate: detail.moderate,
            poor: detail.poor,
          }),
        );
      }
      if (detail.restDays > 0) {
        lines.push(t('progress.score.detail.recovery.restDays', { count: detail.restDays }));
      }
      return lines;
    }
  }
}
