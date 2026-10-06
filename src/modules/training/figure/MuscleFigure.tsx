import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import type { MuscleHighlight } from '@/core/training';
import { Button, Icon, Sheet } from '@/ui';
import { prefersReducedMotion, supportsWebGL } from './environment';
import { FigureCanvas } from './FigureCanvas';
import { useMuscleText } from './useMuscleText';
import type { FigurePose } from './rig';
import styles from './Figure.module.css';

/**
 * The small, still figure (exercise details, workout summary). Tapping it opens the large view.
 * Without WebGL – or if 3D fails to start – it is simply not there; the muscles stay listed as
 * text next to it, so no information depends on the figure.
 */
export function MuscleFigurePreview({
  pose,
  highlight,
  side = 'front',
  pair = false,
  onOpen,
}: {
  pose: FigurePose;
  highlight: MuscleHighlight;
  side?: 'front' | 'back';
  pair?: boolean;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  if (failed || !supportsWebGL()) return null;
  return (
    <button
      type="button"
      className={`${styles.preview} ${pair ? styles.previewPair : ''}`}
      aria-label={t('training.figure.open')}
      onClick={onOpen}
    >
      <FigureCanvas
        className={styles.canvas}
        pose={pose}
        highlight={highlight}
        side={side}
        pair={pair}
        quality="small"
        onFailed={() => {
          setFailed(true);
        }}
      />
      <span className={styles.badge} aria-hidden="true">
        {t('training.figure.badge')}
      </span>
    </button>
  );
}

/**
 * The large view: the figure in the middle, turned by dragging or by "Rückseite zeigen", the
 * exercise motion with play/pause, and the highlighted groups as text. With reduced motion the
 * motion does not start on its own and the figure turns without animation.
 */
export function MuscleFigureSheet({
  title,
  pose,
  highlight,
  side: initialSide = 'front',
  onClose,
}: {
  title: string;
  pose: FigurePose;
  highlight: MuscleHighlight;
  side?: 'front' | 'back';
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [reducedMotion] = useState(prefersReducedMotion);
  const animated = pose !== 'stand';
  const [playing, setPlaying] = useState(animated && !reducedMotion);
  const [side, setSide] = useState(initialSide);
  const text = useMuscleText(highlight);

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')}>
      <div className={styles.stage} role="img" aria-label={text.description}>
        <FigureCanvas
          className={styles.canvas}
          pose={pose}
          highlight={highlight}
          side={side}
          quality="large"
          playing={playing}
          smooth={!reducedMotion}
          interactive
        />
        <span className={styles.hint} aria-hidden="true">
          {t('training.figure.dragHint')}
        </span>
      </div>
      <dl className={styles.legend}>
        <div className={styles.legendRow}>
          <dt>
            <span className={styles.dot} data-level="primary" aria-hidden="true" />
            {t('training.figure.primary')}
          </dt>
          <dd>{text.primary || '–'}</dd>
        </div>
        {text.secondary !== '' ? (
          <div className={styles.legendRow}>
            <dt>
              <span className={styles.dot} data-level="secondary" aria-hidden="true" />
              {t('training.figure.secondary')}
            </dt>
            <dd>{text.secondary}</dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.controls}>
        {animated ? (
          <button
            type="button"
            className={styles.play}
            aria-label={playing ? t('training.figure.pause') : t('training.figure.play')}
            aria-pressed={playing}
            onClick={() => {
              setPlaying((value) => !value);
            }}
          >
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => {
            setSide((value) => (value === 'front' ? 'back' : 'front'));
          }}
        >
          {side === 'front' ? t('training.figure.showBack') : t('training.figure.showFront')}
        </Button>
      </div>
    </Sheet>
  );
}
