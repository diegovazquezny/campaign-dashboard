// Tooltip copy, one entry per metric or surface. Source of truth for review:
// plans/tooltips/tooltips.md. Metric definitions follow base-plan §7.
export const HELP = {
  // Figures shared by the KPI cards and the tables
  calls:
    "Every call in the date range and office, including calls not tied to a campaign.",
  booked: "Calls whose outcome was a booked appointment.",
  bookingRate: "Booked ÷ calls.",
  revenue: "Total revenue recorded on calls in the range.",
  revenueOverSpend:
    "Revenue from paid campaigns ÷ their estimated spend. Campaigns with no budget, and calls with no campaign, are left out.",
  missedCalls:
    "Share of calls nobody answered. Missed rang out; voicemail means the caller left a message. Missed + voicemail = all unanswered calls.",

  // Campaign table
  campaign:
    'Click a name for its daily chart and calls. "No campaign" means calls not tied to any campaign.',
  channel: "The marketing channel the campaign runs on.",
  uniqueCallers:
    "Distinct phone numbers. The totals row counts each caller once, even if they called several campaigns.",
  newCallers:
    "Calls from a number never seen before. Data starts Sep 1, so earlier callers can look new.",
  unansweredRate: "Share of calls not answered (missed or voicemail).",
  awaitingOutcome: "Answered calls with no outcome recorded yet.",
  spend:
    "Daily budget × days with data in the range. Assumes the whole budget was spent, so it can overstate cost. Blank for campaigns with no budget.",
  spendByLocation:
    "Same estimate, split by this office's share of the campaign's calls.",
  spendPerBooking: "Estimated spend ÷ bookings.",

  // Daily table
  date: "The calendar day in each office's local time.",

  // Calls table
  time: "Call start time in the office's time zone.",
  outcome:
    'Booked, qualified lead, not qualified, missed, voicemail, or "Awaiting outcome".',
  duration: "Length of the call.",
  agent: "The agent ID that took the call.",

  // Charts
  callsByDay:
    "Daily totals, including calls with no campaign. Shaded days may still be missing outcomes, which arrive up to 3 days late.",
  revenueByDay:
    "Daily totals, including calls with no campaign. Shaded days may still be missing outcomes, which arrive up to 3 days late.",
  callsByChannel:
    "Grouped by marketing channel. Calls with no campaign are split by the channel they came in on.",
  revenueByChannel:
    "Grouped by marketing channel. Calls with no campaign are split by the channel they came in on.",
  revenueVsSpend:
    "This campaign's daily revenue against its estimated daily spend.",

  // Call detail cards
  aboutCall:
    "What happened on the call: times in the office's time zone, duration, whether it was answered, outcome, revenue, agent and tracking number.",
  callerData:
    'Whether this was the caller\'s first call and how many calls they have made. "First" counts from Sep 1, and phone numbers are never shown.',
  marketingData: "The campaign, channel and office the call came through.",
} as const;
