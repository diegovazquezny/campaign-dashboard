import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const received: {
  data?: { label: string; value: number; color: string }[];
  tick?: (v: number) => string;
  tooltip?: (v: number) => string;
} = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    data,
    children,
  }: {
    data: typeof received.data;
    children: ReactNode;
  }) => {
    received.data = data;
    return <div>{children}</div>;
  },
  Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Tooltip: (p: { formatter: (v: number) => string }) => {
    received.tooltip = p.formatter;
    return null;
  },
  XAxis: (p: { tickFormatter: (v: number) => string }) => {
    received.tick = p.tickFormatter;
    return null;
  },
  YAxis: () => null,
}));

import { ChannelChart } from "./channel-chart";

const channels = [
  {
    channel: "paid_search",
    label: "Paid search",
    color: "var(--channel-paid-search)",
    calls: 8,
    revenue_cents: 1700,
  },
  {
    channel: "organic",
    label: "Organic",
    color: "var(--channel-organic)",
    calls: 3,
    revenue_cents: 90000,
  },
];

afterEach(cleanup);

describe("ChannelChart", () => {
  it("plots calls by default, largest first, with a summary", () => {
    render(<ChannelChart channels={channels} />);
    expect(received.data?.map((d) => [d.label, d.value])).toEqual([
      ["Paid search", 8],
      ["Organic", 3],
    ]);
    expect(screen.getByRole("img", { name: "Calls by channel" })).toBeTruthy();
    expect(
      screen.getByText(/Paid search 8, Organic 3\. Total 11\./),
    ).toBeTruthy();
  });

  it("switches to revenue in dollars and re-sorts", () => {
    render(<ChannelChart channels={channels} />);
    fireEvent.click(screen.getByRole("button", { name: "Revenue" }));
    expect(received.data?.map((d) => [d.label, d.value])).toEqual([
      ["Organic", 900],
      ["Paid search", 17],
    ]);
    expect(received.tooltip?.(900)).toBe("$900.00");
    expect(received.tick?.(900)).toBe("$900");
    expect(
      screen.getByRole("img", { name: "Revenue by channel" }),
    ).toBeTruthy();
    expect(screen.getByText(/Total \$917\./)).toBeTruthy();
  });
});
