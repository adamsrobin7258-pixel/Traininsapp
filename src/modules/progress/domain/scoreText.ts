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
      if (detail.runningDay && score !== null) {
        lines.push(t('progress.score.detail.nutrition.running'));
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
      const { detail } = areas.activity;
      const lines: string[] = [];
      if (detail.target === null || detail.expectedMinutes === null) {
        lines.push(t('progress.score.detail.activity.noTarget', { minutes: detail.minutes }));
      } else if (detail.minutes === 0) {
        lines.push(t('progress.score.detail.activity.none'));
      } else {
        lines.push(
          t('progress.score.detail.activity.progress', {
            minutes: detail.minutes,
            expected: detail.expectedMinutes,
            target: detail.target,
            days: detail.activeDays,
          }),
        );
        if (detail.minutesScore === 100 && detail.minutes > detail.expectedMinutes) {
          lines.push(t('progress.score.detail.activity.capped'));
        }
      }
      // Steps are a second signal inside this area – mentioned only when a step goal exists.
      const steps = detail.steps;
      if (steps.target !== null && steps.avgSteps !== null) {
        lines.push(
          t('progress.score.detail.activity.steps', {
            steps: number.format(steps.avgSteps),
            goal: number.format(steps.target),
            reached: steps.reachedDays,
            total: steps.ratedDays,
          }),
        );
        if (detail.minutesScore !== null) {
          lines.push(t('progress.score.detail.activity.combined'));
        }
      } else if (steps.target !== null) {
        lines.push(
          t('progress.score.detail.activity.stepsNone', { goal: number.format(steps.target) }),
        );
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
