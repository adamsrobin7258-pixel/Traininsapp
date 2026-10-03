import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  PROGRESSION_MODES,
  REST_TIMER_OPTIONS_S,
  useSettings,
  type ProgressionMode,
  type RestTimerSeconds,
} from '@/core/settings';
import { PROGRESSION_RULES } from '@/core/training';
import { ListRow, Section, List } from '@/ui';
import { ChoiceSheet } from './ChoiceSheet';

/**
 * "Gewichtssteigerung vorschlagen" (Einstellungen → Ziele → Training). The thresholds shown
 * come from the central rules in core/training/progression.ts.
 */
export function ProgressionRow() {
  const { t, locale } = useI18n();
  const { settings, updateSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const label = (mode: ProgressionMode) => t(`settings.training.modes.${mode}`);
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const detail = (mode: ProgressionMode) =>
    mode === 'off'
      ? t('settings.training.modeOffHint')
      : t('settings.training.modeHint', {
          sessions: PROGRESSION_RULES[mode].sessions,
          percent: percent.format(PROGRESSION_RULES[mode].increasePercent),
        });
  return (
    <>
      <ListRow
        title={t('settings.training.progressionTitle')}
        value={label(settings.progressionMode)}
        onPress={() => {
          setOpen(true);
        }}
      />
      {open ? (
        <ChoiceSheet
          title={t('settings.training.progressionTitle')}
          hint={t('settings.training.progressionHint')}
          choices={PROGRESSION_MODES.map((mode) => ({
            value: mode,
            label: label(mode),
            detail: detail(mode),
          }))}
          current={settings.progressionMode}
          failedText={t('settings.training.failed')}
          onChoose={(mode) => updateSetting('progressionMode', mode)}
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** "Pausenzeit" (Einstellungen → App → Training): 0 = no rest timer at all. */
export function TrainingAppSection() {
  const { t } = useI18n();
  const { settings, updateSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const label = (seconds: RestTimerSeconds) =>
    seconds === 0
      ? t('settings.training.restOff')
      : t('settings.training.restSeconds', { count: seconds });
  return (
    <Section title={t('settings.app.training')} footer={t('settings.training.restFooter')}>
      <List>
        <ListRow
          title={t('settings.training.restTitle')}
          value={label(settings.restTimerSeconds)}
          onPress={() => {
            setOpen(true);
          }}
        />
      </List>
      {open ? (
        <ChoiceSheet
          title={t('settings.training.restTitle')}
          hint={t('settings.training.restFooter')}
          choices={REST_TIMER_OPTIONS_S.map((seconds) => ({
            value: seconds,
            label: label(seconds),
          }))}
          current={settings.restTimerSeconds}
          failedText={t('settings.training.failed')}
          onChoose={(seconds) => updateSetting('restTimerSeconds', seconds)}
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </Section>
  );
}
