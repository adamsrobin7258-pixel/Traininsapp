import { useState } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';
import styles from './Dialogs.module.css';

interface ConfirmSheetProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  destructive?: boolean;
  /** Runs the action; the sheet stays open and shows `errorText` if it fails. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
  errorText: string;
}

/** Asks before an irreversible or important action. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  cancelLabel,
  closeLabel,
  destructive = false,
  onConfirm,
  onClose,
  errorText,
}: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose} closeLabel={closeLabel}>
      <p className={styles.body}>{body}</p>
      {failed ? (
        <p className={styles.error} role="alert">
          {errorText}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          disabled={busy}
          onClick={() => void confirm()}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
