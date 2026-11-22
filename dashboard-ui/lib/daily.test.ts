import { describe, expect, it } from "vitest";
import { hasActivity, sumDays, toChartData, type Day } from "./daily";

const day = (over: Partial<Day> = {}): Day => ({
  date: "2026-09-01",
  calls: 0,
  booked: 0,
  revenue_cents: 0,
  spend_cents: 0,
  ...over,
});

describe("sumDays", () => {
  it("returns zeros and null spend for no days", () => {
    expect(sumDays([])).toEqual({
      calls: 0,
      booked: 0,
      revenue_cents: 0,
      spend_cents: null,
    });
  });

  it("sums every field", () => {
    const t = sumDays([
      day({ calls: 2, booked: 1, revenue_cents: 500, spend_cents: 100 }),
      day({ calls: 3, booked: 0, revenue_cents: 250, spend_cents: 101 }),
    ]);
    expect(t).toEqual({ calls: 5, booked: 1, revenue_cents: 750, spend_cents: 201 });
  });

  it("keeps spend null when all days are null", () => {
    expect(sumDays([day({ spend_cents: null }), day({ spend_cents: null })]).spend_cents).toBeNull();
  });

  it("ignores null days when others have spend", () => {
    expect(sumDays([day({ spend_cents: null }), day({ spend_cents: 40 })]).spend_cents).toBe(40);
  });
});

describe("hasActivity", () => {
  it("is false for empty or zero-call days, even with spend", () => {
    expect(hasActivity([])).toBe(false);
    expect(hasActivity([day({ spend_cents: 500 })])).toBe(false);
  });
  it("is true when any day has calls", () => {
    expect(hasActivity([day(), day({ calls: 1 })])).toBe(true);
  });
});

describe("toChartData", () => {
  it("converts cents to dollars and keeps null spend", () => {
    expect(
      toChartData([
        day({ date: "2026-09-01", revenue_cents: 29900, spend_cents: 4000 }),
        day({ date: "2026-09-02", revenue_cents: 0, spend_cents: null }),
      ]),
    ).toEqual([
      { date: "2026-09-01", revenue_dollars: 299, spend_dollars: 40 },
      { date: "2026-09-02", revenue_dollars: 0, spend_dollars: null },
    ]);
  });
});
