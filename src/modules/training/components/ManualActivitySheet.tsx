import { useEffect, useId, useMemo, useState } from 'react';
import {
  ActivityError,
  estimateCalories,
  searchSports,
  SPORT_CATEGORIES,
  sportById,
  sportIntensities,
  sportName,
  sportVariants,
  useActivities,
  type ActivityWeight,
  type ManualActivity,
  type SportDefinition,
} from '@/core/activity';
import { formatWeight } from '@/core/health';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatMediumDate } from '@/shared/lib/format';
import { Button, ConfirmSheet, List, ListRow, SegmentedControl, Sheet } from '@/ui';
import {
  formFromActivity,
  newForm,
  parseForm,
  withSport,
  type ActivityFormError,
  type ActivityFormState,
} from '../domain/manualActivityForm';
import styles from './ManualActivitySheet.module.css';

interface ManualActivitySheetProps {
  /** The activity to edit; without one, a new activity is logged. */
  activity?: ManualActivity;
  /** The activity most likely duplicates a Health Connect import (shown as a note). */
  duplicate?: boolean;
  onClose: () => void;
}

/**
 * Log or edit a sport activity: first the sport, then only the fields that sport needs, the
 * calculated calories (which the user may replace) and save. Opens without the keyboard –
 * text fields are only focused when tapped.
 */
