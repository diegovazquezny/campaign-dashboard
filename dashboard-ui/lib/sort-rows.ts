import type { CampaignRow } from './api-types';

export const TEXT_SORT_KEYS = ['name', 'channel'] as const;
export const NUMERIC_SORT_KEYS = [
  'calls',
  'unique_callers',
  'new_callers',
  'booked',
  'booking_rate',
  'unanswered_rate',
  'awaiting_outcome',
  'revenue_cents',
  'spend_cents',
  'revenue_per_spend',
  'spend_per_booking_cents',
] as const;

export const SORT_KEYS = [...TEXT_SORT_KEYS, ...NUMERIC_SORT_KEYS] as const;

export type TextSortKey = (typeof TEXT_SORT_KEYS)[number];
export type NumericSortKey = (typeof NUMERIC_SORT_KEYS)[number];
export type SortKey = TextSortKey | NumericSortKey;
export type SortDirection = 'asc' | 'desc';

export type SortedRows = {
  ranked: CampaignRow[];
  noCampaign: CampaignRow | null;
};

export function isTextSortKey(key: SortKey): key is TextSortKey {
  return (TEXT_SORT_KEYS as readonly string[]).includes(key);
}

function compareNames(a: CampaignRow, b: CampaignRow): number {
  return a.name.localeCompare(b.name, 'en');
}

// Returns campaigns sorted by key (null and non-finite values last in both
// directions, ties broken by name ascending) and the "No campaign" row
// separated out. The input array is not mutated.
export function sortRows(
  rows: readonly CampaignRow[],
  key: SortKey,
  direction: SortDirection,
): SortedRows {
  const sign = direction === 'asc' ? 1 : -1;
  const ranked: CampaignRow[] = [];
  let noCampaign: CampaignRow | null = null;
  for (const row of rows) {
    if (row.campaign_id === null) noCampaign ??= row;
    else ranked.push(row);
  }

  ranked.sort((a, b) => {
    if (isTextSortKey(key)) {
      return sign * a[key].localeCompare(b[key], 'en') || compareNames(a, b);
    }
    const x = a[key];
    const y = b[key];
    const xMissing = x === null || !Number.isFinite(x);
    const yMissing = y === null || !Number.isFinite(y);
    if (xMissing || yMissing) {
      if (xMissing && yMissing) return compareNames(a, b);
      return xMissing ? 1 : -1;
    }
    return sign * (x - y) || compareNames(a, b);
  });

  return { ranked, noCampaign };
}
