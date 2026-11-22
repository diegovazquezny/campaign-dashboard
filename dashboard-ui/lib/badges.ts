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

// "2026-09-01" -> "Sep 1"; string parsing only, no Date/local time.
export function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(m[3])}`;
}
