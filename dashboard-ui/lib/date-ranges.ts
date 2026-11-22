export type Preset =
  | 'last_quarter'
  | 'this_quarter'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

export interface ResolvedRange {
  preset: Preset;
  from?: string;
  to?: string;
  error?: string;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_PRESET: Preset = 'last_quarter';
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const PRESETS: readonly Preset[] = [
  'last_quarter',
  'this_quarter',
  'last_30_days',
  'last_90_days',
  'custom',
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function format(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** Days since epoch for a valid YYYY-MM-DD string, or null if malformed/impossible. */
function toDayNumber(s: string): number | null {
  const match = DATE_RE.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const ms = Date.UTC(y, m - 1, d);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return Math.round(ms / DAY_MS);
}

function fromDayNumber(n: number): string {
  const dt = new Date(n * DAY_MS);
  return format(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function quarterStartMonth(m: number): number {
  return Math.floor((m - 1) / 3) * 3 + 1;
}

function presetRange(
  preset: Exclude<Preset, 'custom'>,
  today: string,
): { from: string; to: string } {
  const todayN = toDayNumber(today);
  if (todayN === null) throw new Error(`Invalid today: ${today}`);
  const y = Number(today.slice(0, 4));
  const qm = quarterStartMonth(Number(today.slice(5, 7)));
  switch (preset) {
    case 'this_quarter':
      return { from: format(y, qm, 1), to: today };
    case 'last_30_days':
      return { from: fromDayNumber(todayN - 29), to: today };
    case 'last_90_days':
      return { from: fromDayNumber(todayN - 89), to: today };
    case 'last_quarter': {
      const startY = qm === 1 ? y - 1 : y;
      const startM = qm === 1 ? 10 : qm - 3;
      // The previous quarter ends the day before this quarter starts.
      const endN = (toDayNumber(format(y, qm, 1)) as number) - 1;
      return { from: format(startY, startM, 1), to: fromDayNumber(endN) };
    }
  }
}

/**
 * Resolve URL params into a date range. `today` is a YYYY-MM-DD UTC date.
 * Never throws for bad params; bad custom ranges return `error`.
 */
export function resolveRange(params: SearchParams, today: string): ResolvedRange {
  const rawPreset = first(params.preset);
  const preset = PRESETS.find((p) => p === rawPreset) ?? DEFAULT_PRESET;

  if (preset !== 'custom') {
    return { preset, ...presetRange(preset, today) };
  }

  const from = first(params.from) || undefined;
  const to = first(params.to) || undefined;
  const echoed: ResolvedRange = { preset: 'custom' };
  if (from !== undefined) echoed.from = from;
  if (to !== undefined) echoed.to = to;

  if (from === undefined || to === undefined) {
    return { ...echoed, error: 'Custom range needs both a start and an end date.' };
  }
  const fromN = toDayNumber(from);
  const toN = toDayNumber(to);
  if (fromN === null || toN === null) {
    return { ...echoed, error: 'Dates must be valid and formatted as YYYY-MM-DD.' };
  }
  if (fromN > toN) {
    return { ...echoed, error: 'Start date must not be after the end date.' };
  }
  if (toN - fromN + 1 > MAX_RANGE_DAYS) {
    return { ...echoed, error: `Range must not exceed ${MAX_RANGE_DAYS} days.` };
  }
  return { preset: 'custom', from, to };
}
