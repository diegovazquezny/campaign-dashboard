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

// GET /api/calls (U3a). `outcome: null` with `answered: true` means awaiting outcome.
export type CallRow = {
  call_id: string;
  started_at: string;
  ended_at: string;
  local_date: string;
  timezone: string;
  duration_seconds: number;
  answered: boolean;
  outcome:
    | "booked"
    | "qualified_lead"
    | "not_qualified"
    | "missed"
    | "voicemail"
    | null;
  revenue_cents: number | null;
  agent_id: string | null;
  tracking_number: string;
  campaign: { id: string; name: string } | null;
  channel: string;
  location: { id: string; name: string };
};

export type CallsResponse = {
  page: number;
  page_size: number;
  total: number;
  calls: CallRow[];
};

// GET /api/calls/:id (U3a): the row plus facts about the caller. Never carries the caller hash.
export type CallDetail = CallRow & {
  is_first_call: boolean;
  caller_call_count: number;
  /** `YYYY-MM-DD`: the local date of the caller's earliest call. */
  caller_first_seen: string;
};
