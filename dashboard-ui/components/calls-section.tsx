import { isPastEnd, outcomeLabel, pageCount, type CallsResult } from "../lib/calls";
import { formatCallTime, formatDuration, formatMoney } from "../lib/format";
import { CallsPager } from "./calls-pager";
import { Notice } from "./notice";
import {
  labelCell,
  numCell,
  rowHover,
  table,
  thLeft,
  thPadding,
  thRight,
} from "./table-styles";

// The "Calls" list on the campaign pages. Times are in each call's office zone.
// Pages that render this redirect first when the page is past the end (isPastEnd).
export function CallsSection({ result }: { result: CallsResult }) {
  const { data, error } = result;
  return (
    <section aria-labelledby="calls-heading" className="flex flex-col gap-3">
      <h2 id="calls-heading" className="m-0 text-lg font-semibold">
        Calls
      </h2>
      {error ? (
        <Notice role="alert">{error}</Notice>
      ) : !data || data.total === 0 ? (
        <Notice>No calls in this range.</Notice>
      ) : (
        <CallsTable data={data} />
      )}
    </section>
  );
}

function CallsTable({ data }: { data: NonNullable<CallsResult["data"]> }) {
  if (isPastEnd(data)) return null;
  const start = (data.page - 1) * data.page_size;
  return (
    <>
      <table className={table}>
        <thead>
          <tr>
            <th scope="col" className={`${thLeft} ${thPadding}`}>
              Time
            </th>
            <th scope="col" className={`${thLeft} ${thPadding}`}>
              Outcome
            </th>
            <th scope="col" className={`${thRight} ${thPadding}`}>
              Duration
            </th>
            <th scope="col" className={`${thLeft} ${thPadding}`}>
              Agent
            </th>
            <th scope="col" className={`${thRight} ${thPadding}`}>
              Revenue
            </th>
          </tr>
        </thead>
        <tbody>
          {data.calls.map((c) => (
            <tr key={c.call_id} className={rowHover}>
              <th scope="row" className={`${labelCell} font-medium`}>
                {formatCallTime(c.started_at, c.timezone)}
              </th>
              <td className={labelCell}>{outcomeLabel(c.outcome)}</td>
              <td className={numCell}>{formatDuration(c.duration_seconds)}</td>
              <td className={labelCell}>{c.agent_id ?? "—"}</td>
              <td className={numCell}>{formatMoney(c.revenue_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CallsPager
        page={data.page}
        pageCount={pageCount(data)}
        label={`Calls ${start + 1}–${start + data.calls.length} of ${data.total}`}
      />
    </>
  );
}
