import type { Day } from "../lib/daily";
import { sumDays } from "../lib/daily";
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

type Props = {
  days: Day[];
  locationSelected?: boolean;
};

export function DailyTable({ days, locationSelected }: Props) {
  // No days: render nothing rather than a table with a zero totals row.
  if (days.length === 0) return null;
  const rows = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const totals = sumDays(rows);
  return (
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
        {rows.map((d) => (
          <tr key={d.date} className={rowHover}>
            <th scope="row" className={`${labelCell} font-medium`}>
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
            Totals
          </th>
          <td className={footNum}>{formatCount(totals.calls)}</td>
          <td className={footNum}>{formatCount(totals.booked)}</td>
          <td className={footNum}>{formatMoney(totals.revenue_cents)}</td>
          <td className={footNum}>{formatMoney(totals.spend_cents)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
