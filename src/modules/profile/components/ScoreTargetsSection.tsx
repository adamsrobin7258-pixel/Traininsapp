import { useState } from 'react';
import { NUTRITION_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useNutritionData } from '@/core/nutrition';
import { ACTIVE_MINUTES_PER_WEEK_OPTIONS, TRAININGS_PER_WEEK_OPTIONS } from '@/core/score';
import { useSettings } from '@/core/settings';
import { toLocalDateKey } from '@/shared/lib/date';
import { Icon, List, ListRow, Section, Sheet } from '@/ui';
import styles from './ScoreTargets.module.css';

type Target = 'trainingsPerWeek' | 'activeMinutesPerWeek';

/**
 * Targets of the Kalethra score: the main goal (from the nutrition profile, changed there) and
 * the two optional weekly targets. Chosen from a list – no keyboard.
 */
export function ScoreTargetsSection() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [open, setOpen] = useState<Target | null>(null);
  const today = toLocalDateKey(new Date());
  const goal = useNutritionData((s, profileId) => s.goals.goalFor(profileId, today), [today]);
  const goalType = goal.status === 'ready' ? (goal.data?.goal.goalType ?? null) : null;

  const trainingsValue =
    settings.trainingsPerWeek === null
      ? t('profile.scoreTargets.none')
      : t('profile.scoreTargets.trainingsValue', { count: settings.trainingsPerWeek });
  const minutesValue =
    settings.activeMinutesPerWeek === null
      ? t('profile.scoreTargets.none')
      : t('profile.scoreTargets.minutesValue', { count: settings.activeMinutesPerWeek });

  return (
    <Section title={t('profile.scoreTargets.title')} footer={t('profile.scoreTargets.footer')}>
      <List>
        <ListRow
          title={t('profile.scoreTargets.mainGoal')}
          value={
            goalType
              ? t(`nutrition.goalTypes.${goalType}`)
              : t('profile.scoreTargets.mainGoalUnset')
          }
          to={NUTRITION_LINKS.profile}
        />
        <ListRow
          title={t('profile.scoreTargets.trainings')}
          value={trainingsValue}
          onPress={() => {
            setOpen('trainingsPerWeek');
          }}
        />
        <ListRow
          title={t('profile.scoreTargets.minutes')}
          value={minutesValue}
          onPress={() => {
            setOpen('activeMinutesPerWeek');
          }}
        />
      </List>
      {open ? (
        <TargetSheet
          target={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </Section>
  );
}

function TargetSheet({ target, onClose }: { target: Target; onClose: () => void }) {
  const { t } = useI18n();
  const { settings, updateSetting } = useSettings();
  const [failed, setFailed] = useState(false);
  const current = settings[target];
  const options: readonly (number | null)[] = [
    null,
    ...(target === 'trainingsPerWeek'
      ? TRAININGS_PER_WEEK_OPTIONS
      : ACTIVE_MINUTES_PER_WEEK_OPTIONS),
  ];
  const title =
    target === 'trainingsPerWeek'
      ? t('profile.scoreTargets.trainings')
      : t('profile.scoreTargets.minutes');
  const label = (value: number | null) =>
    value === null
      ? t('profile.scoreTargets.none')
      : target === 'trainingsPerWeek'
        ? t('profile.scoreTargets.trainingsValue', { count: value })
        : t('profile.scoreTargets.minutesValue', { count: value });

  function choose(value: number | null) {
    setFailed(false);
    updateSetting(target, value).then(onClose, () => {
      setFailed(true);
    });
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')}>
      <p className={styles.hint}>
        {target === 'trainingsPerWeek'
          ? t('profile.scoreTargets.trainingsHint')
          : t('profile.scoreTargets.minutesHint')}
      </p>
      <ul className={styles.options} aria-label={title}>
        {options.map((value) => {
          const selected = value === current;
          return (
            <li key={value ?? 'none'}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={selected}
                onClick={() => {
                  choose(value);
                }}
              >
                <span>{label(value)}</span>
                {selected ? <Icon name="check" size={20} className={styles.check} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p className={styles.error} role="alert">
          {t('profile.scoreTargets.failed')}
        </p>
      ) : null}
    </Sheet>
  );
}
