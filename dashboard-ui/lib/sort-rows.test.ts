import { describe, expect, it } from 'vitest';
import type { CampaignRow } from './api-types';
import { SORT_KEYS, sortRows, type SortDirection } from './sort-rows';

function row(overrides: Partial<CampaignRow> & { name: string }): CampaignRow {
  return {
    campaign_id: overrides.name,
    channel: 'google',
    calls: 0,
    unique_callers: 0,
    new_callers: 0,
    booked: 0,
    booking_rate: null,
    unanswered_rate: null,
    awaiting_outcome: 0,
    revenue_cents: 0,
    spend_cents: null,
    revenue_per_spend: null,
    spend_per_booking_cents: null,
    ...overrides,
  };
}

const noCampaign = row({ name: 'No campaign', campaign_id: null, channel: 'none', calls: 999 });
const names = (rows: CampaignRow[]) => rows.map((r) => r.name);

describe('sortRows', () => {
  const rows = [
    row({ name: 'B', calls: 20 }),
    row({ name: 'A', calls: null }),
    noCampaign,
    row({ name: 'C', calls: 5 }),
    row({ name: 'D', calls: null }),
  ];

  it('sorts numerically ascending with nulls last', () => {
    expect(names(sortRows(rows, 'calls', 'asc').ranked)).toEqual(['C', 'B', 'A', 'D']);
  });

  it('sorts numerically descending with nulls still last', () => {
    expect(names(sortRows(rows, 'calls', 'desc').ranked)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('sorts a text key in both directions', () => {
    expect(names(sortRows(rows, 'name', 'asc').ranked)).toEqual(['A', 'B', 'C', 'D']);
    expect(names(sortRows(rows, 'name', 'desc').ranked)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('sorts the channel text key, breaking ties by name', () => {
    const r = [
      row({ name: 'Z', channel: 'bing' }),
      row({ name: 'Y', channel: 'google' }),
      row({ name: 'X', channel: 'bing' }),
    ];
    expect(names(sortRows(r, 'channel', 'asc').ranked)).toEqual(['X', 'Z', 'Y']);
    expect(names(sortRows(r, 'channel', 'desc').ranked)).toEqual(['Y', 'X', 'Z']);
  });

  it('breaks ties by name ascending in both directions', () => {
    const r = [row({ name: 'B', calls: 1 }), row({ name: 'A', calls: 1 }), row({ name: 'C', calls: 1 })];
    expect(names(sortRows(r, 'calls', 'asc').ranked)).toEqual(['A', 'B', 'C']);
    expect(names(sortRows(r, 'calls', 'desc').ranked)).toEqual(['A', 'B', 'C']);
  });

  it('treats zero as a real value, not as missing', () => {
    const r = [row({ name: 'N', calls: null }), row({ name: 'Z', calls: 0 }), row({ name: 'P', calls: 3 })];
    expect(names(sortRows(r, 'calls', 'asc').ranked)).toEqual(['Z', 'P', 'N']);
  });

  it('returns the No campaign row separately for every key and direction', () => {
    for (const key of SORT_KEYS) {
      for (const direction of ['asc', 'desc'] as SortDirection[]) {
        const result = sortRows(rows, key, direction);
        expect(result.noCampaign).toBe(noCampaign);
        expect(result.ranked).toHaveLength(4);
        expect(result.ranked.some((r) => r.campaign_id === null)).toBe(false);
      }
    }
  });

  it('returns null noCampaign when absent and handles empty input', () => {
    expect(sortRows([row({ name: 'A' })], 'calls', 'asc').noCampaign).toBeNull();
    expect(sortRows([], 'calls', 'asc')).toEqual({ ranked: [], noCampaign: null });
  });

  it('does not mutate its input', () => {
    const input = [...rows];
    const snapshot = [...input];
    sortRows(input, 'calls', 'desc');
    input.forEach((r, i) => expect(r).toBe(snapshot[i]));
  });

  it('sorts a ratio key by its own field', () => {
    const r = [row({ name: 'A', revenue_per_spend: 1.5 }), row({ name: 'B', revenue_per_spend: 3.4 })];
    expect(names(sortRows(r, 'revenue_per_spend', 'desc').ranked)).toEqual(['B', 'A']);
  });
});
