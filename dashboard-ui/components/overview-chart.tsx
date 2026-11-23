"use client";

import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountDailyResponse } from "../lib/api-types";
import { HELP } from "../lib/help-text";
import { InfoTip } from "./info-tip";
import { MetricToggle, TOOLTIP_STYLE, type Metric } from "./metric-toggle";
import { dollarsExact, formatCount, formatMoney } from "../lib/format";

type Props = {
  days: AccountDailyResponse["days"];
  // First day whose outcomes may still be arriving (meta.freshness), or null.
  incompleteFrom: string | null;
};

export function OverviewChart({ days, incompleteFrom }: Props) {
  const [metric, setMetric] = useState<Metric>("calls");
  const captionId = useId();
  const descId = useId();

  const isCalls = metric === "calls";
  const title = isCalls ? "Calls by day" : "Revenue by day";
  const data = days.map((d) => ({
    date: d.date,
    value: isCalls ? d.calls : d.revenue_cents / 100,
  }));
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  // Shade the days that may be incomplete, only when the range reaches them.
  const shadeFrom =
    incompleteFrom && last && last >= incompleteFrom
      ? first && first > incompleteFrom
        ? first
        : incompleteFrom
      : null;
  const totalCalls = days.reduce((sum, d) => sum + d.calls, 0);
  const totalRevenue = days.reduce((sum, d) => sum + d.revenue_cents, 0);
  const description = `Daily ${isCalls ? "calls" : "revenue in dollars"}${
    first ? `, ${first} to ${last}` : ""
  }. Total calls ${formatCount(totalCalls)}; total revenue ${formatMoney(totalRevenue)}.${
    shadeFrom
      ? ` Bookings and revenue from ${shadeFrom} onward may be incomplete.`
      : ""
  }`;

  return (
    <figure className="m-0 rounded-card border border-border bg-card px-3 pt-5 sm:px-5 pb-2 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* The icon stays outside the figcaption: the chart's accessible name
            is the figcaption text and must not include the tooltip. */}
        <div className="flex items-center gap-1">
          <figcaption
            id={captionId}
            className="text-[15px] font-semibold text-fg"
          >
            {title}
          </figcaption>
          <InfoTip label={title} text={HELP.byDay} />
        </div>
        <MetricToggle
          label="Chart metric"
          metric={metric}
          onChange={setMetric}
        />
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
              // "band" makes the shaded area cover whole days, even one day.
              scale="band"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickFormatter={(v) =>
                isCalls ? formatCount(v) : formatMoney(Number(v) * 100)
              }
              width={64}
            />
            {shadeFrom && last && (
              <ReferenceArea
                x1={shadeFrom}
                x2={last}
                fill="var(--warn-bg)"
                fillOpacity={0.8}
                stroke="var(--warn-border)"
              />
            )}
            <Tooltip
              formatter={(v) =>
                isCalls ? formatCount(Number(v)) : dollarsExact(v)
              }
              labelFormatter={(label) => String(label)}
              contentStyle={TOOLTIP_STYLE}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={isCalls ? "Calls" : "Revenue"}
              stroke={isCalls ? "var(--series-calls)" : "var(--series-revenue)"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {shadeFrom && (
        <p className="m-0 mb-2 text-[13px] text-warn-fg">
          Shaded days: bookings and revenue may be incomplete.
        </p>
      )}
      <p id={descId} className="sr-only">
        {description}
      </p>
    </figure>
  );
}
