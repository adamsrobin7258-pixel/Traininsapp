import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'tertiary', 'destructive'];
const SIZES: ButtonSize[] = ['standard', 'compact'];

describe('Button', () => {
  it('defaults to a primary, standard-sized button that does not submit forms', () => {
    render(<Button>Speichern</Button>);
    const button = screen.getByRole('button', { name: 'Speichern' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveAttribute('data-size', 'standard');
  });

  it.each(VARIANTS.flatMap((variant) => SIZES.map((size) => [variant, size] as const)))(
    '%s / %s is operable by pointer and keyboard',
    async (variant, size) => {
      const onClick = vi.fn();
      render(
        <Button variant={variant} size={size} onClick={onClick}>
          Aktion
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Aktion' });
      expect(button).toHaveAttribute('data-variant', variant);
      expect(button).toHaveAttribute('data-size', size);
      await userEvent.click(button);
      await userEvent.tab();
      await userEvent.tab({ shift: true });
      expect(button).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(3);
    },
  );

  it.each(VARIANTS)('%s ignores clicks and leaves the tab order when disabled', async (variant) => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant={variant} disabled onClick={onClick}>
          Aus
        </Button>
        <Button variant="secondary">Weiter</Button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Aus' }));
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveFocus();
  });

  it('keeps the existing props: fullWidth, submit type and extra class names', () => {
    render(
      <form>
        <Button type="submit" fullWidth className="extra">
          Senden
        </Button>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Senden' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button.className).toContain('extra');
  });
});
