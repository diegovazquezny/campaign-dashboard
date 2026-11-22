# Decisions

What this dashboard does, the choices behind it, and where it falls short. Written for someone who uses the numbers rather than builds them. Full detail and the reasoning for each choice are in [plans/PLAN.md](plans/PLAN.md) (section 4 for the decisions, section 7 for how each metric is calculated).

The question the dashboard answers: *which campaigns turn calls into revenue, and at what cost?*

## Read this first: spend is an estimate

The data has no actual ad spend, only each campaign's daily budget. So **spend is estimated as daily budget x the number of days in the selected range that the data covers**. Screens label it "Budgeted spend (est.)".

- It assumes every campaign spends its full budget every day. Real spend is usually lower, so **cost is overstated and revenue per dollar of spend is understated**.
- The first covered day (Aug 31) is only partly covered by calls but is charged a full day of budget. That adds about 1.7% over 60 days. It was accepted and documented rather than dropping the day.
- Days outside the data are not charged, so a range that starts before the data does not pay for months with no calls.
- Campaigns with a $0 budget, and the "No campaign" row, have no spend and show "-" rather than a made-up number.
- If actual spend becomes available, it can replace the estimate in one place.

**Allocated by call share.** Budget belongs to a campaign, not an office. When you filter to one office, that office is given a share of the campaign's spend equal to its share of the campaign's calls in the range. Spend per call is then the same in every office, so differences in revenue per dollar between offices reflect how well each office converts calls. A campaign with no calls at that office has no share, so its spend is blank. Office figures can differ from the campaign total by under a cent per office.

## What we decided

| # | Decision | Why, in plain terms |
|---|---|---|
| D1 | The import keeps only the latest version of each call (by its `updated_at` time), with no history. | The CSVs are a fixed snapshot, so nobody would read the history. Re-running the import is the recovery. |
| D2 | Each call counts toward the campaign that took it. "New callers" is worked out on demand: a call is new if the same caller had no earlier call. | This is the usual call-tracking convention. New callers shows campaigns that mostly re-reach people another campaign already got (635 bookings came from callers first reached via another campaign). Nothing extra is stored. "First" means first since the data starts on Sep 1, so earlier callers look new. |
| D3 | Spend is estimated from budget (see above). | Budget is the only proxy the data offers, and "at what cost" is half the question. |
| D4 | Days are counted in each office's own timezone. | "Tuesday" should mean Tuesday at the office. |
| D5 | Booking rate is booked calls divided by all calls. Unanswered rate and the count of calls still awaiting an outcome are shown too. | It is consistent with revenue and spend per booking, and rankings are the same as booked divided by calls with a recorded outcome in this data. |
| D6 | One screen, two data endpoints, with the math done in the database. | A thin, focused slice. |
| D7 | One command (Docker Compose) runs everything. | A reviewer needs only Docker. |
| D8 | No AI features in v1. | Focus on the core; the dashboard has to work without a model anyway. |
| D9 | The default date range is the previous calendar quarter, with presets and a "Data covers ..." badge when the range extends beyond the data. | It matches how marketers report. Because the data ends in October, the default view shows the badge. |
| D10 | Money is stored in whole cents, and fixed lists (such as outcomes) are enforced by the database. | Sums stay exact, and the lists are easy to extend. |
| D11 | Office filter spend is allocated by call share (see above). | Dividing one office's revenue by the whole campaign's spend would understate return. |
| D12 | The "No campaign" row is always shown, below the ranked campaigns and above the totals, whatever the sort. It is muted, has no spend, and its tooltip breaks calls down by channel. Totals include its calls and revenue. | It is a catch-all bucket, not a campaign you can fund, so it should not rank against them. Keeping it visible makes the columns add up and exposes the tracking gap (for example 12 paid search calls credited to no campaign). Blank values sort last in both directions. The totals' revenue-per-spend and spend-per-booking use paid campaigns only (labelled so), because revenue with no spend behind it would inflate the return. |

## Left out on purpose

- **Authentication and multi-tenancy.** Out of scope for this brief.
- **A first-touch toggle** (crediting a caller's first campaign instead of each call). Per-call is the default. A toggle could be added later using the same on-demand approach (D2).
- **A chatbot / AI features.** None in v1 (D8). If added, it would call the same two data endpoints so its numbers always match the table.
- **Cloud deployment, polished UI and scale.** Out of scope for this brief.

## Open questions

1. When deployed, how will the API receive call data instead of reading a CSV? A recurring feed would bring back a run log (counts, rejections and status per run) and possibly version history (see D1).
2. Where would actual spend come from (for example ad-platform APIs or manual entry), and at what granularity (daily per campaign)?

## AI spend

**Total recorded AI spend: $21.82.** This is the sum of the rows in [AI_COST_LOG.md](AI_COST_LOG.md). Costs for other sessions are not recoverable from the repo and are logged there as unknown, so the true total is higher.
