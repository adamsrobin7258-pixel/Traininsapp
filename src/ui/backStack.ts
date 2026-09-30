/**
 * Open overlays (sheets, dialogs) that the system back action closes before any page
 * navigation happens. The most recently opened overlay is closed first.
 */
const handlers: (() => void)[] = [];

/** Registers an overlay's close action; call the returned function when it closes. */
export function registerBackHandler(close: () => void): () => void {
  handlers.push(close);
  return () => {
    const index = handlers.lastIndexOf(close);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** Closes the topmost overlay. Returns false when none is open. */
export function closeTopOverlay(): boolean {
  const close = handlers.at(-1);
  if (!close) return false;
  close();
  return true;
}
