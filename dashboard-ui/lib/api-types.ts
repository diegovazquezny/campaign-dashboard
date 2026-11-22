// Mirrors PLAN.md §8. Dates are YYYY-MM-DD; money is integer cents except
// spend_per_booking_cents, which is a fractional float.

export type ApiError = { error: { code: string; message: string } };

export type Meta = {
  data_coverage: { from: string; to: string } | null;
  freshness: {
    latest_update_at: string;
    outcomes_may_be_incomplete_from: string;
  } | null;
  locations: { id: string; name: string; timezone: string }[];
  campaigns: { id: string; name: string; channel: string }[];
};

export type ChannelBreakdown = {
  channel: string;
  calls: number;
  booked: number;
  revenue_cents: number;
};

type MetricFields = {
  calls: number | null;
  unique_callers: number | null;
  new_callers: number | null;
  booked: number | null;
  booking_rate: number | null;
  unanswered_rate: number | null;
  awaiting_outcome: number | null;
  revenue_cents: number | null;
  spend_cents: number | null;
  revenue_per_spend: number | null;
  spend_per_booking_cents: number | null;
};

export type CampaignRow = MetricFields & {
  campaign_id: string | null;
  name: string;
  channel: string;
  // Only on the "No campaign" row (campaign_id: null).
  channel_breakdown?: ChannelBreakdown[];
};

export type Totals = Omit<
  MetricFields,
  "revenue_per_spend" | "spend_per_booking_cents"
> & {
  // missed + voicemail = unanswered (rate × calls).
  missed: number | null;
  voicemail: number | null;
  // Spend ratios over paid campaigns only (§7).
  paid: {
    revenue_cents: number | null;
    booked: number | null;
    spend_cents: number | null;
    revenue_per_spend: number | null;
    spend_per_booking_cents: number | null;
  };
};

export type CampaignMetricsResponse = {
  range: { from: string; to: string };
  rows: CampaignRow[];
  totals: Totals;
};

export type DailyResponse = {
  campaign: { id: string; name: string };
  days: {
    date: string;
    calls: number;
    booked: number;
    revenue_cents: number;
    spend_cents: number | null;
  }[];
};

export type AccountDailyResponse = {
  range: { from: string; to: string };
  days: {
    date: string;
    calls: number;
    booked: number;
    revenue_cents: number;
  }[];
};
