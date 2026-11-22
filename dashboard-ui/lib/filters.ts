import { DEFAULT_PRESET, type Preset } from './date-ranges';

export interface FilterState {
  preset?: string;
  from?: string;
  to?: string;
  location?: string;
  /** 1-based page of a paged list; only kept above 1. */
  page?: number;
}

export type FilterChange = Partial<{
  preset: Preset;
  from: string;
  to: string;
  location: string;
  page: number;
}>;

const FILTER_KEYS = ['preset', 'from', 'to', 'location'] as const;

/**
 * Build the query string (no leading "?") after applying `change` to `current`.
 * Params in `extra` (a query string) other than preset/from/to/location are kept.
 * Params at their default are dropped: the default preset and an
 * empty location. A preset change clears from/to unless it is `custom`, and
 * from/to are only kept while the preset is `custom`. Changing any filter
 * resets `page` to 1 (drops it); `page` is kept only when `change` sets it, and
 * page 1 is the default so it is dropped too.
 */
export function buildQuery(
  current: FilterState,
  change: FilterChange,
  extra = '',
): string {
  const next: FilterState = { ...current };
  if (FILTER_KEYS.some((k) => change[k] !== undefined)) delete next.page;
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
  if (change.page !== undefined) next.page = change.page;

  const params = new URLSearchParams(extra);
  for (const k of [...FILTER_KEYS, 'page']) params.delete(k);
  if (next.preset && next.preset !== DEFAULT_PRESET) {
    params.set('preset', next.preset);
  }
  if (next.preset === 'custom') {
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
  }
  if (next.location) params.set('location', next.location);
  if (next.page && next.page > 1) params.set('page', String(next.page));
  return params.toString();
}

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

/** `/campaigns/<id>?<query>`; the id is encoded, the query is used as is. */
export function detailHref(campaignId: string, query: string): string {
  return withQuery(`/campaigns/${encodeURIComponent(campaignId)}`, query);
}

/** The calls list a call came from: `/campaigns/<id>` or, with no campaign, `/campaigns/none`. */
export function listHref(campaignId: string | null, query: string): string {
  return campaignId === null || campaignId === 'none'
    ? withQuery('/campaigns/none', query)
    : detailHref(campaignId, query);
}

/** `/calls/<id>?<query>`; the id is encoded, the query (filters and page) is used as is. */
export function callHref(callId: string, query: string): string {
  return withQuery(`/calls/${encodeURIComponent(callId)}`, query);
}

/** `/?<query>`; the query is used as is. */
export function overviewHref(query: string): string {
  return withQuery('/', query);
}

/** A 1-based page number from a `page` search param; anything else is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : 1;
}

/** `pathname` with `current`'s filters and `page`; used to leave a page past the end. */
export function pageHref(pathname: string, current: FilterState, page: number): string {
  return withQuery(pathname, buildQuery(current, { page }));
}
