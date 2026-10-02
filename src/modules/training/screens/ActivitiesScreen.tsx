import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { combineActivities, useActivityData, type ActivityEntry } from '@/core/activity';
import { useHealthAutoSync, useHealthSync, useImportedHealthData } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { toLocalDateKey } from '@/shared/lib/date';
import { Button, EmptyState, List, ListRow, Screen, Section } from '@/ui';
import { ActivityDetailSheet } from '../components/ActivityDetailSheet';
import { ManualActivitySheet } from '../components/ManualActivitySheet';
import { entrySubtitle, entryTitle } from '../domain/activities';

type Open = { kind: 'new' } | { kind: 'entry'; key: string } | null;

/**
 * Activities – imported from Health Connect and logged by hand – newest first, with their
 * source. A list of their own: they are not Kalethra workouts, never appear in the history,
 * plans or "next workout" and change no training progress. Only manual activities can be
 * edited here; Health Connect data is managed by its sync alone.
 */
export function ActivitiesScreen() {
  const { t, locale } = useI18n();
  const { status } = useHealthSync();
  const [open, setOpen] = useState<Open>(null);
  useHealthAutoSync();
  const imported = useImportedHealthData(
    (service, profileId) => service.recentWorkouts(profileId),
    [],
  );
  const manual = useActivityData((service, profileId) => service.recent(profileId), []);

  const today = toLocalDateKey(new Date());
  const list =
    imported.status === 'ready' && manual.status === 'ready'
      ? combineActivities(imported.data, manual.data)
      : null;
  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  const openEntry: ActivityEntry | null =
    open?.kind === 'entry' ? (list?.find((entry) => entry.key === open.key) ?? null) : null;
  const close = () => {
    setOpen(null);
  };

  return (
    <Screen title={t('activities.title')} back={{ to: ROUTES.training, label: t('training.back') }}>
      <Button
        fullWidth
        onClick={() => {
          setOpen({ kind: 'new' });
        }}
      >
        {t('activities.record')}
      </Button>

      {imported.status === 'error' || manual.status === 'error' ? (
        <p role="alert">{t('training.errors.loadFailed')}</p>
      ) : null}

      {list && list.length === 0 ? (
        <EmptyState
          icon="training"
          title={connected ? t('activities.emptyConnected') : t('activities.emptyDisconnected')}
          body={
            connected ? t('activities.emptyConnectedBody') : t('activities.emptyDisconnectedBody')
          }
        />
      ) : null}

      {list && list.length > 0 ? (
        <Section footer={t('activities.intro')}>
          <List label={t('activities.title')}>
            {list.map((entry) => (
              <ListRow
                key={entry.key}
                title={entryTitle(entry, locale, t)}
                subtitle={entrySubtitle(entry, today, locale, t)}
                onPress={() => {
                  setOpen({ kind: 'entry', key: entry.key });
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}

      {open?.kind === 'new' ? <ManualActivitySheet onClose={close} /> : null}
      {openEntry?.source === 'healthConnect' ? (
        <ActivityDetailSheet activity={openEntry.activity} onClose={close} />
      ) : null}
      {openEntry?.source === 'manual' ? (
        <ManualActivitySheet
          activity={openEntry.activity}
          duplicate={openEntry.duplicateOf !== null}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}
