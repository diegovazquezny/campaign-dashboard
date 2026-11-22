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
