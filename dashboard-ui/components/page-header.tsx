import type { Meta } from "../lib/api-types";
import {
  formatDateSpan,
  formatShortDate,
  freshnessWarning,
  partialRange,
} from "../lib/badges";

type Props = {
  coverage: Meta["data_coverage"];
  freshness: Meta["freshness"];
  range: { from: string; to: string };
  // Used only to decide whether to show years; defaults to now.
  today?: Date;
};

// The page (app/page.tsx) owns the single <h1>; this header renders none.
export function PageHeader({
  coverage,
  freshness,
  range,
  today = new Date(),
}: Props) {
  const coverageText = coverage
    ? formatDateSpan(coverage.from, coverage.to, today.getFullYear())
    : null;
  return (
    <header>
      {coverageText ? <p>Data covers {coverageText}</p> : <p>No data loaded</p>}
      {coverageText && freshness && freshnessWarning(range, freshness) && (
        <p role="status">
          Bookings and revenue from{" "}
          {formatShortDate(freshness.outcomes_may_be_incomplete_from)} onward
          may be incomplete.
        </p>
      )}
      {coverageText && partialRange(range, coverage) && (
        <p role="status">
          Selected range extends outside available data (covers {coverageText}).
        </p>
      )}
    </header>
  );
}
