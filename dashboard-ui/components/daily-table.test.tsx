import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Day } from "../lib/daily";
import { DailyTable } from "./daily-table";

afterEach(cleanup);

const day = (date: string, over: Partial<Day> = {}): Day => ({
  date,
  calls: 1,
  booked: 1,
  revenue_cents: 10000,
  spend_cents: 5000,
  ...over,
});

function bodyRows() {
  const body = screen.getAllByRole("rowgroup")[1];
  return within(body).getAllByRole("row");
}

function cellTexts(row: HTMLElement) {
  return within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent);
}

describe("DailyTable", () => {
  it("renders rows in date order", () => {
    render(
      <DailyTable
        days={[day("2025-10-03"), day("2025-10-01"), day("2025-10-02")]}
      />,
    );
    const dates = bodyRows().map(
      (r) => within(r).getByRole("rowheader").textContent,
    );
    expect(dates).toEqual(["2025-10-01", "2025-10-02", "2025-10-03"]);
  });

  it("shows — for null spend, including the totals when all are null", () => {
    render(
      <DailyTable
        days={[
          day("2025-10-01", { spend_cents: null }),
          day("2025-10-02", { spend_cents: null }),
        ]}
      />,
    );
    for (const r of bodyRows()) expect(cellTexts(r)[3]).toBe("—");
    expect(cellTexts(screen.getByTestId("totals-row"))[3]).toBe("—");
  });

  it("shows zero-filled days as zeros", () => {
    render(
      <DailyTable
        days={[
          day("2025-10-01", {
            calls: 0,
            booked: 0,
            revenue_cents: 0,
            spend_cents: 0,
          }),
        ]}
      />,
    );
    expect(cellTexts(bodyRows()[0])).toEqual(["0", "0", "$0", "$0"]);
  });

  it("totals row equals the sum of the rows", () => {
    render(
      <DailyTable
        days={[
          day("2025-10-01", { calls: 2, booked: 1, revenue_cents: 10000, spend_cents: 5000 }),
          day("2025-10-02", { calls: 3, booked: 2, revenue_cents: 20000, spend_cents: null }),
          day("2025-10-03", { calls: 5, booked: 0, revenue_cents: 5000, spend_cents: 2500 }),
        ]}
      />,
    );
    expect(cellTexts(screen.getByTestId("totals-row"))).toEqual([
      "10",
      "3",
      "$350",
      "$75",
    ]);
  });

  it("shows the location label only when a location is selected", () => {
    const { rerender } = render(<DailyTable days={[day("2025-10-01")]} />);
    expect(
      screen.getByRole("columnheader", { name: "Budgeted spend (est.)" }),
    ).toBeTruthy();
    expect(screen.queryByText(/allocated by call share/)).toBeNull();
    rerender(<DailyTable days={[day("2025-10-01")]} locationSelected />);
    expect(screen.getByText(/allocated by call share/)).toBeTruthy();
  });
});
