/**
 * Focus helpers for touch devices. The on-screen keyboard follows focus: it opens when a text
 * field gains focus and stays open as long as one keeps it. Only real text entry may do that;
 * buttons and other controls must never focus, or keep focused, a text field.
 */

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** True for elements that bring up the on-screen keyboard when focused. */
export function isTextEntry(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * Closes the keyboard by blurring the focused text field. Its blur handler runs first, so a
 * field that saves on blur is saved before the caller's own action.
 */
export function dismissKeyboard(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && isTextEntry(active)) active.blur();
}

/**
 * Marks the one text field a sheet exists for (e.g. a name prompt): it gets focus, and with it
 * the keyboard, when the sheet opens. Sheets without it open without the keyboard.
 */
export const AUTOFOCUS = { 'data-autofocus': true } as const;
export const AUTOFOCUS_SELECTOR = '[data-autofocus]';
