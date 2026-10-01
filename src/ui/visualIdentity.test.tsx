import { render, screen } from '@testing-library/react';
import { EmptyState } from './components/EmptyState';
import { List, ListRow } from './components/List';
import { Meter } from './components/Meter';
import { Section } from './components/Section';
import { FoodArt } from './illustrations/FoodArt';

describe('Meter', () => {
  it('is an accessible progress bar that clamps and never exceeds 100 %', () => {
    render(<Meter ratio={1.4} label="Kalorien" valueText="2.800 kcal von 2.000 kcal" />);
    const bar = screen.getByRole('progressbar', { name: 'Kalorien' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '2.800 kcal von 2.000 kcal');
    expect(bar).toHaveAttribute('data-tone', 'primary');
  });

  it('has its own tone for water', () => {
    render(<Meter ratio={0.25} label="Wasser" valueText="500 ml von 2 l" tone="water" />);
    const bar = screen.getByRole('progressbar', { name: 'Wasser' });
    expect(bar).toHaveAttribute('data-tone', 'water');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
  });
});

describe('FoodArt', () => {
  it('is decorative unless it names the food family', () => {
    const { container } = render(<FoodArt name="fruit" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    render(<FoodArt name="fish" label="Fisch & Meeresfrüchte" />);
    expect(screen.getByRole('img', { name: 'Fisch & Meeresfrüchte' })).toBeInTheDocument();
  });

  it('draws one family: same grid, line and tinted shape for every motif', () => {
    for (const name of ['fruit', 'dairy', 'dishes', 'food'] as const) {
      const { container, unmount } = render(<FoodArt name={name} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 40 40');
      expect(svg?.querySelector('g')?.getAttribute('stroke-width')).toBe('1.6');
      expect(svg?.dataset.tint).toBeTruthy();
      unmount();
    }
  });
});

describe('EmptyState', () => {
  it('shows a picture, a short title, one sentence and one action', () => {
    render(
      <EmptyState
        art={<FoodArt name="food" />}
        title="Nichts gefunden"
        body="Leg das Lebensmittel einfach selbst an."
        action={<button type="button">Anlegen</button>}
      />,
    );
    expect(screen.getByText('Nichts gefunden')).toBeInTheDocument();
    expect(screen.getByText('Leg das Lebensmittel einfach selbst an.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeInTheDocument();
  });
});

describe('icons in titles and rows', () => {
  it('keeps headings and rows named by their text only', () => {
    render(
      <Section title="Frühstück · 439 kcal" icon="cup">
        <List label="Liste">
          <ListRow title="Apfel roh" subtitle="BLS 4.0" leading={<FoodArt name="fruit" />} />
        </List>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: 'Frühstück · 439 kcal' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Frühstück · 439 kcal' })).toBeInTheDocument();
    expect(screen.getByText('Apfel roh')).toBeInTheDocument();
  });
});
