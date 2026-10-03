import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useTrainingData } from '@/core/training';
import { Button, List, ListRow, Sheet } from '@/ui';
import styles from './StartWorkoutSheet.module.css';

interface StartWorkoutSheetProps {
  /** Starts a free workout (`null`) or the given plan day. */
  onStart: (dayId: string | null) => Promise<void>;
  onOpenPlans: () => void;
  onClose: () => void;
  error: string | null;
}

/**
 * The start flow offers exactly two ways in: a free workout or a day from an existing plan.
 * Every plan marks its own next day; any day can be chosen. Plans are created and edited in
 * the plan management only – never from here.
 */
export function StartWorkoutSheet({
  onStart,
  onOpenPlans,
  onClose,
  error,
}: StartWorkoutSheetProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<'choose' | 'plan'>('choose');
  const [busy, setBusy] = useState(false);

  function start(dayId: string | null) {
    setBusy(true);
    void onStart(dayId).finally(() => {
      setBusy(false);
    });
  }

  if (step === 'choose') {
    return (
      <Sheet title={t('training.start')} onClose={onClose} closeLabel={t('common.close')}>
        <List label={t('training.start')}>
          <ListRow
            title={t('training.startSheet.free')}
            subtitle={t('training.startSheet.freeHint')}
            icon="training"
            disabled={busy}
            onPress={() => {
              start(null);
            }}
          />
          <ListRow
            title={t('training.startSheet.fromPlan')}
            subtitle={t('training.startSheet.fromPlanHint')}
            icon="plan"
            disabled={busy}
            onPress={() => {
              setStep('plan');
            }}
          />
        </List>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('training.startSheet.fromPlan')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <PlanDays busy={busy} onStart={start} onOpenPlans={onOpenPlans} />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          setStep('choose');
        }}
      >
        {t('training.startSheet.back')}
      </Button>
    </Sheet>
  );
}

function PlanDays({
  busy,
  onStart,
  onOpenPlans,
}: {
  busy: boolean;
  onStart: (dayId: string) => void;
  onOpenPlans: () => void;
}) {
  const { t } = useI18n();
  const data = useTrainingData(async (s, profileId) => {
    const plans = await s.plans.listPlans(profileId);
    return {
      plans: await Promise.all(plans.map((plan) => s.plans.getPlan(profileId, plan.id))),
      // The next day of every plan, from that plan's own history – no plan is "active".
      next: await s.plans.nextDays(profileId),
    };
  }, []);

  if (data.status === 'loading') return null;
  if (data.status === 'error') return <p role="alert">{t('training.errors.loadFailed')}</p>;

  const { plans, next } = data.data;
  if (plans.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('training.startSheet.noPlansTitle')}</p>
        <p className={styles.emptyBody}>{t('training.startSheet.noPlansBody')}</p>
        <Button fullWidth onClick={onOpenPlans}>
          {t('training.startSheet.toPlans')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.plans}>
      {plans.map((plan) => (
        <section key={plan.id} className={styles.plan} aria-label={plan.name}>
          <h3 className={styles.planName}>{plan.name}</h3>
          {plan.days.length === 0 ? (
            <p className={styles.emptyBody}>{t('training.startSheet.planEmpty')}</p>
          ) : (
            <List label={plan.name}>
              {plan.days.map((day) => {
                const count = day.exercises.length;
                return (
                  <ListRow
                    key={day.id}
                    title={day.name}
                    subtitle={
                      count === 0
                        ? t('training.startSheet.dayEmpty')
                        : count === 1
                          ? t('training.exerciseCountOne')
                          : t('training.exerciseCount', { count })
                    }
                    value={
                      next.get(plan.id)?.dayId === day.id
                        ? t('training.startSheet.next')
                        : undefined
                    }
                    disabled={busy || count === 0}
                    onPress={() => {
                      onStart(day.id);
                    }}
                  />
                );
              })}
            </List>
          )}
        </section>
      ))}
    </div>
  );
}
