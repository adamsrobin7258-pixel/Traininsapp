import { useState } from 'react';
import { SETTINGS_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useNutrition, type WaterEntry } from '@/core/nutrition';
import { useSettings } from '@/core/settings';
import { Icon, List, ListRow, Meter, Section } from '@/ui';
import { describeNutritionError, formatWater } from '../domain/format';
import { WaterSheet } from './WaterSheets';
import styles from './Nutrition.module.css';

type Open = { kind: 'add' } | { kind: 'edit'; entry: WaterEntry } | null;

/** Water of the day: quick buttons, custom amounts and the entries. Never counts as kcal. */
export function WaterSection({
  day,
  entries,
  totalMl,
  goalMl,
}: {
  day: string;
  entries: readonly WaterEntry[];
  totalMl: number;
  goalMl: number | null;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const { waterQuickAmountsMl } = useSettings().settings;
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function quickAdd(amount: number) {
    setBusy(true);
    setError(null);
    mutate((s, profileId) => s.diary.addWater(profileId, { localDate: day, amount, unit: 'ml' }))
      .catch((failure: unknown) => {
        setError(describeNutritionError(failure, t));
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const total = formatWater(totalMl, locale);
  return (
    <Section title={t('nutrition.water.title')} footer={t('nutrition.water.notCounted')}>
      <div className={styles.waterCard}>
        <div className={styles.waterHead}>
          <Icon name="drop" size={22} className={styles.waterIcon} />
          <span className={styles.figureValue}>{total}</span>
          {goalMl !== null ? (
            <span className={styles.macroValue}>
              {t('nutrition.water.ofGoal', { value: total, goal: formatWater(goalMl, locale) })}
            </span>
          ) : null}
        </div>
        {goalMl !== null ? (
          <Meter
            tone="water"
            ratio={goalMl > 0 ? totalMl / goalMl : 0}
            label={t('nutrition.water.title')}
            valueText={t('nutrition.water.ofGoal', {
              value: total,
              goal: formatWater(goalMl, locale),
            })}
          />
        ) : (
          <p className={styles.hint}>{t('nutrition.water.noGoal')}</p>
        )}
        <div className={styles.quick}>
          {waterQuickAmountsMl.map((amount, index) => (
            <button
              key={`${String(index)}-${String(amount)}`}
              type="button"
              className={styles.chip}
              disabled={busy}
              aria-label={t('nutrition.water.quickAddLabel', {
                amount: formatWater(amount, locale),
              })}
              onClick={() => {
                quickAdd(amount);
              }}
            >
              {t('nutrition.water.quickAdd', { amount: formatWater(amount, locale) })}
            </button>
          ))}
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <List label={t('nutrition.water.entries')}>
        {entries.map((entry) => (
          <ListRow
            key={entry.id}
            title={t('nutrition.water.entry')}
            value={formatWater(entry.unit === 'l' ? entry.amount * 1000 : entry.amount, locale)}
            onPress={() => {
              setOpen({ kind: 'edit', entry });
            }}
          />
        ))}
        <ListRow
          title={t('nutrition.water.custom')}
          icon="plus"
          action
          onPress={() => {
            setOpen({ kind: 'add' });
          }}
        />
        {goalMl === null ? (
          <ListRow title={t('nutrition.water.setGoal')} to={SETTINGS_LINKS.goals} />
        ) : null}
        <ListRow title={t('nutrition.water.quickEdit')} to={SETTINGS_LINKS.app} />
      </List>
      {open?.kind === 'add' ? (
        <WaterSheet
          day={day}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
      {open?.kind === 'edit' ? (
        <WaterSheet
          day={day}
          entry={open.entry}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </Section>
  );
}
