import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CampaignRow } from "./api-types";
import { aggregateChannels, CHANNELS } from "./channels";

function row(over: Partial<CampaignRow>): CampaignRow {
  return {
    campaign_id: "c",
    name: "C",
    channel: "social",
    calls: 0,
    unique_callers: 0,
    new_callers: 0,
    booked: 0,
    booking_rate: null,
    unanswered_rate: null,
    awaiting_outcome: 0,
    revenue_cents: 0,
    spend_cents: null,
    revenue_per_spend: null,
    spend_per_booking_cents: null,
    ...over,
  };
}

describe("aggregateChannels", () => {
  const rows = [
    row({
      campaign_id: "a",
      channel: "paid_search",
      calls: 4,
      revenue_cents: 1000,
    }),
    row({
      campaign_id: "b",
      channel: "paid_search",
      calls: 2,
      revenue_cents: 500,
    }),
    row({ campaign_id: "c", channel: "social", calls: 0 }),
    row({
      campaign_id: null,
      name: "No campaign",
      channel: "",
      calls: 5,
      revenue_cents: 900,
      channel_breakdown: [
        { channel: "organic", calls: 3, booked: 1, revenue_cents: 700 },
        { channel: "paid_search", calls: 2, booked: 0, revenue_cents: 200 },
      ],
    }),
  ];

  it("sums campaign rows and the No campaign breakdown per channel", () => {
    const result = aggregateChannels(rows);
    expect(result.map((c) => [c.channel, c.calls, c.revenue_cents])).toEqual([
      ["paid_search", 8, 1700],
      ["organic", 3, 700],
    ]);
  });

  it("sums to the totals row", () => {
    const result = aggregateChannels(rows);
    expect(result.reduce((s, c) => s + c.calls, 0)).toBe(11);
    expect(result.reduce((s, c) => s + c.revenue_cents, 0)).toBe(2400);
  });

  it("keeps an unknown channel with a neutral colour, after known ones", () => {
    const result = aggregateChannels([
      row({ channel: "podcast", calls: 1 }),
      row({ channel: "direct", calls: 1 }),
    ]);
    expect(result.map((c) => c.channel)).toEqual(["direct", "podcast"]);
    expect(result[1].color).toBe("var(--muted)");
  });

  it("returns nothing for no calls", () => {
    expect(aggregateChannels([])).toEqual([]);
  });
});

describe("CHANNELS colours", () => {
  it.each(["light", "dark"])("defines every token in the %s theme", (theme) => {
    const css = readFileSync(
      join(__dirname, `../app/styles/theme-${theme}.css`),
      "utf8",
    );
    for (const { color } of CHANNELS) {
      const name = color.slice(4, -1); // var(--x) -> --x
      expect(css).toContain(`${name}:`);
    }
  });
});
