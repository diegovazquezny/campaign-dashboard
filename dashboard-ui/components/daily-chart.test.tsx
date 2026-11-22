import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toChartData, type Day } from "../lib/daily";

const received: { data?: unknown } = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ data, children }: { data: unknown; children: ReactNode }) => {
    received.data = data;
    return <div>{children}</div>;
  },
  Line: (p: { dataKey: string; name: string }) => (
    <span data-testid={`line-${p.dataKey}`}>{p.name}</span>
  ),
  Legend: () => <div>legend</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
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
});
