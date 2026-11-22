import type { CampaignRow } from "./api-types";

// Marketing channels (base plan §5) with the theme token that colours each.
export const CHANNELS = [
  {
    key: "paid_search",
    label: "Paid search",
    color: "var(--channel-paid-search)",
  },
  { key: "social", label: "Social", color: "var(--channel-social)" },
  { key: "display", label: "Display", color: "var(--channel-display)" },
  { key: "organic", label: "Organic", color: "var(--channel-organic)" },
  { key: "direct", label: "Direct", color: "var(--channel-direct)" },
  { key: "referral", label: "Referral", color: "var(--channel-referral)" },
] as const;

export type ChannelTotal = {
  channel: string;
  label: string;
  color: string;
  calls: number;
  revenue_cents: number;
};

// Sums campaign rows by channel; the "No campaign" row contributes through its
// channel_breakdown. Channel sums therefore equal the totals row. Channels
// with no calls are dropped; order is the fixed channel order above.
export function aggregateChannels(rows: CampaignRow[]): ChannelTotal[] {
  const sums = new Map<string, { calls: number; revenue_cents: number }>();
  const add = (channel: string, calls: number, revenue: number) => {
    const s = sums.get(channel) ?? { calls: 0, revenue_cents: 0 };
    s.calls += calls;
    s.revenue_cents += revenue;
    sums.set(channel, s);
  };
  for (const row of rows) {
    if (row.channel_breakdown) {
      for (const b of row.channel_breakdown)
        add(b.channel, b.calls, b.revenue_cents);
    } else {
      add(row.channel, row.calls ?? 0, row.revenue_cents ?? 0);
    }
  }
  const known = CHANNELS.map((c) => c.key as string);
  const unknown = [...sums.keys()].filter((k) => !known.includes(k)).sort();
  const order = [...known, ...unknown];
  return order
    .filter((key) => (sums.get(key)?.calls ?? 0) > 0)
    .map((key) => {
      const meta = CHANNELS.find((c) => c.key === key);
      return {
        channel: key,
        label: meta?.label ?? key,
        color: meta?.color ?? "var(--muted)",
        ...sums.get(key)!,
      };
    });
}
