import { describe, expect, it } from 'vitest';
import { resolveRange } from './date-ranges';

describe('resolveRange presets', () => {
  it('defaults to last quarter', () => {
    expect(resolveRange({}, '2026-11-22')).toEqual({
      preset: 'last_quarter',
      from: '2026-07-01',
      to: '2026-09-30',
    });
  });

  it('falls back to last quarter for an unknown preset', () => {
    expect(resolveRange({ preset: 'bogus' }, '2026-11-22').preset).toBe('last_quarter');
  });

  it('handles quarter boundaries', () => {
    expect(resolveRange({}, '2026-03-31')).toMatchObject({ from: '2025-10-01', to: '2025-12-31' });
    expect(resolveRange({}, '2026-04-01')).toMatchObject({ from: '2026-01-01', to: '2026-03-31' });
    expect(resolveRange({}, '2026-12-31')).toMatchObject({ from: '2026-07-01', to: '2026-09-30' });
    expect(resolveRange({}, '2027-01-01')).toMatchObject({ from: '2026-10-01', to: '2026-12-31' });
  });

  it('rolls over the year in January', () => {
    expect(resolveRange({}, '2026-01-15')).toEqual({
      preset: 'last_quarter',
      from: '2025-10-01',
      to: '2025-12-31',
    });
  });

  it('handles leap days in day-based presets', () => {
    expect(resolveRange({ preset: 'last_30_days' }, '2024-03-01')).toMatchObject({
      from: '2024-02-01',
      to: '2024-03-01',
    });
    expect(resolveRange({ preset: 'last_30_days' }, '2023-03-01')).toMatchObject({
      from: '2023-01-31',
    });
  });

  it('this_quarter is quarter start through today', () => {
    expect(resolveRange({ preset: 'this_quarter' }, '2026-11-22')).toEqual({
      preset: 'this_quarter',
      from: '2026-10-01',
      to: '2026-11-22',
    });
    expect(resolveRange({ preset: 'this_quarter' }, '2026-01-01')).toMatchObject({
      from: '2026-01-01',
      to: '2026-01-01',
    });
    expect(resolveRange({ preset: 'this_quarter' }, '2026-03-31').from).toBe('2026-01-01');
    expect(resolveRange({ preset: 'this_quarter' }, '2026-04-01').from).toBe('2026-04-01');
  });

  it('last_30_days and last_90_days are inclusive', () => {
    expect(resolveRange({ preset: 'last_30_days' }, '2026-11-22')).toEqual({
      preset: 'last_30_days',
      from: '2026-10-24',
      to: '2026-11-22',
    });
    expect(resolveRange({ preset: 'last_90_days' }, '2026-11-22')).toEqual({
      preset: 'last_90_days',
      from: '2026-08-25',
      to: '2026-11-22',
    });
  });

  it('ignores from/to for a non-custom preset', () => {
    expect(
      resolveRange({ preset: 'last_30_days', from: '2020-01-01', to: '2020-01-02' }, '2026-11-22'),
    ).toEqual({ preset: 'last_30_days', from: '2026-10-24', to: '2026-11-22' });
    expect(resolveRange({ from: 'junk', to: 'junk' }, '2026-11-22').error).toBeUndefined();
  });
});

describe('resolveRange custom', () => {
  const today = '2026-11-22';

  it('accepts a valid range', () => {
    expect(resolveRange({ preset: 'custom', from: '2026-01-01', to: '2026-01-31' }, today)).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it('accepts a leap day and a single day', () => {
    expect(
      resolveRange({ preset: 'custom', from: '2024-02-29', to: '2024-02-29' }, today).error,
    ).toBeUndefined();
  });

  it('accepts 366 days and rejects 367', () => {
    expect(
      resolveRange({ preset: 'custom', from: '2025-01-01', to: '2026-01-01' }, today).error,
    ).toBeUndefined();
    const r = resolveRange({ preset: 'custom', from: '2025-01-01', to: '2026-01-02' }, today);
    expect(r).toMatchObject({ preset: 'custom', from: '2025-01-01', to: '2026-01-02' });
    expect(r.error).toBeTruthy();
  });

  it('rejects missing dates and echoes what was given', () => {
    const both = resolveRange({ preset: 'custom' }, today);
    expect(both.preset).toBe('custom');
    expect(both.error).toBeTruthy();
    expect(both.from).toBeUndefined();

    const onlyFrom = resolveRange({ preset: 'custom', from: '2026-01-01' }, today);
    expect(onlyFrom).toMatchObject({ preset: 'custom', from: '2026-01-01' });
    expect(onlyFrom.to).toBeUndefined();
    expect(onlyFrom.error).toBeTruthy();

    const onlyTo = resolveRange({ preset: 'custom', to: '2026-01-01' }, today);
    expect(onlyTo).toMatchObject({ to: '2026-01-01' });
    expect(onlyTo.error).toBeTruthy();
  });

  it('rejects malformed dates', () => {
    for (const bad of ['2026-1-1', 'yesterday', '2026/01/01', '2026-01-01T00:00']) {
      const r = resolveRange({ preset: 'custom', from: bad, to: '2026-02-01' }, today);
      expect(r).toMatchObject({ preset: 'custom', from: bad, to: '2026-02-01' });
      expect(r.error).toBeTruthy();
    }
  });

  it('rejects impossible dates', () => {
    const r = resolveRange({ preset: 'custom', from: '2026-02-30', to: '2026-03-05' }, today);
    expect(r).toMatchObject({ from: '2026-02-30', to: '2026-03-05' });
    expect(r.error).toBeTruthy();
    expect(
      resolveRange({ preset: 'custom', from: '2026-01-01', to: '2026-13-01' }, today).error,
    ).toBeTruthy();
    expect(
      resolveRange({ preset: 'custom', from: '2025-02-29', to: '2025-03-01' }, today).error,
    ).toBeTruthy();
  });

  it('rejects from after to', () => {
    const r = resolveRange({ preset: 'custom', from: '2026-02-02', to: '2026-02-01' }, today);
    expect(r).toMatchObject({ preset: 'custom', from: '2026-02-02', to: '2026-02-01' });
    expect(r.error).toBeTruthy();
  });

  it('uses the first value of repeated params', () => {
    expect(
      resolveRange({ preset: 'custom', from: ['2026-01-01', 'b'], to: ['2026-01-10', 'x'] }, today),
    ).toEqual({ preset: 'custom', from: '2026-01-01', to: '2026-01-10' });
    expect(resolveRange({ preset: ['last_30_days', 'custom'] }, today).preset).toBe('last_30_days');
    expect(
      resolveRange({ preset: 'custom', from: ['a', '2026-01-01'], to: '2026-01-10' }, today).error,
    ).toBeTruthy();
  });
});

describe('resolveRange edge cases', () => {
  it('accepts well-formed dates in years 0000-0099', () => {
    expect(
      resolveRange({ preset: 'custom', from: '0099-01-01', to: '0099-01-31' }, '2026-11-22'),
    ).toEqual({ preset: 'custom', from: '0099-01-01', to: '0099-01-31' });
  });

  it('throws on an invalid today (caller bug, not a URL param)', () => {
    expect(() => resolveRange({}, '2026-1-5')).toThrow(/Invalid today/);
  });
});
