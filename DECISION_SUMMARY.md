# Decision summary

## Who it's for

A marketer deciding which campaigns are worth their budget. The dashboard answers one question: *which campaigns turn calls into revenue, and at what cost?*

## What I learned from the data

- **Outcomes arrive late.** About 8% of answered calls (89 bookings) got their outcome 24 to 72 hours after the call, so the last ~3 days understate bookings and revenue.
- **Calls are written more than once.** 5,411 rows make 5,000 calls, and 13 calls arrive out of order, so the newest `updated_at` must win, not the last row.
- **Timestamps are UTC but offices span 5 time zones**, so days must follow each office's local time.
- **144 calls have no campaign.** They can't be dropped without breaking totals.
- **There is no actual ad spend**, only a daily budget per campaign (see campaigns.csv).
- **Repeat callers drive bookings.** 697 of ~1,200 bookings came from a repeat caller, so "new callers" matters next to raw call counts.

## Scope and why

One main page (KPIs, two charts, missed calls, sortable campaign table) with date and office filters, plus campaign and call detail pages. I chose depth on one user's question over a broad generic dashboard. The core views work without any model.

Left out on purpose: auth and multi-tenancy (out of scope), scale work, and AI features. See [DECISIONS.md](DECISIONS.md) for the design choices and the alternatives I rejected.

## Trade-offs

- **Spend is an estimate** (daily budget × covered days). It overstates cost, so it is always labelled "Budgeted spend (est.)".
- **Each call counts toward the campaign that took it**, not the caller's first campaign. This shows what drove each call but can credit repeat callers to several campaigns.
- **Late outcomes are flagged, not hidden.** Warning chips and shaded days tell the user when recent numbers may be incomplete.
- **Data comes from a CSV import.** There is no live feed yet.

## Next steps

1. Get actual spend (ad-platform APIs or manual entry) to replace the estimate.
2. Receive calls from a live feed instead of a CSV (design in [TECHNICAL.md](TECHNICAL.md)).
3. Add AI features on the same data endpoints, so numbers always match the table.

## AI spend

_To be added._
