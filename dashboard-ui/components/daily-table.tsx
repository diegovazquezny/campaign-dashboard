"use client";

import { useState } from "react";
import type { Day } from "../lib/daily";
import { sumDays } from "../lib/daily";
import { Pager } from "./pager";
import { TableScroll } from "./table-scroll";
import {
  footLabel,
  footNum,
  labelCell,
  numCell,
  rowHover,
  table,
  thLeft,
  thPadding,
  thRight,
} from "./table-styles";
import {
  formatCount,
  formatMoney,
  SPEND_LABEL,
  SPEND_LOCATION_LABEL,
} from "../lib/format";

const PAGE_SIZE = 30;

type Props = {
  days: Day[];
  locationSelected?: boolean;
};

// Paging is client-side over the days already fetched for the chart. The parent keys
// this component on the filters so the page resets to 1 when the range or office changes.
export function DailyTable({ days, locationSelected }: Props) {
  const [page, setPage] = useState(1);
  // No days: render nothing rather than a table with a zero totals row.
  if (days.length === 0) return null;
  const rows = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const totals = sumDays(rows);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  // Clamp in case the days shrink while the key stays the same.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const shown = rows.slice(start, start + PAGE_SIZE);
  return (
    <div className="flex flex-col gap-3">
      <TableScroll label="Daily figures">
        <table className={table}>
          <thead>
            <tr>
              <th scope="col" className={`${thLeft} ${thPadding}`}>
                Date
              </th>
              <th scope="col" className={`${thRight} ${thPadding}`}>
                Calls
              </th>
              <th scope="col" className={`${thRight} ${thPadding}`}>
                Booked
              </th>
              <th scope="col" className={`${thRight} ${thPadding}`}>
                Revenue
              </th>
              <th scope="col" className={`${thRight} ${thPadding}`}>
                {locationSelected ? SPEND_LOCATION_LABEL : SPEND_LABEL}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.date} className={rowHover}>
                <th
                  scope="row"
                  className={`${labelCell} font-medium whitespace-nowrap`}
                >
                  {d.date}
                </th>
                <td className={numCell}>{formatCount(d.calls)}</td>
                <td className={numCell}>{formatCount(d.booked)}</td>
                <td className={numCell}>{formatMoney(d.revenue_cents)}</td>
                <td className={numCell}>{formatMoney(d.spend_cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="totals-row">
              <th scope="row" className={footLabel}>
                Totals (all {rows.length} days)
              </th>
              <td className={footNum}>{formatCount(totals.calls)}</td>
              <td className={footNum}>{formatCount(totals.booked)}</td>
              <td className={footNum}>{formatMoney(totals.revenue_cents)}</td>
              <td className={footNum}>{formatMoney(totals.spend_cents)}</td>
            </tr>
          </tfoot>
        </table>
      </TableScroll>
      <Pager
        page={current}
        pageCount={pageCount}
        onChange={setPage}
        label={`Days ${start + 1}–${start + shown.length} of ${rows.length}`}
        ariaLabel="Daily table pages"
        prevLabel={`Previous ${PAGE_SIZE} days`}
        nextLabel={`Next ${PAGE_SIZE} days`}
      />
    </div>
  );
}
