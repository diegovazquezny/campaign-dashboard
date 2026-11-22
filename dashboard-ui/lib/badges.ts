import type { Meta } from "./api-types";

type Range = { from: string; to: string };
type Coverage = Meta["data_coverage"];
type Freshness = Meta["freshness"];

// ISO dates (YYYY-MM-DD) compare correctly as strings.
export function partialRange(range: Range, coverage: Coverage): boolean {
  if (!coverage) return false;
  return range.from < coverage.from || range.to > coverage.to;
}

export function freshnessWarning(range: Range, freshness: Freshness): boolean {
  if (!freshness) return false;
  return range.to >= freshness.outcomes_may_be_incomplete_from;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "2026-09-01" -> "Sep 1" (or "Sep 1, 2026" with includeYear); string parsing
// only, no Date/local time. Invalid months/days are returned unchanged.
export function formatShortDate(iso: string, includeYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const month = MONTHS[monthIdx];
  if (!month) return iso;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][monthIdx];
  if (day < 1 || day > daysInMonth) return iso;
  return includeYear ? `${month} ${day}, ${year}` : `${month} ${day}`;
}

// Years are shown when the span crosses years or isn't in the current year.
export function formatDateSpan(
  from: string,
  to: string,
  currentYear: number,
): string {
  const fy = from.slice(0, 4);
  const withYear = fy !== to.slice(0, 4) || fy !== String(currentYear);
  return `${formatShortDate(from, withYear)} – ${formatShortDate(to, withYear)}`;
}
