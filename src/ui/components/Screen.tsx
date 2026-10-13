import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '../brand/BrandMark';
import { Icon } from '../icons/Icon';
import { SceneArt } from '../illustrations/SceneArt';
import { SCENE_TONE, type SceneName } from '../illustrations/sceneTone';
import styles from './Screen.module.css';

interface ScreenProps {
  title: string;
  /** Small line above the title, e.g. the current date. */
  eyebrow?: string;
  /** Link back to the parent screen (sub pages). */
  back?: { to: string; label: string };
  /** Compact control next to the title, e.g. an "Edit" button. */
  action?: ReactNode;
  /**
   * The Kalethra symbol at the top right (default). `false` on a page that shows the brand in its
   * content already (no second logo).
   */
  brand?: boolean;
  /**
   * Less room between header and content – for an overview that has to fit one screen
   * (Fortschritt). The header itself is unchanged.
   */
  dense?: boolean;
  /**
   * An atmospheric scene behind the header that fades into the page (Training, Ernährung). The
   * first content overlaps its lower part; it is decorative and never sits behind numbers.
   */
  hero?: SceneName;
  children: ReactNode;
}

/**
 * Top-level layout of every page: large title header and scrollable content.
 *
 * The decorative Kalethra symbol sits at the top right: on sub pages at the end of the back
 * link's row (it never competes with the title or its actions), on top-level pages at the end of
 * the title row. It never makes the header taller or wraps into its own line: where the row has
 * too little room (small screen, large system font), the mark is hidden.
 */
export function Screen({
  title,
  eyebrow,
  back,
  action,
  brand = true,
  dense = false,
  hero,
  children,
}: ScreenProps) {
  const mark = (
    <span className={styles.mark}>
      <BrandMark badge />
    </span>
  );
  return (
    <main className={styles.screen} data-hero={hero ? SCENE_TONE[hero] : undefined}>
      {hero ? (
        <div className={styles.hero}>
          <SceneArt name={hero} className={styles.heroArt} />
        </div>
      ) : null}
      <header className={styles.header} data-dense={dense || undefined}>
        {back ? (
          <div className={styles.topRow}>
            <Link to={back.to} className={styles.back}>
              <Icon name="chevronLeft" size={20} />
              {back.label}
            </Link>
            {brand ? mark : null}
          </div>
        ) : null}
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {action}
          {/* Next to an action only when the page has a back row – there it sits up there. */}
          {brand && !back && !action ? mark : null}
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </main>
  );
}
