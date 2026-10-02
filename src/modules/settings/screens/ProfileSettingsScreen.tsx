import { useId, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { formatWeight, useLatestWeight } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  BODY_DATA_LIMITS,
  DISPLAY_NAME_MAX_LENGTH,
  PROFILE_SEXES,
  useProfile,
  type ProfileSex,
} from '@/core/user';
import { parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatMediumDate } from '@/shared/lib/format';
import { formatNumberInput, parseNumberInput } from '@/shared/lib/numberInput';
import { Button, ChoiceChips, List, ListRow, NumberField, Screen, Section, TextField } from '@/ui';
import styles from '../components/Settings.module.css';

function reportError(error: unknown) {
  console.error(error);
}

/**
 * Einstellungen → Profil: the only place for personal master data – name, sex, birth date,
 * height. Saved through ProfileService (`updateBodyData`); the automatic nutrition goals follow
 * on their own (NutritionGoalSync). Body weight is shown only – it is recorded under Gesundheit.
 */
export function ProfileSettingsScreen() {
  const { t, locale } = useI18n();
  const { profile, rename, updateBodyData } = useProfile();
  const { weightUnit } = useSettings().settings;
  const latest = useLatestWeight();
  const birthId = useId();
  const [sex, setSex] = useState<ProfileSex | null>(profile.sex);
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [height, setHeight] = useState(formatNumberInput(profile.heightCm, locale));
  const [errors, setErrors] = useState<{ birthDate?: string; height?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const today = toLocalDateKey(new Date());

  function edited() {
    setNotice(null);
    setFailure(null);
  }

  async function save() {
    const next: { birthDate?: string; height?: string } = {};
    const validBirth = parseLocalDateKey(birthDate) !== null;
    if (
      birthDate &&
      (!validBirth || birthDate > today || birthDate < BODY_DATA_LIMITS.earliestBirthDate)
    ) {
      next.birthDate = t('nutrition.profile.errors.birthDate');
    }
    const parsedHeight = parseNumberInput(height);
    const { min, max } = BODY_DATA_LIMITS.heightCm;
    if (
      height.trim() &&
      (!parsedHeight.ok || parsedHeight.value < min || parsedHeight.value > max)
    ) {
      next.height = t('nutrition.profile.errors.height');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await updateBodyData({
        sex,
        birthDate: birthDate && validBirth ? birthDate : null,
        heightCm: height.trim() && parsedHeight.ok ? parsedHeight.value : null,
      });
      setNotice(t('settings.profile.saved'));
    } catch {
      setFailure(t('settings.profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const weight = latest.status === 'ready' ? latest.data : null;

  return (
    <Screen
      title={t('settings.profile.title')}
      back={{ to: ROUTES.settings, label: t('settings.title') }}
    >
      <Section>
        <TextField
          label={t('profile.nameLabel')}
          value={profile.displayName ?? ''}
          placeholder={t('profile.namePlaceholder')}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="given-name"
          onCommit={(value) => {
            rename(value).catch(reportError);
          }}
        />
      </Section>

      <Section title={t('nutrition.profile.personal')} footer={t('settings.profile.personalHint')}>
        <div className={styles.form}>
          <p className={styles.label}>{t('nutrition.profile.sex')}</p>
          <ChoiceChips
            label={t('nutrition.profile.sex')}
            options={PROFILE_SEXES.map((value) => ({
              value,
              title: t(`nutrition.profile.sexes.${value}`),
            }))}
            value={sex}
            onChange={(value) => {
              setSex(value);
              edited();
            }}
          />
          {sex === 'unspecified' ? (
            <p className={styles.hint}>{t('nutrition.profile.sexHint')}</p>
          ) : null}
          {/* Stacked: a native date field needs the full width on small phones. */}
          <div className={styles.stack}>
            <div className={styles.pairItem}>
              <label htmlFor={birthId} className={styles.label}>
                {t('nutrition.profile.birthDate')}
              </label>
              <input
                id={birthId}
                className={styles.field}
                type="date"
                min={BODY_DATA_LIMITS.earliestBirthDate}
                max={today}
                value={birthDate}
                aria-invalid={Boolean(errors.birthDate)}
                onChange={(event) => {
                  setBirthDate(event.target.value);
                  edited();
                }}
              />
              {errors.birthDate ? <p className={styles.fieldError}>{errors.birthDate}</p> : null}
            </div>
            <NumberField
              label={t('nutrition.profile.height')}
              value={height}
              integer
              error={errors.height}
              onChange={(value) => {
                setHeight(value);
                edited();
              }}
            />
          </div>
          <div className={styles.saveBar}>
            {failure ? (
              <p className={styles.error} role="alert">
                {failure}
              </p>
            ) : null}
            {notice ? (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            ) : null}
            <Button fullWidth disabled={busy} onClick={() => void save()}>
              {t('settings.profile.save')}
            </Button>
          </div>
        </div>
      </Section>

      <Section title={t('settings.profile.weight')} footer={t('settings.profile.weightHint')}>
        <List>
          <ListRow
            title={t('nutrition.profile.currentWeight')}
            value={
              weight
                ? t('nutrition.profile.currentWeightValue', {
                    value: formatWeight(weight.kg, weightUnit, locale),
                    date: formatMediumDate(parseLocalDateKey(weight.date) ?? new Date(), locale),
                  })
                : t('nutrition.profile.noWeight')
            }
          />
          <ListRow title={t('settings.profile.recordWeight')} to={ROUTES.health} />
        </List>
      </Section>
    </Screen>
  );
}
