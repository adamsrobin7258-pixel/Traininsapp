import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CONTENT_LINKS, SETTINGS_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { PLAN_NAME_MAX_LENGTH, useTraining, useTrainingData } from '@/core/training';
import { List, ListRow, PromptSheet, Screen } from '@/ui';
import { describeTrainingError } from '../domain/errors';

/**
 * Plan management (Einstellungen → Meine Inhalte): the only place where plans are created; each
 * plan opens its editor. Workouts are started in the training area, never from here.
 */
export function PlansScreen() {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const plans = useTrainingData((s, profileId) => s.plans.listPlans(profileId), []);

  return (
    <Screen
      title={t('training.plansTitle')}
      back={{ to: SETTINGS_LINKS.content, label: t('settings.content.title') }}
    >
      {plans.status === 'error' ? <p role="alert">{t('training.errors.loadFailed')}</p> : null}
      <List label={t('training.plansTitle')}>
        {plans.status === 'ready'
          ? plans.data.map((plan) => (
              <ListRow key={plan.id} title={plan.name} to={CONTENT_LINKS.plan(plan.id)} />
            ))
          : null}
        {plans.status === 'ready' && plans.data.length === 0 ? (
          <ListRow title={t('training.plansEmpty')} />
        ) : null}
        <ListRow
          title={t('training.newPlan')}
          action
          onPress={() => {
            setCreating(true);
          }}
        />
      </List>

      {creating ? (
        <PromptSheet
          title={t('training.newPlan')}
          label={t('training.plan.namePrompt')}
          placeholder={t('training.plan.namePlaceholder')}
          maxLength={PLAN_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={(failure) => describeTrainingError(failure, t, unit, locale)}
          onSubmit={async (name) => {
            const plan = await mutate((s, profileId) => s.plans.createPlan(profileId, name));
            await navigate(CONTENT_LINKS.plan(plan.id));
          }}
          onClose={() => {
            setCreating(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
