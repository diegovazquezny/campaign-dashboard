"use client";

import { useId } from "react";
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
import { HELP } from "../lib/help-text";
import { InfoTip } from "./info-tip";
import {
  dollarsExact,
  formatMoney,
  SPEND_LABEL,
  SPEND_LOCATION_LABEL,
} from "../lib/format";

type Props = { days: Day[]; locationSelected?: boolean };

const dollars = (v: unknown) =>
  typeof v === "number" ? formatMoney(v * 100) : "—";

// Recharts renders these as inline styles, so the theme tokens are passed as var()s.
const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
};

export function DailyChart({ days, locationSelected = false }: Props) {
  const descId = useId();
  const captionId = useId();
  const data = toChartData(days);
  const totals = sumDays(days);
  const spendName = locationSelected ? SPEND_LOCATION_LABEL : SPEND_LABEL;
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  const description = `Daily revenue and budgeted spend in dollars${
    first ? `, ${first} to ${last}` : ""
  }. Total revenue ${formatMoney(totals.revenue_cents)}; total spend ${formatMoney(totals.spend_cents)}.`;

  return (
    <figure className="m-0 rounded-card border border-border bg-card px-3 pt-5 sm:px-5 pb-2 shadow-card">
      <div className="mb-2 flex items-center gap-1">
        <figcaption
          id={captionId}
          className="text-[15px] font-semibold text-fg"
        >
          Revenue vs spend by day
        </figcaption>
        <InfoTip label="Revenue vs spend by day" text={HELP.revenueVsSpend} />
      </div>
      <div
        role="img"
        aria-labelledby={captionId}
        aria-describedby={descId}
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
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "currentColor" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickFormatter={dollars}
              width={64}
            />
            <Tooltip
              formatter={(v) => dollarsExact(v)}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: "var(--muted)" }}>{value}</span>
              )}
            />
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
              dot={{ r: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p id={descId} className="sr-only">
        {description}
      </p>
    </figure>
  );
}
