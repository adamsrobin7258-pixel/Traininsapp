import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AUTOFOCUS_SELECTOR, isTextEntry } from '../focus';
import styles from './Sheet.module.css';

interface SheetProps {
  title: string;
  onClose: () => void;
  /** Accessible label of the backdrop that closes the sheet. */
  closeLabel: string;
  /**
   * Takes the full available height and leaves scrolling to the content (e.g. a long list
   * below a fixed search field). By default the whole sheet scrolls.
   */
  fill?: boolean;
  children: ReactNode;
}

const FOCUSABLE = 'input, button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

interface ViewportBox {
  top: number;
  height: number;
}

/**
 * The part of the screen not covered by the on-screen keyboard. Android (with edge-to-edge
 * insets) and iOS may lay the keyboard over the page instead of shrinking it, so viewport
 * units such as 100dvh can include the covered area.
 */
function useVisualViewport(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      setBox({ top: viewport.offsetTop, height: viewport.height });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}

/**
 * Modal bottom sheet: sits in the thumb zone above the keyboard, closes on Escape or backdrop
 * tap, keeps focus inside and restores it afterwards. Render it only while open.
 *
 * Opening a sheet never opens the keyboard on its own: focus goes to the sheet itself unless a
 * field is marked with `AUTOFOCUS` (see focus.ts). Closing it never re-focuses a text field.
 */
export function Sheet({ title, onClose, closeLabel, fill = false, children }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();
  const close = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target =
      panel.current?.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR) ?? panel.current ?? null;
    // Moving focus into the sheet also closes a keyboard left open by the page behind it.
    target?.focus({ preventScroll: true });

    // The page behind must not scroll along with the sheet.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      // Returning focus to a text field would bring the keyboard back unasked.
      if (previous && !isTextEntry(previous) && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  const box = viewport
    ? ({
        top: `${viewport.top}px`,
        height: `${viewport.height}px`,
        bottom: 'auto',
      } as CSSProperties)
    : undefined;

  return createPortal(
    <div className={styles.root} style={box}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panel}
        className={styles.panel}
        data-fill={fill}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className={styles.handle} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
