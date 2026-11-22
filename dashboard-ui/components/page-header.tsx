import type { Meta } from "../lib/api-types";
import {
  formatDateSpan,
  formatShortDate,
  freshnessWarning,
  partialRange,
} from "../lib/badges";

const PILL = "m-0 rounded-full border px-3 py-0.75 text-[13px]";
const CHIP = `${PILL} border-border bg-chip text-muted`;
const WARN = `${PILL} border-warn-border bg-warn-bg text-warn-fg`;

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
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {coverageText ? (
        <p className={CHIP}>Data covers {coverageText}</p>
      ) : (
        <p className={CHIP}>No data loaded</p>
      )}
      {coverageText && freshness && freshnessWarning(range, freshness) && (
        <p role="status" className={WARN}>
          Bookings and revenue from{" "}
          {formatShortDate(freshness.outcomes_may_be_incomplete_from)} onward
          may be incomplete.
        </p>
      )}
      {coverageText && partialRange(range, coverage) && (
        <p role="status" className={WARN}>
          Selected range extends outside available data (covers {coverageText}).
        </p>
      )}
    </header>
  );
}
