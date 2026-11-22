import type { DailyResponse } from "./api-types";

export type Day = DailyResponse["days"][number];

export type DayTotals = {
  calls: number;
  booked: number;
  revenue_cents: number;
  spend_cents: number | null;
};

/** Sum the daily rows. Spend is null only when every day's spend is null. */
export function sumDays(days: Day[]): DayTotals {
  let spend: number | null = null;
  const totals = { calls: 0, booked: 0, revenue_cents: 0 };
  for (const d of days) {
    totals.calls += d.calls;
    totals.booked += d.booked;
    totals.revenue_cents += d.revenue_cents;
    if (d.spend_cents !== null) spend = (spend ?? 0) + d.spend_cents;
  }
  return { ...totals, spend_cents: spend };
}

/** React key for the daily table: changes with the range or office, so paging resets. */
export function dailyTableKey(
  range: { from?: string; to?: string },
  location: string | undefined,
): string {
  return `${range.from ?? ""}|${range.to ?? ""}|${location ?? ""}`;
}

/** True when any day has at least one call. */
export function hasActivity(days: Day[]): boolean {
  return days.some((d) => d.calls > 0);
}

export type ChartPoint = {
  date: string;
  revenue_dollars: number;
  spend_dollars: number | null;
};

/** Chart rows in dollars. A null spend stays null so the chart shows a gap. */
export function toChartData(days: Day[]): ChartPoint[] {
  return days.map((d) => ({
    date: d.date,
    revenue_dollars: d.revenue_cents / 100,
    spend_dollars: d.spend_cents === null ? null : d.spend_cents / 100,
  }));
}
