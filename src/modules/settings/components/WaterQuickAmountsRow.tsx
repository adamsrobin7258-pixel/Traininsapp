import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { formatWater } from '@/shared/lib/format';
import { List, ListRow, Section } from '@/ui';
import { WaterQuickAmountsSheet } from './WaterQuickAmountsSheet';

/** The amounts of the water quick buttons in Ernährung – an app setting. */
export function WaterQuickAmountsSection() {
  const { t, locale } = useI18n();
  const { waterQuickAmountsMl } = useSettings().settings;
  const [open, setOpen] = useState(false);
  return (
    <Section title={t('settings.app.water')} footer={t('nutrition.water.quickHint')}>
      <List>
        <ListRow
          title={t('nutrition.water.quickTitle')}
          value={waterQuickAmountsMl.map((amount) => formatWater(amount, locale)).join(' · ')}
          onPress={() => {
            setOpen(true);
          }}
        />
      </List>
      {open ? (
        <WaterQuickAmountsSheet
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </Section>
  );
}
