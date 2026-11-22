import type { Meta } from "../lib/api-types";
import { formatShortDate, freshnessWarning, partialRange } from "../lib/badges";

type Props = {
  coverage: Meta["data_coverage"];
  freshness: Meta["freshness"];
  range: { from: string; to: string };
};

export function PageHeader({ coverage, freshness, range }: Props) {
  const coverageText = coverage
    ? `${formatShortDate(coverage.from)} – ${formatShortDate(coverage.to)}`
    : null;
  return (
    <header>
      <h1>Campaign dashboard</h1>
      {coverageText ? (
        <p>Data covers {coverageText}</p>
      ) : (
        <p>No data loaded</p>
      )}
      {freshness && freshnessWarning(range, freshness) && (
        <p role="status">
          Outcomes can take up to 3 days to arrive; bookings and revenue after{" "}
          {formatShortDate(freshness.outcomes_may_be_incomplete_from)} may be
          incomplete.
        </p>
      )}
      {coverageText && partialRange(range, coverage) && (
        <p role="status">Data covers {coverageText}.</p>
      )}
    </header>
  );
}
