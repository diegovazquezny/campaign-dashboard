import { describe, expect, test } from 'vitest';
import { buildQuery, detailHref, overviewHref } from './filters';

describe('buildQuery', () => {
  test('drops default preset and empty location', () => {
    expect(buildQuery({ preset: 'this_quarter' }, { preset: 'last_quarter' })).toBe('');
    expect(buildQuery({ location: 'a' }, { location: '' })).toBe('');
  });
  test('preset change clears from/to', () => {
    expect(
      buildQuery(
        { preset: 'custom', from: '2026-01-01', to: '2026-01-31' },
        { preset: 'last_30_days' },
      ),
    ).toBe('preset=last_30_days');
  });
  test('custom keeps from/to', () => {
    expect(
      buildQuery(
        { preset: 'custom', from: '2026-01-01', to: '2026-01-31' },
        { preset: 'custom' },
      ),
    ).toBe('preset=custom&from=2026-01-01&to=2026-01-31');
  });
  test('custom with prefilled dates in the change', () => {
    expect(
      buildQuery({}, { preset: 'custom', from: '2026-07-01', to: '2026-09-30' }),
    ).toBe('preset=custom&from=2026-07-01&to=2026-09-30');
  });
  test('location is kept across preset changes', () => {
    expect(buildQuery({ location: 'x' }, { preset: 'last_90_days' })).toBe(
      'preset=last_90_days&location=x',
    );
  });
  test('ignores from/to when preset is not custom', () => {
    expect(buildQuery({ from: '2026-01-01' }, { location: 'x' })).toBe('location=x');
  });
  test('empty date is dropped', () => {
    expect(
      buildQuery({ preset: 'custom', from: '2026-01-01', to: '2026-02-01' }, { to: '' }),
    ).toBe('preset=custom&from=2026-01-01');
  });
});

describe('detailHref / overviewHref', () => {
  test('encodes the id', () => {
    expect(detailHref('a b/c?', '')).toBe('/campaigns/a%20b%2Fc%3F');
  });
  test('empty query gives no "?"', () => {
    expect(detailHref('x', '')).toBe('/campaigns/x');
    expect(overviewHref('')).toBe('/');
  });
  test('preserves preset/from/to/location', () => {
    const q = buildQuery(
      { preset: 'custom', from: '2026-09-01', to: '2026-09-30', location: 'o1' },
      {},
    );
    expect(detailHref('x', q)).toBe(`/campaigns/x?${q}`);
    expect(q).toContain('preset=custom');
    expect(q).toContain('location=o1');
    expect(overviewHref(q)).toBe(`/?${q}`);
  });
});
