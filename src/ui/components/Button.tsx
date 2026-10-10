import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'standard' | 'compact';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary: the one main action of a view. secondary: further actions (outlined).
   * tertiary: quiet text action (ghost). destructive: deletes or discards data.
   */
  variant?: ButtonVariant;
  /** compact: smaller visual height for rows and toolbars; the tap area stays 44 pt. */
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'standard',
  fullWidth = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      className={[
        styles.button,
        styles[variant],
        size === 'compact' ? styles.compact : '',
        fullWidth ? styles.fullWidth : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
