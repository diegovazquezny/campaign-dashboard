// Display formatting for the dashboard. Every formatter returns "—" for
// null, undefined and non-finite numbers, so NaN and Infinity never reach the UI.

const EMPTY = "—";

type Maybe = number | null | undefined;

const countFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const percentFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "negative",
});
const ratioFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "negative",
});

function isUsable(value: Maybe): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Avoids "-0" (and "$-0") when a small negative value rounds to zero.
function noNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

// Rounds halves away from zero (Math.round alone rounds them toward +Infinity).
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function formatCount(value: Maybe): string {
  if (!isUsable(value)) return EMPTY;
  return countFormat.format(noNegativeZero(roundHalfAway(value)));
}

// Cents to whole dollars, e.g. 1234500 -> "$12,345". Accepts fractional cents.
export function formatMoney(cents: Maybe): string {
  if (!isUsable(cents)) return EMPTY;
  const dollars = noNegativeZero(roundHalfAway(cents / 100));
  const body = countFormat.format(Math.abs(dollars));
  return dollars < 0 ? `-$${body}` : `$${body}`;
}

// Takes a fraction (0.4567 -> "45.7%").
export function formatPercent(fraction: Maybe): string {
  if (!isUsable(fraction)) return EMPTY;
  const percent = fraction * 100;
  return `${percentFormat.format(percent)}%`;
}

// Revenue divided by spend, e.g. 3.436 -> "3.44×".
export function formatRatio(ratio: Maybe): string {
  if (!isUsable(ratio)) return EMPTY;
  return `${ratioFormat.format(ratio)}×`;
}

// Header text for the spend column, shared by the overview and daily tables.
export const SPEND_LABEL = "Budgeted spend (est.)";
export const SPEND_LOCATION_LABEL =
  "Budgeted spend (est.), allocated by call share";

const exactFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Whole-dollar-and-cents amount for chart tooltips, e.g. 125.5 -> "$125.50".
export const dollarsExact = (v: unknown) =>
  typeof v === "number" ? exactFormat.format(v) : EMPTY;

// Seconds as "45s", "2m 05s" or "1h 02m".
export function formatDuration(seconds: Maybe): string {
  if (!isUsable(seconds) || seconds < 0) return EMPTY;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${two(m)}m`;
  if (m > 0) return `${m}m ${two(s)}s`;
  return `${s}s`;
}

// An ISO instant in the given IANA zone, with its abbreviation: "Sep 2, 10:00 AM CDT".
export function formatCallTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
