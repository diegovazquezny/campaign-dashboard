// Tooltip copy, one entry per metric or surface. Source of truth for review:
// plans/tooltips/tooltips.md. Metric definitions follow base-plan §7. Each PR
// adds the entries it uses (T2: tables, T3: charts and call detail cards).
export const HELP = {
  calls:
    "Every call in the date range and office, including calls not tied to a campaign.",
  booked: "Calls whose outcome was a booked appointment.",
  bookingRate: "Booked ÷ calls.",
  revenue: "Total revenue recorded on calls in the range.",
  revenueOverSpend:
    "Revenue from paid campaigns ÷ their estimated spend. Campaigns with no budget, and calls with no campaign, are left out.",
  missedCalls:
    "Share of calls nobody answered. Missed rang out; voicemail means the caller left a message. Missed + voicemail = all unanswered calls.",
  // Same text for the calls and revenue views of each chart.
  byDay:
    "Daily totals, including calls with no campaign. Shaded days may still be missing outcomes, which arrive up to 3 days late.",
  byChannel:
    "Grouped by marketing channel. Calls with no campaign are split by the channel they came in on.",
  revenueVsSpend:
    "This campaign's daily revenue against its estimated daily spend.",
  aboutCall:
    "What happened on the call: times in the office's time zone, duration, whether it was answered, outcome, revenue, agent and tracking number.",
  callerData:
    'Whether this was the caller\'s first call and how many calls they have made. "First" counts from Sep 1, and phone numbers are never shown.',
  marketingData: "The campaign, channel and office the call came through.",
} as const;
