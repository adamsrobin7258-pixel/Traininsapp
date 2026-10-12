import { useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import type { MuscleHighlight } from '@/core/training';
import { useProfile } from '@/core/user';
import { Sheet } from '@/ui';
import { figureVariantFor } from '../figure/contract';
import { MUSCLE_MAP_VIEWS, highlightSvg, type MuscleMapVariant } from './regions';
import { MUSCLE_MAP_SVGS } from './svgs';
import { useMuscleMapText } from './useMuscleMapText';
import styles from './MuscleMap.module.css';

/**
 * The body of every map: the profile's sex is the one source (Phase 23) – male → male body,
 * female → female body, "Divers / keine Angabe" or no value → the male body as the fixed fallback
 * (`figureVariantFor`). There is no second setting and no switch.
 */
function useProfileVariant(): MuscleMapVariant {
  return figureVariantFor(useProfile().profile.sex);
}

/**
 * Front and back of one body side by side, the worked muscles in coral. A plain local SVG – no
 * WebGL, no network; the drawing is bundled with the app. Decorative for assistive technology:
 * the container is one image with the muscles as its name, and the screens list them as text.
 */
export function MuscleMap({
  highlight,
  variant,
  size,
  labelled = true,
}: {
  highlight: MuscleHighlight;
  variant: MuscleMapVariant;
  size: 'small' | 'large';
  /** `false` inside a control that is named on its own (the preview button). */
  labelled?: boolean;
}) {
  const { t } = useI18n();
  const text = useMuscleMapText(highlight);
  const highlightKey = JSON.stringify(highlight);
  const drawings = useMemo(
    () =>
      MUSCLE_MAP_VIEWS.map((view) => ({
        view,
        svg: highlightSvg(
          MUSCLE_MAP_SVGS[variant][view],
          JSON.parse(highlightKey) as MuscleHighlight,
        ),
      })),
    [variant, highlightKey],
  );
  return (
    <div
      className={styles.map}
      data-size={size}
      data-variant={variant}
      data-testid="muscle-map"
      {...(labelled
        ? { role: 'img', 'aria-label': text.description }
        : { 'aria-hidden': true as const })}
    >
      {drawings.map(({ view, svg }) => (
        <div key={view} className={styles.view} data-view={view}>
          <div
            className={styles.drawing}
            // Bundled, generated SVG (tools/muscle-maps) – never user or network content.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <span className={styles.caption}>{t(`training.muscleMap.${view}`)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The muscle map as a quiet, tappable card (exercise details, workout summary): the body of the
 * profile, front and back. Tapping opens the large view.
 */
export function MuscleMapPreview({
  highlight,
  onOpen,
}: {
  highlight: MuscleHighlight;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const variant = useProfileVariant();
  return (
    <button
      type="button"
      className={styles.preview}
      aria-label={t('training.muscleMap.open')}
      onClick={onOpen}
    >
      <MuscleMap highlight={highlight} variant={variant} size="small" labelled={false} />
    </button>
  );
}

/** The large view: front and back of the profile's body and the worked groups as text. */
export function MuscleMapSheet({
  title,
  highlight,
  onClose,
}: {
  title: string;
  highlight: MuscleHighlight;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const variant = useProfileVariant();
  const text = useMuscleMapText(highlight);
  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')}>
      <div className={styles.stage}>
        <MuscleMap highlight={highlight} variant={variant} size="large" />
      </div>
      <dl className={styles.legend}>
        <div className={styles.legendRow}>
          <dt>
            <span className={styles.dot} data-level="primary" aria-hidden="true" />
            {t('training.muscleMap.primary')}
          </dt>
          <dd>{text.primary || '–'}</dd>
        </div>
        {text.secondary !== '' ? (
          <div className={styles.legendRow}>
            <dt>
              <span className={styles.dot} data-level="secondary" aria-hidden="true" />
              {t('training.muscleMap.secondary')}
            </dt>
            <dd>{text.secondary}</dd>
          </div>
        ) : null}
      </dl>
    </Sheet>
  );
}