export function ManualActivitySheet({
  activity,
  duplicate = false,
  onClose,
}: ManualActivitySheetProps) {
  const { locale } = useI18n();
  const today = toLocalDateKey(new Date());
  const [step, setStep] = useState<'sport' | 'form'>(activity ? 'form' : 'sport');
  const [form, setForm] = useState<ActivityFormState | null>(() =>
    activity ? formFromActivity(activity, locale) : null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (step === 'sport' || !form) {
    return (
      <SportPicker
        onPick={(sport) => {
          setForm((current) => (current ? withSport(current, sport) : newForm(sport, today)));
          setStep('form');
        }}
        onClose={
          form
            ? () => {
                setStep('form');
              }
            : onClose
        }
      />
    );
  }

  if (confirmDelete && activity) {
    return (
      <DeleteActivity
        activity={activity}
        onCancel={() => {
          setConfirmDelete(false);
        }}
        onDone={onClose}
      />
    );
  }

  return (
    <ActivityForm
      activity={activity}
      duplicate={duplicate}
      form={form}
      onChange={setForm}
      onChangeSport={() => {
        setStep('sport');
      }}
      onDelete={() => {
        setConfirmDelete(true);
      }}
      onClose={onClose}
    />
  );
}

function SportPicker({
  onPick,
  onClose,
}: {
  onPick: (sport: SportDefinition) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchSports(query, locale), [query, locale]);
  const browsing = query.trim() === '';
  const row = (sport: SportDefinition) => (
    <ListRow
      key={sport.id}
      title={sportName(sport, locale)}
      onPress={() => {
        onPick(sport);
      }}
    />
  );

  return (
    <Sheet
      title={t('activities.manual.pickSport')}
      onClose={onClose}
      closeLabel={t('common.close')}
      fill
    >
      <label htmlFor={searchId} className="visually-hidden">
        {t('activities.manual.search')}
      </label>
      <input
        id={searchId}
        className={styles.search}
        type="search"
        value={query}
        placeholder={t('activities.manual.searchPlaceholder')}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <div className={styles.scroll}>
        {browsing ? (
          SPORT_CATEGORIES.map((category) => {
            const title = t(`activities.categories.${category}`);
            return (
              <section key={category} aria-label={title}>
                <h3 className={styles.groupTitle}>{title}</h3>
                <List label={title}>
                  {matches.filter((sport) => sport.category === category).map(row)}
                </List>
              </section>
            );
          })
        ) : matches.length > 0 ? (
          <List label={t('activities.manual.pickSport')}>{matches.map(row)}</List>
        ) : (
          <p className={styles.note}>{t('activities.manual.noMatch')}</p>
        )}
      </div>
    </Sheet>
  );
}

const ERROR_KEYS: Record<ActivityFormError, TranslationKey> = {
  duration: 'activities.manual.errors.duration',
  distance: 'activities.manual.errors.distance',
  kcal: 'activities.manual.errors.kcal',
  date: 'activities.manual.errors.date',
  time: 'activities.manual.errors.time',
};

function ActivityForm({
  activity,
  duplicate,
  form,
  onChange,
  onChangeSport,
  onDelete,
  onClose,
}: {
  activity?: ManualActivity;
  duplicate: boolean;
  form: ActivityFormState;
  onChange: (form: ActivityFormState) => void;
  onChangeSport: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit } = useSettings().settings;
  const { service, profileId, create, update } = useActivities();
  const ids = { date: useId(), time: useId(), duration: useId(), distance: useId(), kcal: useId() };
  const today = toLocalDateKey(new Date());
  const sport = sportById(form.sportId);
  const [weight, setWeight] = useState<{ date: string; value: ActivityWeight | null } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The body weight of the activity's day (own entry, else a newer Health Connect value).
  useEffect(() => {
    let cancelled = false;
    service.weightOn(profileId, form.date).then(
      (value) => {
        if (!cancelled) setWeight({ date: form.date, value });
      },
      () => {
        if (!cancelled) setWeight({ date: form.date, value: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [service, profileId, form.date]);

  if (!sport) return null;
  const parsed = parseForm(form, today);
  const errors = showErrors && !parsed.ok ? parsed.errors : [];
  const calculable = parsed.ok ? parsed.input : parsed.partial;
  const bodyWeight = weight?.date === form.date ? weight.value : null;
  const estimate = calculable
    ? estimateCalories(
        sport,
        {
          durationS: calculable.durationMin * 60,
          distanceM: calculable.distanceKm !== null ? calculable.distanceKm * 1000 : null,
          intensity: calculable.intensity,
          variant: calculable.variant,
        },
        bodyWeight?.kg ?? null,
      )
    : null;
  const number = new Intl.NumberFormat(locale);
  const kcalText = (value: number) => t('activities.manual.kcal', { value: number.format(value) });
  const intensities = sportIntensities(sport);
  const variants = sportVariants(sport);
  const field = (name: ActivityFormError) => ({
    'aria-invalid': errors.includes(name) ? (true as const) : undefined,
    'aria-describedby': errors.includes(name) ? `${ids[name]}-error` : undefined,
  });
  const errorText = (name: ActivityFormError) =>
    errors.includes(name) ? (
      <p id={`${ids[name]}-error`} className={styles.error}>
        {t(ERROR_KEYS[name])}
      </p>
    ) : null;
  const set = (patch: Partial<ActivityFormState>) => {
    onChange({ ...form, ...patch });
  };

  async function save() {
    const result = parseForm(form, today);
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      if (activity) await update(activity.id, result.input);
      else await create(result.input);
      onClose();
    } catch (error) {
      setBusy(false);
      if (error instanceof ActivityError && error.code === 'future-date') {
        setShowErrors(true);
      }
      setFailed(true);
    }
  }

  return (
    <Sheet
      title={activity ? t('activities.manual.editTitle') : t('activities.manual.newTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={styles.sport}>
          <span>
            <span className="visually-hidden">{t('activities.manual.sport')}: </span>
            <span className={styles.sportName}>{sportName(sport, locale)}</span>
          </span>
          <button
            type="button"
            className={styles.link}
            aria-label={`${t('activities.manual.sport')}: ${t('activities.manual.change')}`}
            onClick={onChangeSport}
          >
            {t('activities.manual.change')}
          </button>
        </div>
        {duplicate ? <p className={styles.note}>{t('activities.duplicate')}</p> : null}

        <div className={styles.row}>
          <div className={styles.cell}>
            <label htmlFor={ids.date} className={styles.label}>
              {t('activities.manual.date')}
            </label>
            <input
              id={ids.date}
              className={styles.field}
              type="date"
              max={today}
              value={form.date}
              onChange={(event) => {
                set({ date: event.target.value });
              }}
              {...field('date')}
            />
          </div>
          <div className={styles.cell}>
            <label htmlFor={ids.time} className={styles.label}>
              {t('activities.manual.startTime')}
            </label>
            <input
              id={ids.time}
              className={styles.field}
              type="time"
              value={form.time}
              onChange={(event) => {
                set({ time: event.target.value });
              }}
              {...field('time')}
            />
          </div>
        </div>
        {errorText('date')}
        {errorText('time')}

        <label htmlFor={ids.duration} className={styles.label}>
          {t('activities.manual.duration')}
        </label>
        <input
          id={ids.duration}
          className={styles.field}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          value={form.duration}
          onChange={(event) => {
            set({ duration: event.target.value });
          }}
          {...field('duration')}
        />
        {errorText('duration')}

        {sport.fields.distance ? (
          <>
            <label htmlFor={ids.distance} className={styles.label}>
              {t('activities.manual.distance')}
            </label>
            <input
              id={ids.distance}
              className={styles.field}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={form.distance}
              onChange={(event) => {
                set({ distance: event.target.value });
              }}
              {...field('distance')}
            />
            {errorText('distance')}
          </>
        ) : null}

        {intensities.length > 0 && form.intensity ? (
          <>
            <span className={styles.label}>{t('activities.manual.intensity')}</span>
            <SegmentedControl
              label={t('activities.manual.intensity')}
              options={intensities.map((value) => ({
                value,
                label: t(`activities.manual.intensities.${value}`),
              }))}
              value={form.intensity}
              onChange={(intensity) => {
                set({ intensity });
              }}
            />
          </>
        ) : null}

        {variants.length > 0 && form.variant && sport.fields.variant ? (
          <>
            <span className={styles.label}>
              {t(`activities.manual.variants.${sport.fields.variant}`)}
            </span>
            <SegmentedControl
              label={t(`activities.manual.variants.${sport.fields.variant}`)}
              options={variants.map((value) => ({
                value,
                label: t(`activities.manual.variantOptions.${value}`),
              }))}
              value={form.variant}
              onChange={(variant) => {
                set({ variant });
              }}
            />
          </>
        ) : null}

        <section className={styles.estimate} aria-label={t('activities.manual.estimateTitle')}>
          <span className={styles.estimateTitle}>{t('activities.manual.estimateTitle')}</span>
          {form.kcal === null ? (
            <>
              <span className={styles.estimateValue} aria-live="polite">
                {estimate?.kcal != null ? kcalText(estimate.kcal) : '–'}
              </span>
              {weight && !bodyWeight ? (
                <span className={styles.note}>{t('activities.manual.noWeight')}</span>
              ) : bodyWeight ? (
                <span className={styles.note}>
                  {t(
                    bodyWeight.source === 'imported'
                      ? 'activities.manual.estimateAutoImported'
                      : 'activities.manual.estimateAuto',
                    { weight: formatWeight(bodyWeight.kg, weightUnit, locale) },
                  )}
                  {estimate?.met.speedKmh != null
                    ? ` ${t('activities.manual.estimateSpeed', {
                        speed: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                          estimate.met.speedKmh,
                        ),
                      })}`
                    : ''}
                </span>
              ) : null}
              {estimate?.met.basis === 'general' ? (
                <span className={styles.note}>{t('activities.manual.estimateGeneral')}</span>
              ) : null}
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  set({ kcal: estimate?.kcal != null ? String(estimate.kcal) : '' });
                }}
              >
                {t('activities.manual.adjust')}
              </button>
            </>
          ) : (
            <>
              <label htmlFor={ids.kcal} className={styles.label}>
                {t('activities.manual.ownKcal')}
              </label>
              <input
                id={ids.kcal}
                className={styles.field}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                value={form.kcal}
                onChange={(event) => {
                  set({ kcal: event.target.value });
                }}
                {...field('kcal')}
              />
              {errorText('kcal')}
              <span className={styles.note}>
                {estimate?.kcal != null
                  ? t('activities.manual.overridden', { kcal: kcalText(estimate.kcal) })
                  : t('activities.manual.overriddenNoAuto')}
              </span>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  set({ kcal: null });
                }}
              >
                {t('activities.manual.useAuto')}
              </button>
            </>
          )}
        </section>

        {failed ? (
          <p className={styles.error} role="alert">
            {t('activities.manual.errors.saveFailed')}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" fullWidth disabled={busy}>
            {t('activities.manual.save')}
          </Button>
          {activity ? (
            <Button variant="secondary" fullWidth disabled={busy} onClick={onDelete}>
              {t('activities.manual.delete')}
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}

function DeleteActivity({
  activity,
  onCancel,
  onDone,
}: {
  activity: ManualActivity;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const { remove } = useActivities();
  const sport = sportById(activity.sportId);
  const day = parseLocalDateKey(activity.localDate);
  return (
    <ConfirmSheet
      title={t('activities.manual.deleteTitle')}
      body={t('activities.manual.deleteBody', {
        name: sport ? sportName(sport, locale) : activity.sportId,
        date: day ? formatMediumDate(day, locale) : activity.localDate,
      })}
      confirmLabel={t('activities.manual.deleteConfirm')}
      cancelLabel={t('common.cancel')}
      closeLabel={t('common.close')}
      destructive
      errorText={t('activities.manual.errors.deleteFailed')}
      onConfirm={async () => {
        await remove(activity.id);
        onDone();
      }}
      onClose={onCancel}
    />
  );
}
