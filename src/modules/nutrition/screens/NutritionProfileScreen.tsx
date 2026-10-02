import { useId, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { formatWeight, fromKg, parseWeightInput } from '@/core/health';
import { useI18n } from '@/core/i18n';
import {
  ACTIVITY_LEVELS,
  describeLevel,
  GOAL_LEVELS,
  GOAL_LIMITS,
  GOAL_TYPES,
  INPUT_LIMITS,
  levelFor,
  MACRO_TARGETS,
  useNutrition,
  useNutritionData,
  type ActivityLevel,
  type Calculation,
  type GoalLevel,
  type GoalType,
  type MacroTarget,
  type NutritionGoal,
  type NutritionProfileState,
  type Overrides,
  type PersonalData,
  type ProfileParams,
} from '@/core/nutrition';
import { useSettings } from '@/core/settings';
import { BODY_DATA_LIMITS, PROFILE_SEXES, useProfile, type ProfileSex } from '@/core/user';
import { parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatMediumDate } from '@/shared/lib/format';
import { Button, List, ListRow, Screen, Section, Sheet } from '@/ui';
import { CalculationView } from '../components/CalculationView';
import { ChoiceCards, ChoiceChips } from '../components/ChoiceCards';
import { NumberField } from '../components/NumberField';
import { OverrideSheet } from '../components/OverrideSheet';
import { describeNutritionError, formatKcal } from '../domain/format';
import { formatNumberInput, parseNumberInput, parseOptionalNumber } from '../domain/input';
import styles from '../components/Nutrition.module.css';

/** The nutrition profile: personal data, activity, training and goal → calculated goals. */
export function NutritionProfileScreen() {
  const { t } = useI18n();
  const state = useNutritionData((s, profileId) => s.goals.profileState(profileId), []);
  return (
    <Screen
      title={t('nutrition.profile.title')}
      back={{ to: ROUTES.nutrition, label: t('nutrition.back') }}
    >
      {state.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {state.status === 'ready' ? <ProfileForm state={state.data} /> : null}
    </Screen>
  );
}

interface Draft {
  sex: ProfileSex | null;
  birthDate: string;
  height: string;
  targetWeight: string;
  activityLevel: ActivityLevel | null;
  includeTraining: boolean;
  goalType: GoalType;
  goalLevel: GoalLevel | null;
  overrides: Overrides;
  water: string;
}

type FieldError = 'birthDate' | 'height' | 'targetWeight' | 'water';

function initialDraft(
  current: NutritionGoal | null,
  personal: PersonalData,
  formatTarget: (kg: number) => string,
  locale: string,
): Draft {
  return {
    sex: personal.sex,
    birthDate: personal.birthDate ?? '',
    height: formatNumberInput(personal.heightCm, locale),
    targetWeight: current?.targetWeightKg != null ? formatTarget(current.targetWeightKg) : '',
    activityLevel: current?.activityLevel ?? null,
    includeTraining: current?.includeTraining ?? false,
    goalType: current?.goalType ?? 'maintain',
    goalLevel: current?.goalLevel ?? null,
    overrides: Object.fromEntries(
      MACRO_TARGETS.map((target) => [target, current?.targets[target].manual ?? null]),
    ),
    water: formatNumberInput(current?.targets.waterMl.manual, locale),
  };
}

function ProfileForm({ state }: { state: NutritionProfileState }) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const { profile, updateBodyData } = useProfile();
  const { weightUnit } = useSettings().settings;
  const birthId = useId();
  const weightText = (kg: number) => formatWeight(kg, weightUnit, locale);
  const [draft, setDraft] = useState<Draft>(() =>
    initialDraft(
      state.current,
      profile,
      (kg) => formatNumberInput(Math.round(fromKg(kg, weightUnit) * 10) / 10, locale),
      locale,
    ),
  );
  const [errors, setErrors] = useState<Partial<Record<FieldError, string>>>({});
  const [editing, setEditing] = useState<{ target: MacroTarget; label: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const today = toLocalDateKey(new Date());
  const height = parseNumberInput(draft.height);
  const target = draft.targetWeight.trim()
    ? parseWeightInput(draft.targetWeight, weightUnit)
    : null;
  const personal: PersonalData = {
    sex: draft.sex,
    birthDate: parseLocalDateKey(draft.birthDate) ? draft.birthDate : null,
    heightCm: height.ok ? height.value : null,
  };
  const params: ProfileParams = {
    goalType: draft.goalType,
    goalLevel: levelFor(draft.goalType, draft.goalLevel),
    activityLevel: draft.activityLevel,
    includeTraining: draft.includeTraining,
    targetWeightKg: target?.ok ? target.kg : null,
  };
  const preview = useNutritionData(
    (s, profileId) => s.goals.calculate(profileId, params, draft.overrides, today, personal),
    [JSON.stringify([params, draft.overrides, personal]), today],
  );
  const calculation = preview.status === 'ready' ? preview.data : null;

  function change(update: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...update }));
    setNotice(null);
    setFailure(null);
  }

  function validate(): { water: number | null } | null {
    const next: Partial<Record<FieldError, string>> = {};
    if (
      draft.birthDate &&
      (!personal.birthDate ||
        draft.birthDate > today ||
        draft.birthDate < BODY_DATA_LIMITS.earliestBirthDate)
    ) {
      next.birthDate = t('nutrition.profile.errors.birthDate');
    }
    const { min, max } = BODY_DATA_LIMITS.heightCm;
    if (draft.height.trim() && (!height.ok || height.value < min || height.value > max)) {
      next.height = t('nutrition.profile.errors.height');
    }
    const limits = INPUT_LIMITS.targetWeightKg;
    if (target && (!target.ok || target.kg < limits.min || target.kg > limits.max)) {
      next.targetWeight = t('nutrition.profile.errors.targetWeight');
    }
    const water = parseOptionalNumber(draft.water);
    const waterLimits = GOAL_LIMITS.waterMl;
    if (
      !water.ok ||
      (water.value !== null && (water.value < waterLimits.min || water.value > waterLimits.max))
    ) {
      next.water = t('nutrition.profile.errors.water');
    }
    setErrors(next);
    return Object.keys(next).length === 0 && water.ok ? { water: water.value } : null;
  }

  function goalLabel(goalType: GoalType, level: GoalLevel | null) {
    const goal = t(`nutrition.goalTypes.${goalType}`);
    return level
      ? t('nutrition.profile.goalLabel', { goal, level: t(`nutrition.profile.levels.${level}`) })
      : goal;
  }

  function requestSave() {
    if (!validate()) return;
    const current = state.current;
    const goalChanged =
      current !== null &&
      (current.goalType !== params.goalType || current.goalLevel !== params.goalLevel);
    if (goalChanged) setConfirming(true);
    else void save();
  }

  async function save() {
    const checked = validate();
    if (!checked) return;
    setBusy(true);
    setFailure(null);
    try {
      if (
        personal.sex !== profile.sex ||
        personal.birthDate !== profile.birthDate ||
        personal.heightCm !== profile.heightCm
      ) {
        await updateBodyData(personal);
      }
      await mutate((s, profileId) =>
        s.goals.saveProfile(profileId, {
          params,
          overrides: draft.overrides,
          waterMl: checked.water,
        }),
      );
      setNotice(t('nutrition.profile.saved'));
    } catch (error) {
      setFailure(describeNutritionError(error, t));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const trend = calculation?.inputs.weight ?? null;
  const latest = state.latestWeight;
  const remaining =
    params.targetWeightKg !== null && latest ? Math.abs(latest.kg - params.targetWeightKg) : null;
  const levels: readonly GoalLevel[] = GOAL_LEVELS[draft.goalType];
  const levelText = (level: GoalLevel) => {
    const meaning = describeLevel(draft.goalType, level);
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    if (meaning.kind === 'deficit') {
      return t('nutrition.profile.levelDeficit', {
        kg: number.format(meaning.kgPerWeek),
        kcal: `−${number.format(meaning.kcalPerDay)}`,
      });
    }
    if (meaning.kind === 'surplus') {
      return t('nutrition.profile.levelSurplus', { percent: number.format(meaning.share * 100) });
    }
    return '';
  };

  return (
    <>
      <p className={styles.hint}>{t('nutrition.profile.intro')}</p>

      <Section title={t('nutrition.profile.personal')}>
        <div className={styles.form}>
          <p className={styles.label}>{t('nutrition.profile.sex')}</p>
          <ChoiceChips
            label={t('nutrition.profile.sex')}
            options={PROFILE_SEXES.map((sex) => ({
              value: sex,
              title: t(`nutrition.profile.sexes.${sex}`),
            }))}
            value={draft.sex}
            onChange={(sex) => {
              change({ sex });
            }}
          />
          {draft.sex === 'unspecified' ? (
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
                value={draft.birthDate}
                aria-invalid={Boolean(errors.birthDate)}
                onChange={(event) => {
                  change({ birthDate: event.target.value });
                }}
              />
              {errors.birthDate ? <p className={styles.fieldError}>{errors.birthDate}</p> : null}
            </div>
            <NumberField
              label={t('nutrition.profile.height')}
              value={draft.height}
              integer
              error={errors.height}
              onChange={(value) => {
                change({ height: value });
              }}
            />
          </div>
        </div>
      </Section>

      <Section title={t('nutrition.profile.body')}>
        <List label={t('nutrition.profile.body')}>
          <ListRow
            title={t('nutrition.profile.currentWeight')}
            value={
              latest
                ? t('nutrition.profile.currentWeightValue', {
                    value: weightText(latest.kg),
                    date: formatMediumDate(parseLocalDateKey(latest.date) ?? new Date(), locale),
                  })
                : t('nutrition.profile.noWeight')
            }
          />
          {trend ? (
            <ListRow
              title={t('nutrition.profile.trendWeight')}
              subtitle={
                trend.method === 'median7'
                  ? t('nutrition.profile.trendMedian', { count: trend.entryCount })
                  : t('nutrition.profile.trendLatest')
              }
              value={weightText(trend.kg)}
            />
          ) : (
            <ListRow title={t('nutrition.profile.addWeight')} to={ROUTES.health} />
          )}
        </List>
        <div className={styles.form}>
          <NumberField
            label={t('nutrition.profile.targetWeight', { unit: weightUnit })}
            value={draft.targetWeight}
            error={errors.targetWeight}
            onChange={(value) => {
              change({ targetWeight: value });
            }}
          />
          {params.targetWeightKg !== null && remaining !== null ? (
            <p className={styles.hint}>
              {remaining < 0.05
                ? t('nutrition.profile.targetReached', {
                    target: weightText(params.targetWeightKg),
                  })
                : t('nutrition.profile.targetProgress', {
                    target: weightText(params.targetWeightKg),
                    remaining: weightText(remaining),
                  })}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={t('nutrition.profile.activity')} footer={t('nutrition.profile.activityHint')}>
        <ChoiceCards
          label={t('nutrition.profile.activity')}
          options={ACTIVITY_LEVELS.map((level) => ({
            value: level,
            title: t(`nutrition.profile.activities.${level}`),
            text: t(`nutrition.profile.activityDescriptions.${level}`),
          }))}
          value={draft.activityLevel}
          onChange={(activityLevel) => {
            change({ activityLevel });
          }}
        />
      </Section>

      <Section
        title={t('nutrition.profile.training')}
        footer={t('nutrition.profile.includeTrainingHint')}
      >
        <div className={styles.switchRow}>
          <span id={`${birthId}-training`}>{t('nutrition.profile.includeTraining')}</span>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={draft.includeTraining}
            aria-labelledby={`${birthId}-training`}
            onClick={() => {
              change({ includeTraining: !draft.includeTraining });
            }}
          />
        </div>
        {draft.includeTraining && calculation?.energy ? (
          <p className={styles.empty}>
            {calculation.energy.training && calculation.energy.training.sessions > 0
              ? t('nutrition.profile.trainingSummary', {
                  count: calculation.energy.training.sessions,
                  kcal: Math.round(calculation.energy.training.kcalPerDay),
                })
              : t('nutrition.profile.trainingNone')}
          </p>
        ) : null}
      </Section>

      <Section title={t('nutrition.profile.goal')}>
        <div className={styles.form}>
          <ChoiceChips
            label={t('nutrition.profile.goalType')}
            options={GOAL_TYPES.map((type) => ({
              value: type,
              title: t(`nutrition.goalTypes.${type}`),
            }))}
            value={draft.goalType}
            onChange={(goalType) => {
              change({ goalType, goalLevel: levelFor(goalType, draft.goalLevel) });
            }}
          />
          {draft.goalType === 'fitness' ? (
            <p className={styles.hint}>{t('nutrition.profile.fitnessHint')}</p>
          ) : null}
          {levels.length > 0 ? (
            <>
              <p className={styles.label}>{t('nutrition.profile.goalLevel')}</p>
              <ChoiceCards
                label={t('nutrition.profile.goalLevel')}
                options={levels.map((level) => ({
                  value: level,
                  title: t(`nutrition.profile.levels.${level}`),
                  text: levelText(level),
                }))}
                value={params.goalLevel}
                onChange={(goalLevel) => {
                  change({ goalLevel });
                }}
              />
            </>
          ) : (
            <p className={styles.hint}>{t('nutrition.profile.maintainHint')}</p>
          )}
        </div>
      </Section>

      {calculation ? (
        <CalculationView
          calculation={calculation}
          formatWeightKg={weightText}
          onEdit={(targetKey, label) => {
            setEditing({ target: targetKey, label });
          }}
        />
      ) : null}

      <Section>
        <div className={styles.form}>
          <NumberField
            label={t('nutrition.profile.water')}
            value={draft.water}
            integer
            error={errors.water}
            onChange={(value) => {
              change({ water: value });
            }}
          />
        </div>
      </Section>

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
        <Button fullWidth disabled={busy} onClick={requestSave}>
          {t('nutrition.profile.save')}
        </Button>
      </div>

      {editing && calculation ? (
        <OverrideSheet
          label={editing.label}
          target={editing.target}
          unit={editing.target === 'energyKcal' ? 'kcal' : 'g'}
          autoValue={calculation.auto[editing.target]}
          manualValue={draft.overrides[editing.target] ?? null}
          details={
            editing.target === 'proteinG' ? <ProteinModes calculation={calculation} /> : null
          }
          savesNow={state.current?.autoEnabled === true}
          onApply={async (value) => {
            const target = editing.target;
            // With a saved profile the own value is stored at once (it must not get lost when
            // leaving without "Save"); before the first setup it is saved with the profile.
            if (state.current?.autoEnabled) {
              await mutate((s, profileId) => s.goals.setProfileOverride(profileId, target, value));
            }
            change({ overrides: { ...draft.overrides, [target]: value } });
            setEditing(null);
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}

      {confirming && state.current ? (
        <Sheet
          title={t('nutrition.profile.changeTitle')}
          onClose={() => {
            setConfirming(false);
          }}
          closeLabel={t('common.close')}
        >
          <div className={styles.stack}>
            <div className={styles.summary}>
              <span className={styles.label}>{t('nutrition.profile.changeOld')}</span>
              <span>
                {t('nutrition.profile.changeSummary', {
                  goal: goalLabel(state.current.goalType, state.current.goalLevel),
                  kcal: kcalOf(state.current, locale, t('nutrition.profile.noValue')),
                })}
              </span>
            </div>
            <div className={styles.summary}>
              <span className={styles.label}>{t('nutrition.profile.changeNew')}</span>
              <span>
                {t('nutrition.profile.changeSummary', {
                  goal: goalLabel(params.goalType, params.goalLevel),
                  kcal:
                    calculation?.effective.energyKcal != null
                      ? formatKcal(calculation.effective.energyKcal, locale)
                      : t('nutrition.profile.noValue'),
                })}
              </span>
            </div>
            <p className={styles.hint}>{t('nutrition.profile.changeHint')}</p>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button disabled={busy} onClick={() => void save()}>
                {t('nutrition.profile.changeConfirm')}
              </Button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function kcalOf(goal: NutritionGoal, locale: string, fallback: string): string {
  const value = goal.targets.energyKcal.manual ?? goal.targets.energyKcal.auto;
  return value === null ? fallback : formatKcal(value, locale);
}

/** Automatic vs. custom protein target, with the reference weight when it is capped. */
function ProteinModes({ calculation }: { calculation: Calculation }) {
  const { t, locale } = useI18n();
  const { weightUnit } = useSettings().settings;
  const { protein } = calculation;
  const manual = calculation.manual.proteinG !== null;
  return (
    <>
      <p className={styles.hint}>
        {t(manual ? 'nutrition.profile.proteinManualMode' : 'nutrition.profile.proteinAutoMode')}
      </p>
      {protein?.referenceCapped && calculation.inputs.weight ? (
        <p className={styles.hint}>
          {t('nutrition.profile.proteinCappedNote', {
            current: formatWeight(calculation.inputs.weight.kg, weightUnit, locale),
            reference: formatWeight(protein.referenceWeightKg, weightUnit, locale),
          })}
        </p>
      ) : null}
    </>
  );
}
