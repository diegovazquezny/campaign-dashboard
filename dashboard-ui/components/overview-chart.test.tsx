import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const received: {
  data?: unknown;
  area?: { x1: string; x2: string } | null;
  tick?: (v: number) => string;
  tooltip?: (v: number) => string;
  yDecimals?: boolean;
  xScale?: string;
} = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ data, children }: { data: unknown; children: ReactNode }) => {
    received.data = data;
    received.area = null;
    return <div>{children}</div>;
  },
  Line: (p: { name: string; stroke: string }) => (
    <span data-testid="line" data-stroke={p.stroke}>
      {p.name}
    </span>
  ),
  ReferenceArea: (p: { x1: string; x2: string }) => {
    received.area = { x1: p.x1, x2: p.x2 };
    return null;
  },
  Tooltip: (p: { formatter: (v: number) => string }) => {
    received.tooltip = p.formatter;
    return null;
  },
  XAxis: (p: { scale?: string }) => {
    received.xScale = p.scale;
    return null;
  },
  YAxis: (p: {
    tickFormatter: (v: number) => string;
    allowDecimals?: boolean;
  }) => {
    received.tick = p.tickFormatter;
    received.yDecimals = p.allowDecimals;
    return null;
  },
  CartesianGrid: () => null,
}));

import { OverviewChart } from "./overview-chart";

const days = [
  { date: "2026-09-01", calls: 3, booked: 1, revenue_cents: 12500 },
  { date: "2026-09-02", calls: 0, booked: 0, revenue_cents: 0 },
  { date: "2026-09-03", calls: 5, booked: 2, revenue_cents: 30000 },
];

afterEach(cleanup);

describe("OverviewChart", () => {
  it("plots calls by default, with a labelled image and a summary", () => {
    render(<OverviewChart days={days} incompleteFrom={null} />);

    expect(received.data).toEqual([
      { date: "2026-09-01", value: 3 },
      { date: "2026-09-02", value: 0 },
      { date: "2026-09-03", value: 5 },
    ]);
    expect(screen.getByTestId("line").dataset.stroke).toBe(
      "var(--series-calls)",
    );
    const img = screen.getByRole("img", { name: "Calls by day" });
    expect(img.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/Total calls 8; total revenue \$425/)).toBeTruthy();
  });

  it("switches to revenue in dollars", () => {
    render(<OverviewChart days={days} incompleteFrom={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Revenue" }));

    expect(received.data).toEqual([
      { date: "2026-09-01", value: 125 },
      { date: "2026-09-02", value: 0 },
      { date: "2026-09-03", value: 300 },
    ]);
    expect(screen.getByTestId("line").dataset.stroke).toBe(
      "var(--series-revenue)",
    );
    expect(
      screen
        .getByRole("button", { name: "Revenue" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("img", { name: "Revenue by day" })).toBeTruthy();
  });

  it("renders an empty range without crashing", () => {
    render(<OverviewChart days={[]} incompleteFrom="2026-09-02" />);

    expect(received.data).toEqual([]);
    expect(received.area).toBeNull();
    expect(screen.queryByText(/Shaded days/)).toBeNull();
  });

  it("shades and notes the days from the freshness date on", () => {
    render(<OverviewChart days={days} incompleteFrom="2026-09-02" />);

    expect(received.area).toEqual({ x1: "2026-09-02", x2: "2026-09-03" });
    expect(screen.getByText(/Shaded days/)).toBeTruthy();
    expect(
      screen.getByText(/from 2026-09-02 onward may be incomplete/),
    ).toBeTruthy();
  });

  it("starts the shading at the first day when the whole range is affected", () => {
    render(<OverviewChart days={days} incompleteFrom="2026-08-01" />);

    expect(received.area).toEqual({ x1: "2026-09-01", x2: "2026-09-03" });
  });

  it("does not shade a range that ends before the freshness date", () => {
    render(<OverviewChart days={days} incompleteFrom="2026-09-10" />);

    expect(received.area).toBeNull();
    expect(screen.queryByText(/Shaded days/)).toBeNull();
  });

  it("shades the single day of a one-day range", () => {
    render(<OverviewChart days={[days[2]]} incompleteFrom="2026-09-03" />);

    expect(received.area).toEqual({ x1: "2026-09-03", x2: "2026-09-03" });
  });

  it("shades only the last day when the freshness date is the last day", () => {
    render(<OverviewChart days={days} incompleteFrom="2026-09-03" />);

    expect(received.area).toEqual({ x1: "2026-09-03", x2: "2026-09-03" });
  });

  it("uses a band axis (so shading covers whole days) and whole-number ticks", () => {
    render(<OverviewChart days={days} incompleteFrom={null} />);

    expect(received.xScale).toBe("band");
    expect(received.yDecimals).toBe(false);
  });

  it("formats ticks and tooltips for calls", () => {
    render(<OverviewChart days={days} incompleteFrom={null} />);

    expect(received.tick!(1200)).toBe("1,200");
    expect(received.tooltip!(1200)).toBe("1,200");
  });

  it("formats revenue ticks as whole dollars and tooltips with cents", () => {
    render(<OverviewChart days={days} incompleteFrom={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Revenue" }));

    expect(received.tick!(125.5)).toBe("$126");
    expect(received.tooltip!(125.5)).toBe("$125.50");
  });
});
