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
} as const;
