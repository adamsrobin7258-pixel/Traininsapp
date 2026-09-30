import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { List, ListRow } from './List';
import { SegmentedControl } from './SegmentedControl';
import { Stat } from './Stat';
import { TextField } from './TextField';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

function ControlledSegments({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
  return (
    <SegmentedControl
      label="Choice"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('exposes radio semantics with one checked option', () => {
    render(<ControlledSegments />);
    expect(screen.getByRole('radiogroup', { name: 'Choice' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false');
  });

  it('changes the value on click', async () => {
    const onChange = vi.fn();
    render(<ControlledSegments onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');
  });

  it('supports arrow-key navigation with wrap-around', async () => {
    render(<ControlledSegments />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('ListRow', () => {
  it('renders a link when a target is given', () => {
    render(
      <MemoryRouter>
        <List>
          <ListRow title="Training" subtitle="Plans" to="/training" />
          <ListRow title="Version" value="1.0" />
        </List>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Training/ })).toHaveAttribute('href', '/training');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('1.0')).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('announces a missing value accessibly', () => {
    render(<Stat label="Steps" value={null} emptyLabel="No value" />);
    expect(screen.getByText('No value')).toHaveClass('visually-hidden');
  });

  it('shows a formatted value', () => {
    render(<Stat label="Steps" value="8,000" emptyLabel="No value" />);
    expect(screen.getByText('8,000')).toBeInTheDocument();
  });
});

describe('TextField', () => {
  it('commits on Enter and reverts on Escape', async () => {
    const onCommit = vi.fn();
    render(<TextField label="Name" value="Anna" onCommit={onCommit} />);
    const input = screen.getByLabelText('Name');

    await userEvent.clear(input);
    await userEvent.type(input, 'Ben{Escape}');
    expect(input).toHaveValue('Anna');

    await userEvent.clear(input);
    await userEvent.type(input, 'Ben{Enter}');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Ben');
  });

  it('does not commit unchanged values', async () => {
    const onCommit = vi.fn();
    render(<TextField label="Name" value="Anna" onCommit={onCommit} />);
    await userEvent.click(screen.getByLabelText('Name'));
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
