import type { Preset } from './date-ranges';

export interface FilterState {
  preset?: string;
  from?: string;
  to?: string;
  location?: string;
}

export type FilterChange = Partial<{
  preset: Preset;
  from: string;
  to: string;
  location: string;
}>;

/**
 * Build the query string (no leading "?") after applying `change` to `current`.
 * Params at their default are dropped: the default preset (last_quarter) and an
 * empty location. A preset change clears from/to unless it is `custom`, and
 * from/to are only kept while the preset is `custom`.
 */
export function buildQuery(current: FilterState, change: FilterChange): string {
  const next: FilterState = { ...current };
  if (change.preset !== undefined) {
    next.preset = change.preset;
    if (change.preset !== 'custom') {
      delete next.from;
      delete next.to;
    }
  }
  if (change.from !== undefined) next.from = change.from;
  if (change.to !== undefined) next.to = change.to;
  if (change.location !== undefined) next.location = change.location;

  const params = new URLSearchParams();
  if (next.preset && next.preset !== 'last_quarter') {
    params.set('preset', next.preset);
  }
  if (next.preset === 'custom') {
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
  }
  if (next.location) params.set('location', next.location);
  return params.toString();
}
