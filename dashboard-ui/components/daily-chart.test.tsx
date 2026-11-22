import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toChartData, type Day } from "../lib/daily";

const received: {
  data?: unknown;
  tooltip?: (v: unknown) => string;
  tick?: (v: unknown) => string;
} = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ data, children }: { data: unknown; children: ReactNode }) => {
    received.data = data;
    return <div>{children}</div>;
  },
  Line: (p: {
    dataKey: string;
    name: string;
    connectNulls?: boolean;
    stroke?: string;
  }) => (
    <span
      data-testid={`line-${p.dataKey}`}
      data-connect-nulls={String(p.connectNulls)}
      data-stroke={p.stroke}
    >
      {p.name}
    </span>
  ),
  Legend: () => <div>legend</div>,
  Tooltip: (p: { formatter?: (v: unknown) => string }) => {
    received.tooltip = p.formatter;
    return null;
  },
  XAxis: () => null,
  YAxis: (p: { tickFormatter?: (v: unknown) => string }) => {
    received.tick = p.tickFormatter;
    return null;
  },
  CartesianGrid: () => null,
}));

import { DailyChart } from "./daily-chart";

const days = [
  { date: "2026-01-01", calls: 2, booked: 1, revenue_cents: 10000, spend_cents: 2500 },
  { date: "2026-01-02", calls: 0, booked: 0, revenue_cents: 0, spend_cents: null },
] as Day[];

afterEach(cleanup);

describe("DailyChart", () => {
  it("passes toChartData output and renders both series", () => {
    render(<DailyChart days={days} />);
    expect(received.data).toEqual(toChartData(days));
    expect(screen.getByTestId("line-revenue_dollars")).toHaveTextContent(
      "Revenue",
    );
    expect(screen.getByTestId("line-spend_dollars")).toHaveTextContent(
      "Budgeted spend (est.)",
    );
    expect(screen.getByText("legend")).toBeInTheDocument();
  });

  it("has an accessible title and description with totals", () => {
    render(<DailyChart days={days} />);
    expect(
      screen.getByRole("img", { name: "Revenue vs spend by day" }),
    ).toHaveAccessibleDescription(
      /2026-01-01 to 2026-01-02.*Total revenue \$100; total spend \$25/,
    );
  });

  it("shows a dash for all-null spend and the location label", () => {
    render(<DailyChart days={[days[1]]} locationSelected />);
    expect(screen.getByRole("img")).toHaveAccessibleDescription(
      /total spend —/,
    );
    expect(screen.getByTestId("line-spend_dollars")).toHaveTextContent(
      "allocated by call share",
    );
  });

  it("leaves gaps for null spend and uses the series colours", () => {
    render(<DailyChart days={days} />);
    for (const key of ["revenue_dollars", "spend_dollars"]) {
      expect(screen.getByTestId(`line-${key}`).dataset.connectNulls).toBe(
        "false",
      );
    }
    expect(screen.getByTestId("line-revenue_dollars").dataset.stroke).toBe(
      "var(--series-revenue)",
    );
    expect(screen.getByTestId("line-spend_dollars").dataset.stroke).toBe(
      "var(--series-spend)",
    );
  });

  it("formats the axis in whole dollars and the tooltip in cents", () => {
    render(<DailyChart days={days} />);
    expect(received.tick?.(12.5)).toBe("$13");
    expect(received.tooltip?.(12.5)).toBe("$12.50");
    expect(received.tooltip?.(null)).toBe("—");
  });

  it("gives each chart its own description id", () => {
    render(
      <>
        <DailyChart days={days} />
        <DailyChart days={[days[0]]} />
      </>,
    );
    const [a, b] = screen.getAllByRole("img");
    expect(a.getAttribute("aria-describedby")).not.toBe(
      b.getAttribute("aria-describedby"),
    );
  });

  it("renders with no days", () => {
    render(<DailyChart days={[]} />);
    expect(screen.getByRole("img")).toHaveAccessibleDescription(
      /total spend —/,
    );
  });
});
