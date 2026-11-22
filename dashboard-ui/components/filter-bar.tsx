'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { Meta } from '../lib/api-types';
import type { Preset, ResolvedRange } from '../lib/date-ranges';
import { buildQuery, type FilterChange, type FilterState } from '../lib/filters';

const PRESET_LABELS: [Preset, string][] = [
  ['last_quarter', 'Last quarter'],
  ['this_quarter', 'This quarter'],
  ['last_30_days', 'Last 30 days'],
  ['last_90_days', 'Last 90 days'],
  ['custom', 'Custom'],
];

export function FilterBar({ meta, range }: { meta: Meta; range: ResolvedRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current: FilterState = {
    preset: range.preset,
    from: range.from,
    to: range.to,
    location: searchParams.get('location') ?? '',
  };

  function update(change: FilterChange) {
    const query = buildQuery(current, change);
    startTransition(async () => {
      await router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function selectPreset(preset: Preset) {
    // Custom prefills with the currently resolved range so it never starts empty.
    update(
      preset === 'custom' && range.preset !== 'custom'
        ? { preset, from: range.from, to: range.to }
        : { preset },
    );
  }

  return (
    <div aria-busy={isPending}>
      <div role="group" aria-label="Date range">
        {PRESET_LABELS.map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            aria-pressed={range.preset === preset}
            onClick={() => selectPreset(preset)}
          >
            {label}
          </button>
        ))}
      </div>
      {range.preset === 'custom' && (
        <div>
          <label>
            From
            <input
              type="date"
              value={range.from ?? ''}
              onChange={(e) => update({ from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={range.to ?? ''}
              onChange={(e) => update({ to: e.target.value })}
            />
          </label>
          {range.error && <p role="alert">{range.error}</p>}
        </div>
      )}
      <label>
        Office
        <select
          value={current.location}
          onChange={(e) => update({ location: e.target.value })}
        >
          <option value="">All offices</option>
          {meta.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {isPending && <span role="status">Updating…</span>}
    </div>
  );
}
