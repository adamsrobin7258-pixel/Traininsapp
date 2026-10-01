import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import {
  useHealthAutoSync,
  useHealthSync,
  useImportedHealthData,
  type ExternalWorkout,
} from '@/core/health';
import { useI18n } from '@/core/i18n';
import { toLocalDateKey } from '@/shared/lib/date';
import { EmptyState, List, ListRow, Screen, Section } from '@/ui';
import { ActivityDetailSheet } from '../components/ActivityDetailSheet';
import { activityFacts, activityTypeLabel, activityWhen } from '../domain/activities';

/**
 * Activities imported from Health Connect (runs, rides, classes …), newest first. A list of
 * their own: they are not Kalethra workouts, never appear in the history, plans or "next
 * workout" and change no progress.
 */
export function ActivitiesScreen() {
  const { t, locale } = useI18n();
  const { status } = useHealthSync();
  const [openId, setOpenId] = useState<string | null>(null);
  useHealthAutoSync();
  const activities = useImportedHealthData(
    (service, profileId) => service.recentWorkouts(profileId),
    [],
  );

  const today = toLocalDateKey(new Date());
  const list = activities.status === 'ready' ? activities.data : null;
  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  const open: ExternalWorkout | null = list?.find((activity) => activity.id === openId) ?? null;

  return (
    <Screen title={t('activities.title')} back={{ to: ROUTES.training, label: t('training.back') }}>
      {activities.status === 'error' ? <p role="alert">{t('training.errors.loadFailed')}</p> : null}

      {list && list.length === 0 ? (
        connected ? (
          <EmptyState
            icon="training"
            title={t('activities.emptyConnected')}
            body={t('activities.emptyConnectedBody')}
          />
        ) : (
          <EmptyState
            icon="training"
            title={t('activities.emptyDisconnected')}
            body={t('activities.emptyDisconnectedBody')}
          />
        )
      ) : null}

      {list && list.length > 0 ? (
        <Section footer={t('activities.intro')}>
          <List label={t('activities.title')}>
            {list.map((activity) => (
              <ListRow
                key={activity.id}
                title={activityTypeLabel(activity.activityType, t)}
                subtitle={`${activityWhen(activity, today, locale, t)}\n${activityFacts(activity, locale, t)}`}
                onPress={() => {
                  setOpenId(activity.id);
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}

      {open ? (
        <ActivityDetailSheet
          activity={open}
          onClose={() => {
            setOpenId(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
