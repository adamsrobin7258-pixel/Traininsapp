import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  exerciseDisplayName,
  PLAN_NAME_MAX_LENGTH,
  TrainingError,
  useTraining,
  useTrainingData,
  type Exercise,
  type PlanDayWithExercises,
  type PlannedExercise,
} from '@/core/training';
import { Button, ConfirmSheet, Icon, PromptSheet, Screen } from '@/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { TargetsSheet } from '../components/TargetsSheet';
import { describeTrainingError } from '../domain/errors';
import styles from './PlanScreen.module.css';

type Dialog =
  | { kind: 'renamePlan' }
  | { kind: 'deletePlan' }
  | { kind: 'addDay' }
  | { kind: 'renameDay'; day: PlanDayWithExercises }
  | { kind: 'deleteDay'; day: PlanDayWithExercises }
  | { kind: 'pick'; day: PlanDayWithExercises }
  | { kind: 'targets'; planned: PlannedExercise; name: string }
  | null;

/** Edit a training plan: days, exercises, order and optional targets. */
export function PlanScreen() {
  const { planId = '' } = useParams();
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const back = { to: TRAINING_LINKS.plans, label: t('training.plansTitle') };

  const data = useTrainingData(
    async (s, profileId) => ({
      plan: await s.plans.getPlan(profileId, planId),
      exercises: await s.exercises.list(profileId, { includeInactive: true }),
    }),
    [planId],
  );

  if (data.status === 'loading') return null;
  if (data.status === 'error') {
    const gone = data.error instanceof TrainingError && data.error.code === 'not-found';
    return (
      <Screen title={t('training.title')} back={back}>
        <p role="alert">{gone ? t('training.plan.notFound') : t('training.errors.loadFailed')}</p>
      </Screen>
    );
  }

  const { plan } = data.data;
  const byId = new Map<string, Exercise>(data.data.exercises.map((e) => [e.id, e]));
  const nameOf = (id: string) => {
    const exercise = byId.get(id);
    return exercise ? exerciseDisplayName(exercise, locale) : '–';
  };
  const describe = (failure: unknown) => describeTrainingError(failure, t, unit, locale);

  function run(change: Parameters<typeof mutate>[0]) {
    setError(null);
    mutate(change).catch((failure: unknown) => {
      setError(describe(failure));
    });
  }

  async function startDay(dayId: string) {
    setError(null);
    try {
      await mutate((s, profileId) => s.workouts.startFromPlan(profileId, dayId));
      await navigate(TRAINING_LINKS.activeWorkout);
    } catch (failure) {
      setError(describe(failure));
    }
  }

  const targetsText = (planned: PlannedExercise) => {
    const { targetSets: sets, targetReps: reps } = planned;
    if (sets && reps) return t('training.plan.targetsValue', { sets, reps });
    if (sets) return t('training.plan.targetsSetsOnly', { sets });
    if (reps) return t('training.plan.targetsRepsOnly', { reps });
    return t('training.plan.editTargets');
  };

  return (
    <Screen title={plan.name} back={back}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {plan.days.length === 0 ? (
        <p className={styles.muted}>{t('training.plan.daysEmpty')}</p>
      ) : null}

      {plan.days.map((day, dayIndex) => (
        <section key={day.id} className={styles.day} aria-label={day.name}>
          <header className={styles.dayHeader}>
            <h2 className={styles.dayName}>{day.name}</h2>
            <Button onClick={() => void startDay(day.id)}>{t('training.startDay')}</Button>
          </header>

          {day.exercises.length === 0 ? (
            <p className={styles.muted}>{t('training.plan.dayEmpty')}</p>
          ) : (
            <ol className={styles.exercises}>
              {day.exercises.map((planned, index) => (
                <li key={planned.id} className={styles.exercise}>
                  <button
                    type="button"
                    className={styles.exerciseMain}
                    onClick={() => {
                      setDialog({ kind: 'targets', planned, name: nameOf(planned.exerciseId) });
                    }}
                  >
                    <span className={styles.exerciseName}>{nameOf(planned.exerciseId)}</span>
                    <span className={styles.targets}>{targetsText(planned)}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label={`${nameOf(planned.exerciseId)}: ${t('training.workout.moveUp')}`}
                    disabled={index === 0}
                    onClick={() => {
                      run((s, profileId) => s.plans.moveExercise(profileId, planned.id, -1));
                    }}
                  >
                    <Icon name="arrowUp" size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label={`${nameOf(planned.exerciseId)}: ${t('training.workout.moveDown')}`}
                    disabled={index === day.exercises.length - 1}
                    onClick={() => {
                      run((s, profileId) => s.plans.moveExercise(profileId, planned.id, 1));
                    }}
                  >
                    <Icon name="arrowDown" size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label={`${nameOf(planned.exerciseId)}: ${t('training.workout.removeExercise')}`}
                    onClick={() => {
                      run((s, profileId) => s.plans.removeExercise(profileId, planned.id));
                    }}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className={styles.dayActions}>
            <button
              type="button"
              className={styles.add}
              onClick={() => {
                setDialog({ kind: 'pick', day });
              }}
            >
              <Icon name="plus" size={18} />
              {t('training.workout.addExercise')}
            </button>
            <div className={styles.dayTools}>
              <button
                type="button"
                className={styles.tool}
                aria-label={`${day.name}: ${t('training.workout.moveUp')}`}
                disabled={dayIndex === 0}
                onClick={() => {
                  run((s, profileId) => s.plans.moveDay(profileId, day.id, -1));
                }}
              >
                <Icon name="arrowUp" size={18} />
              </button>
              <button
                type="button"
                className={styles.tool}
                aria-label={`${day.name}: ${t('training.workout.moveDown')}`}
                disabled={dayIndex === plan.days.length - 1}
                onClick={() => {
                  run((s, profileId) => s.plans.moveDay(profileId, day.id, 1));
                }}
              >
                <Icon name="arrowDown" size={18} />
              </button>
              <button
                type="button"
                className={styles.textTool}
                onClick={() => {
                  setDialog({ kind: 'renameDay', day });
                }}
              >
                {t('training.plan.renameDay')}
              </button>
              <button
                type="button"
                className={`${styles.textTool} ${styles.danger}`}
                onClick={() => {
                  setDialog({ kind: 'deleteDay', day });
                }}
              >
                {t('training.plan.deleteDay')}
              </button>
            </div>
          </div>
        </section>
      ))}

      <div className={styles.planActions}>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setDialog({ kind: 'addDay' });
          }}
        >
          {t('training.plan.addDay')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setDialog({ kind: 'renamePlan' });
          }}
        >
          {t('training.plan.rename')}
        </Button>
        <Button
          variant="destructive"
          fullWidth
          onClick={() => {
            setDialog({ kind: 'deletePlan' });
          }}
        >
          {t('training.plan.delete')}
        </Button>
      </div>

      {dialog?.kind === 'renamePlan' ||
      dialog?.kind === 'addDay' ||
      dialog?.kind === 'renameDay' ? (
        <PromptSheet
          title={
            dialog.kind === 'renamePlan'
              ? t('training.plan.rename')
              : dialog.kind === 'addDay'
                ? t('training.plan.addDay')
                : t('training.plan.renameDay')
          }
          label={
            dialog.kind === 'renamePlan'
              ? t('training.plan.namePrompt')
              : t('training.plan.dayNamePrompt')
          }
          placeholder={
            dialog.kind === 'renamePlan'
              ? t('training.plan.namePlaceholder')
              : t('training.plan.dayNamePlaceholder')
          }
          initialValue={
            dialog.kind === 'renamePlan'
              ? plan.name
              : dialog.kind === 'renameDay'
                ? dialog.day.name
                : ''
          }
          maxLength={PLAN_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={describe}
          onSubmit={async (name) => {
            await mutate(async (s, profileId) => {
              if (dialog.kind === 'renamePlan') await s.plans.renamePlan(profileId, plan.id, name);
              else if (dialog.kind === 'addDay') await s.plans.addDay(profileId, plan.id, name);
              else await s.plans.renameDay(profileId, dialog.day.id, name);
            });
            setDialog(null);
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === 'deletePlan' ? (
        <ConfirmSheet
          title={t('training.plan.confirmDeleteTitle')}
          body={t('training.plan.confirmDeleteBody', { name: plan.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          destructive
          onConfirm={async () => {
            await mutate((s, profileId) => s.plans.deletePlan(profileId, plan.id));
            await navigate(TRAINING_LINKS.plans, { replace: true });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === 'deleteDay' ? (
        <ConfirmSheet
          title={t('training.plan.confirmDeleteDayTitle')}
          body={t('training.plan.confirmDeleteDayBody', { name: dialog.day.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          errorText={t('training.errors.saveFailed')}
          destructive
          onConfirm={async () => {
            await mutate((s, profileId) => s.plans.deleteDay(profileId, dialog.day.id));
            setDialog(null);
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === 'pick' ? (
        <ExercisePicker
          onPick={async (exercise) => {
            try {
              await mutate((s, profileId) =>
                s.plans.addExercise(profileId, dialog.day.id, exercise.id),
              );
            } catch (failure) {
              setError(describe(failure));
            }
            setDialog(null);
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.kind === 'targets' ? (
        <TargetsSheet
          planned={dialog.planned}
          title={dialog.name}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
