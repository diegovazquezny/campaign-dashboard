"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sumDays, toChartData, type Day } from "../lib/daily";
import { formatMoney } from "../lib/format";

type Props = { days: Day[]; locationSelected?: boolean };

const dollars = (v: unknown) =>
  typeof v === "number" ? formatMoney(v * 100) : "—";

export function DailyChart({ days, locationSelected = false }: Props) {
  const data = toChartData(days);
  const totals = sumDays(days);
  const spendName = locationSelected
    ? "Budgeted spend (est.), allocated by call share"
    : "Budgeted spend (est.)";
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  const description = `Daily revenue and budgeted spend in dollars${
    first ? `, ${first} to ${last}` : ""
  }. Total revenue ${formatMoney(totals.revenue_cents)}; total spend ${formatMoney(totals.spend_cents)}.`;

  return (
    <figure className="my-4">
      <figcaption className="mb-2 text-sm font-medium">
        Revenue vs spend by day
      </figcaption>
      <div
        role="img"
        aria-label="Revenue vs spend by day"
        aria-describedby="daily-chart-desc"
        className="h-72 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              stroke="currentColor"
              strokeOpacity={0.12}
              vertical={false}
            />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={dollars} width={64} />
            <Tooltip formatter={(v) => dollars(v)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue_dollars"
              name="Revenue"
              stroke="var(--series-revenue)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="spend_dollars"
              name={spendName}
              stroke="var(--series-spend)"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p id="daily-chart-desc" className="sr-only">
        {description}
      </p>
    </figure>
  );
}
