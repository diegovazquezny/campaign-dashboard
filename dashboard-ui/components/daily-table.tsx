import type { Day } from "../lib/daily";
import { sumDays } from "../lib/daily";
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
  const rows = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const totals = sumDays(rows);
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Calls</th>
          <th scope="col">Booked</th>
          <th scope="col">Revenue</th>
          <th scope="col">
            {locationSelected ? SPEND_LOCATION_LABEL : SPEND_LABEL}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.date}>
            <th scope="row">{d.date}</th>
            <td>{formatCount(d.calls)}</td>
            <td>{formatCount(d.booked)}</td>
            <td>{formatMoney(d.revenue_cents)}</td>
            <td>{formatMoney(d.spend_cents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr data-testid="totals-row">
          <th scope="row">Totals</th>
          <td>{formatCount(totals.calls)}</td>
          <td>{formatCount(totals.booked)}</td>
          <td>{formatMoney(totals.revenue_cents)}</td>
          <td>{formatMoney(totals.spend_cents)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
