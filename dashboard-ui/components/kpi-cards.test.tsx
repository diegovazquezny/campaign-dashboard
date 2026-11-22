import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Totals } from "../lib/api-types";
import { KpiCards } from "./kpi-cards";

const totals: Totals = {
  calls: 1234,
  unique_callers: 1000,
  new_callers: 500,
  booked: 200,
  booking_rate: 0.162,
  unanswered_rate: 0.1,
  awaiting_outcome: 5,
  revenue_cents: 1234500,
  spend_cents: 500000,
  paid: {
    revenue_cents: 1000000,
    booked: 150,
    spend_cents: 400000,
    revenue_per_spend: 2.5,
    spend_per_booking_cents: 2666,
  },
};
const range = { from: "2026-09-01", to: "2026-09-10" };
const freshness = {
  latest_update_at: "2026-09-30T00:00:00Z",
  outcomes_may_be_incomplete_from: "2026-09-28",
};

function value(label: string): string {
  const term = screen.getByText(label);
  return term.nextElementSibling?.textContent ?? "";
}

afterEach(cleanup);

describe("KpiCards", () => {
  it("shows the totals, with revenue ÷ spend from the paid block", () => {
    render(<KpiCards totals={totals} range={range} freshness={freshness} />);

    expect(value("Calls")).toBe("1,234");
    expect(value("Booked")).toBe("200");
    expect(value("Booking rate")).toBe("16.2%");
    expect(value("Revenue")).toBe("$12,345");
    expect(value("Revenue ÷ spend")).toBe("2.50×");
    expect(screen.getByText("paid campaigns only")).toBeTruthy();
  });

  it("shows — for null values", () => {
    const empty: Totals = {
      ...totals,
      booking_rate: null,
      revenue_cents: null,
      paid: { ...totals.paid, revenue_per_spend: null },
    };
    render(<KpiCards totals={empty} range={range} freshness={null} />);

    expect(value("Booking rate")).toBe("—");
    expect(value("Revenue")).toBe("—");
    expect(value("Revenue ÷ spend")).toBe("—");
  });

  it("marks only the outcome cards when the range reaches the freshness date", () => {
    render(
      <KpiCards
        totals={totals}
        range={{ from: "2026-09-01", to: "2026-09-29" }}
        freshness={freshness}
      />,
    );

    const marked = screen.getAllByText("May be incomplete");
    expect(marked).toHaveLength(3);
    const calls = screen.getByText("Calls").parentElement!;
    expect(within(calls).queryByText("May be incomplete")).toBeNull();
    const ratio = screen.getByText("Revenue ÷ spend").parentElement!;
    expect(within(ratio).queryByText("May be incomplete")).toBeNull();
  });

  it("shows no marker when the range ends before the freshness date", () => {
    render(<KpiCards totals={totals} range={range} freshness={freshness} />);

    expect(screen.queryByText("May be incomplete")).toBeNull();
  });
});
