import { useI18n, type TranslationKey } from '@/core/i18n';
import type { Calculation, MacroTarget } from '@/core/nutrition';
import { List, ListRow, Section } from '@/ui';
import { formatGrams, formatKcal } from '../domain/format';
import styles from './Nutrition.module.css';

const TARGETS: { key: MacroTarget; label: TranslationKey }[] = [
  { key: 'energyKcal', label: 'nutrition.profile.energyGoal' },
  { key: 'proteinG', label: 'nutrition.nutrients.protein' },
  { key: 'fatG', label: 'nutrition.nutrients.fat' },
  { key: 'carbsG', label: 'nutrition.nutrients.carbohydrates' },
];

/**
 * Shows how the goals come about – every number is taken from the calculation result, the UI
 * computes nothing itself.
 */
export function CalculationView({
  calculation,
  formatWeightKg,
  onEdit,
}: {
  calculation: Calculation;
  formatWeightKg: (kg: number) => string;
  onEdit: (target: MacroTarget, label: string) => void;
}) {
  const { t, locale } = useI18n();
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const signedKcal = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatKcal(Math.abs(Math.round(value)), locale)}`;
  const { energy, protein, macros } = calculation;
  const percent = (share: number) => number(share * 100);

  const format = (key: MacroTarget, value: number | null) =>
    value === null
      ? t('nutrition.profile.noValue')
      : key === 'energyKcal'
        ? formatKcal(value, locale)
        : formatGrams(value, locale);

  const explain = (key: MacroTarget): string | undefined => {
    if (key === 'energyKcal' && energy) {
      return `${t('nutrition.profile.maintenance')}: ${formatKcal(Math.round(energy.maintenanceKcal), locale)} · ${t('nutrition.profile.adjustment')}: ${signedKcal(energy.adjustment.appliedKcal)}`;
    }
    if (key === 'proteinG' && protein) {
      // Own value: show what the automatic calculation would give, for comparison.
      if (calculation.manual.proteinG !== null) {
        return calculation.auto.proteinG !== null
          ? t('nutrition.profile.manualExplain', {
              value: formatGrams(calculation.auto.proteinG, locale),
            })
          : undefined;
      }
      return t(
        protein.referenceCapped
          ? 'nutrition.profile.proteinExplainCapped'
          : 'nutrition.profile.proteinExplain',
        {
          gPerKg: number(protein.gPerKg, 1),
          weight: formatWeightKg(protein.referenceWeightKg),
        },
      );
    }
    if (key === 'fatG' && macros)
      return t('nutrition.profile.fatExplain', { percent: percent(macros.fatShare) });
    if (key === 'carbsG' && macros) {
      return t('nutrition.profile.carbsExplain', { percent: percent(macros.carbsShare) });
    }
    return undefined;
  };

  return (
    <>
      {energy ? (
        <Section title={t('nutrition.profile.calculation')} footer={t('nutrition.profile.rmrHint')}>
          <List label={t('nutrition.profile.calculation')}>
            <ListRow
              title={t('nutrition.profile.rmr')}
              value={formatKcal(Math.round(energy.rmrKcal), locale)}
            />
            <ListRow
              title={t('nutrition.profile.everyday', {
                factor: number(calculation.inputs.activityFactor ?? 0, 2),
              })}
              value={formatKcal(Math.round(energy.everydayKcal), locale)}
            />
            {energy.training ? (
              <ListRow
                title={t('nutrition.profile.trainingKcal')}
                value={signedKcal(energy.training.kcalPerDay)}
              />
            ) : null}
            <ListRow
              title={t('nutrition.profile.maintenance')}
              value={formatKcal(Math.round(energy.maintenanceKcal), locale)}
            />
            <ListRow
              title={t('nutrition.profile.adjustment')}
              value={signedKcal(energy.adjustment.appliedKcal)}
            />
          </List>
          {energy.adjustment.appliedKcal < 0 ? (
            <p className={styles.empty}>
              {t('nutrition.profile.expectedPace', {
                kg: number(Math.abs(energy.adjustment.expectedKgPerWeek), 2),
              })}
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section title={t('nutrition.profile.targetsTitle')}>
        <List label={t('nutrition.profile.targetsTitle')}>
          {TARGETS.map(({ key, label }) => {
            const manual = calculation.manual[key] !== null;
            return (
              <ListRow
                key={key}
                title={t(label)}
                subtitle={[
                  t(manual ? 'nutrition.profile.origin.manual' : 'nutrition.profile.origin.auto'),
                  explain(key),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={format(key, calculation.effective[key])}
                onPress={() => {
                  onEdit(key, t(label));
                }}
              />
            );
          })}
        </List>
        {protein?.referenceCapped &&
        calculation.manual.proteinG === null &&
        calculation.inputs.weight ? (
          <p className={styles.hint}>
            {t('nutrition.profile.proteinCappedNote', {
              current: formatWeightKg(calculation.inputs.weight.kg),
              reference: formatWeightKg(protein.referenceWeightKg),
            })}
          </p>
        ) : null}
      </Section>

      {calculation.missing.length > 0 || calculation.invalid.length > 0 ? (
        <div className={styles.warning} role="status">
          {calculation.missing.length > 0 ? (
            <p>
              {t('nutrition.profile.missingTitle')}{' '}
              {calculation.missing.map((item) => t(`nutrition.profile.missing.${item}`)).join(', ')}
            </p>
          ) : null}
          {calculation.invalid.map((item) => (
            <p key={item}>{t(`nutrition.profile.invalid.${item}`)}</p>
          ))}
        </div>
      ) : null}
      {calculation.warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {t(`nutrition.profile.warnings.${warning}`)}
        </p>
      ))}
      <p className={styles.hint}>{t('nutrition.profile.disclaimer')}</p>
    </>
  );
}
