import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Meta } from '../lib/api-types';
import type { ResolvedRange } from '../lib/date-ranges';
import { FilterBar } from './filter-bar';

const push = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(search),
}));

const meta: Meta = {
  data_coverage: null,
  freshness: null,
  campaigns: [],
  locations: [
    { id: 'l1', name: 'Austin', timezone: 'America/Chicago' },
    { id: 'l2', name: 'Boston', timezone: 'America/New_York' },
  ],
};
const quarter: ResolvedRange = {
  preset: 'last_quarter',
  from: '2026-07-01',
  to: '2026-09-30',
};

beforeEach(() => {
  cleanup();
  push.mockReset();
  search = '';
});

test('renders presets, locations and marks the active preset', () => {
  render(<FilterBar meta={meta} range={quarter} />);
  expect(screen.getByRole('button', { name: 'Last quarter' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
    'All offices',
    'Austin',
    'Boston',
  ]);
  expect(screen.queryByLabelText('From')).toBeNull();
});

test('preset click pushes the query and keeps the location', () => {
  search = 'location=l1';
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
  expect(push).toHaveBeenCalledWith('/?preset=last_30_days&location=l1');
});

test('location change pushes the query', () => {
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.change(screen.getByLabelText('Office'), { target: { value: 'l2' } });
  expect(push).toHaveBeenLastCalledWith('/?location=l2');
});

test('Custom prefills the current resolved range', () => {
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  expect(push).toHaveBeenCalledWith('/?preset=custom&from=2026-07-01&to=2026-09-30');
});

test('custom inputs show for Custom and edits push', () => {
  const range: ResolvedRange = { preset: 'custom', from: '2026-01-01', to: '2026-01-31' };
  render(<FilterBar meta={meta} range={range} />);
  expect(screen.getByLabelText('From')).toHaveValue('2026-01-01');
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-15' } });
  expect(push).toHaveBeenCalledWith('/?preset=custom&from=2026-01-01&to=2026-02-15');
});

test('shows the error for an invalid custom range', () => {
  const range: ResolvedRange = {
    preset: 'custom',
    from: '2026-03-01',
    error: 'Custom range needs both a start and an end date.',
  };
  render(<FilterBar meta={meta} range={range} />);
  expect(screen.getByRole('alert')).toHaveTextContent('needs both');
});

test('shows a pending state while the transition is in flight', async () => {
  let release!: () => void;
  push.mockImplementation(
    () => new Promise<void>((r) => (release = r)),
  );
  render(<FilterBar meta={meta} range={quarter} />);
  expect(screen.queryByRole('status')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'This quarter' }));
  });
  expect(push).toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Updating');
  await act(async () => release());
  expect(screen.queryByRole('status')).toBeNull();
});
