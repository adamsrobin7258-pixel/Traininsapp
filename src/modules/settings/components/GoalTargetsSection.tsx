import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { TARGET_OPTIONS, useTargetData, useTargets, type TargetKind } from '@/core/targets';
import { Icon, List, ListRow, Section, Sheet } from '@/ui';
import styles from './GoalTargets.module.css';
import { ProgressionRow } from './TrainingSettingsRows';

/** The targets with a value; the switch "Aktivitätskalorien anrechnen" has its own section. */
type ValueKind = Exclude<TargetKind, 'activityCalories'>;

const SECTIONS: readonly { kind: ValueKind; group: 'training' | 'activity' | 'health' }[] = [
  { kind: 'trainingsPerWeek', group: 'training' },
  { kind: 'activeMinutesPerWeek', group: 'activity' },
  { kind: 'stepsPerDay', group: 'health' },
];

/**
 * The versioned personal targets – workouts and active minutes per week, steps per day – each
 * in its group of Einstellungen → Ziele. A change applies from today on; past days keep the
 * target that applied then. Chosen from a list – no keyboard.
 */
export function GoalTargetsSections() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<ValueKind | null>(null);
  const current = useTargetData((service, profileId) => service.current(profileId), []);
  const value = (kind: TargetKind) => (current.status === 'ready' ? current.data[kind] : null);
  const number = new Intl.NumberFormat(locale);
  const label = (kind: ValueKind, amount: number | null) =>
    amount === null
      ? t('settings.targets.none')
      : t(`settings.targets.${kind}.value`, { count: number.format(amount) });

  return (
    <>
      {SECTIONS.map(({ kind, group }) => (
        <Section
          key={kind}
          title={t(`settings.goals.${group}`)}
          footer={t(`settings.targets.${kind}.footer`)}
        >
          <List>
            <ListRow
              title={t(`settings.targets.${kind}.title`)}
              value={current.status === 'ready' ? label(kind, value(kind)) : undefined}
              onPress={() => {
                setOpen(kind);
              }}
            />
            {group === 'training' ? <ProgressionRow /> : null}
          </List>
        </Section>
      ))}
      {open ? (
        <TargetSheet
          kind={open}
          current={value(open)}
          label={(amount) => label(open, amount)}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </>
  );
}

function TargetSheet({
  kind,
  current,
  label,
  onClose,
}: {
  kind: ValueKind;
  current: number | null;
  label: (amount: number | null) => string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { set } = useTargets();
  const [failed, setFailed] = useState(false);
  const title = t(`settings.targets.${kind}.title`);
  const options: readonly (number | null)[] = [null, ...TARGET_OPTIONS[kind]];

  function choose(amount: number | null) {
    setFailed(false);
    set(kind, amount).then(onClose, () => {
      setFailed(true);
    });
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')}>
      <p className={styles.hint}>{t(`settings.targets.${kind}.hint`)}</p>
      <p className={styles.hint}>{t('settings.targets.versioned')}</p>
      <ul className={styles.options} aria-label={title}>
        {options.map((amount) => {
          const selected = amount === current;
          return (
            <li key={amount ?? 'none'}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={selected}
                onClick={() => {
                  choose(amount);
                }}
              >
                <span>{label(amount)}</span>
                {selected ? <Icon name="check" size={20} className={styles.check} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p className={styles.error} role="alert">
          {t('settings.targets.failed')}
        </p>
      ) : null}
    </Sheet>
  );
}
