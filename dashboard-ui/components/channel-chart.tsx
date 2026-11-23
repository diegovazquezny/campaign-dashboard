"use client";

import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChannelTotal } from "../lib/channels";
import { HELP } from "../lib/help-text";
import { InfoTip } from "./info-tip";
import { MetricToggle, TOOLTIP_STYLE, type Metric } from "./metric-toggle";
import { dollarsExact, formatCount, formatMoney } from "../lib/format";

export function ChannelChart({ channels }: { channels: ChannelTotal[] }) {
  const [metric, setMetric] = useState<Metric>("calls");
  const captionId = useId();
  const descId = useId();
  const isCalls = metric === "calls";
  const title = isCalls ? "Calls by channel" : "Revenue by channel";

  const data = channels
    .map((c) => ({
      label: c.label,
      color: c.color,
      value: isCalls ? c.calls : c.revenue_cents / 100,
    }))
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const describe = (v: number) =>
    isCalls ? formatCount(v) : formatMoney(v * 100);
  const description = `${isCalls ? "Calls" : "Revenue"} by channel: ${data
    .map((d) => `${d.label} ${describe(d.value)}`)
    .join(", ")}. Total ${describe(total)}.`;

  return (
    <figure className="m-0 rounded-card border border-border bg-card px-3 pt-5 sm:px-5 pb-3 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <figcaption
            id={captionId}
            className="text-[15px] font-semibold text-fg"
          >
            {title}
          </figcaption>
          <InfoTip label={title} text={HELP.byChannel} />
        </div>
        <MetricToggle
          label="Channel metric"
          metric={metric}
          onChange={setMetric}
        />
      </div>
      <div
        role="img"
        aria-labelledby={captionId}
        aria-describedby={descId}
        className="h-64 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickFormatter={describe}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={84}
              tick={{ fontSize: 12, fill: "currentColor" }}
            />
            <Tooltip
              cursor={{ fill: "var(--row-hover)" }}
              formatter={(v) =>
                isCalls ? formatCount(Number(v)) : dollarsExact(v)
              }
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar
              dataKey="value"
              name={isCalls ? "Calls" : "Revenue"}
              radius={[0, 4, 4, 0]}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p id={descId} className="sr-only">
        {description}
      </p>
    </figure>
  );
}
