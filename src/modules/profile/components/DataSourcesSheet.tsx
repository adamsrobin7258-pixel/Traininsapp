import { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useNutrition, type ReferenceDatasetInfo } from '@/core/nutrition';
import { parseLocalDateKey } from '@/shared/lib/date';
import { formatMediumDate } from '@/shared/lib/format';
import { Section, Sheet } from '@/ui';

/** Attribution of the food data (required by the BLS and Open Food Facts licences). */
export function DataSourcesSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const { services } = useNutrition();
  const [bls, setBls] = useState<ReferenceDatasetInfo | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    services.lookup.referenceInfo().then(
      (info) => {
        if (!cancelled) setBls(info);
      },
      () => {
        if (!cancelled) setBls(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [services]);

  const importDate = (info: ReferenceDatasetInfo) => {
    const date = parseLocalDateKey(info.importedAt);
    return date ? formatMediumDate(date, locale) : info.importedAt;
  };

  return (
    <Sheet title={t('profile.dataSources.title')} onClose={onClose} closeLabel={t('common.close')}>
      <Section title={t('profile.dataSources.blsTitle')}>
        {bls === 'loading' ? null : bls ? (
          <>
            <p>{t('profile.dataSources.blsBody', { version: bls.version })}</p>
            <p>
              {t('profile.dataSources.blsDetails', {
                count: new Intl.NumberFormat(locale).format(bls.count),
                date: importDate(bls),
              })}
            </p>
          </>
        ) : (
          <p>{t('profile.dataSources.blsMissing')}</p>
        )}
      </Section>
      <Section title={t('profile.dataSources.offTitle')}>
        <p>{t('profile.dataSources.offBody')}</p>
      </Section>
    </Sheet>
  );
}
