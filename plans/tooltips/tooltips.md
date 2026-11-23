# Tooltips — Task Plan

**Goal:** every widget card and every table column header gets a small circled-i (ⓘ) icon. Hovering, focusing or tapping it shows a short explanation of what the figure is or how it is calculated. Delivered as four small, independently mergeable PRs.

**Done when:** every task below is merged, `npm test`, `npm run lint`, `npx next typegen && npx tsc --noEmit` and `npm run format:check` pass, and the icons were checked on the overview, campaign, `/campaigns/none` and call detail pages in both themes, at desktop and phone widths.

## Status

In progress. T1 merged (PR #87, which also carried these plan docs, so the milestone is four PRs in total). T2 in review. T3 is in parallel with T2.

## PR rules

Same as the UI improvements plan ([../ui-improvements/ui-improvements.md](../ui-improvements/ui-improvements.md)):

- One thing per PR, individually mergeable and testable, under 500 changed lines. Every PR leaves the app runnable and states how to verify it.
- Branch from `main`. Leave `dashboard-ui/AGENTS.md` out of commits (`next dev` edits it; `git checkout` it first).
- Tailwind utilities only (no CSS Modules, no new global CSS), theme tokens only, check both themes ([../ui-improvements/PLAN.md](../ui-improvements/PLAN.md) §4 "Rules for U1–U3 components").
- No new dependency.
- Metric definitions are base-plan §7 ([../PLAN.md](../PLAN.md)); tooltip text must agree with them.

## Conventions

- **One component:** `dashboard-ui/components/info-tip.tsx`, `<InfoTip label="Calls" text="…" />`. A `<button type="button">` with an inline SVG ⓘ (`currentColor`, about 14px, `text-muted hover:text-fg`) inside a hit area of at least 24px (40px on phones, like the theme button). `aria-label` is `About {label}`; `aria-describedby` points at the tooltip text.
- **The text is always in the DOM** (`role="tooltip"`, `display: none` while closed). `aria-describedby` still resolves to it, tests find it with `getByText`, and screen readers do not read it as part of the label (an `sr-only` span would be).
- **Opens** on pointer enter, focus, and click/tap (toggle, for phones). **Closes** on blur, Esc and outside press, and 150 ms after the mouse leaves both the icon and the bubble (so the bubble can be hovered and its text selected). On scroll and resize it **repositions** instead of closing (focusing an off-screen icon scrolls it into view, which would otherwise close the tooltip at once).
- **Positioning:** `position: fixed` from the icon's `getBoundingClientRect()`. Above the icon, flipped below when there is no room, clamped horizontally to the viewport. Fixed is required because `TableScroll` (`components/table-scroll.tsx`) scrolls horizontally and would clip an absolutely positioned popup.
- **Styling:** `bg-card border-border text-fg shadow-card rounded-card`, `max-w-64`, normal-case 13px text (it must not inherit a header's uppercase and tracking), `z-50` (above the sticky header and sticky first column).
- **In sortable headers** the icon is a sibling of the sort `<button>`, never inside it, and clicking it must not sort. It always trails the label (an icon in front of a right-aligned label reads as belonging to the column on its left), and the cell keeps its `thLeft`/`thRight` alignment. Non-sortable headers (daily and calls tables) use `components/th-label.tsx`.
- **Copy lives in one module:** `dashboard-ui/lib/help-text.ts` exports `HELP`, keyed by metric or surface (`HELP.calls`, `HELP.spend`, `HELP.spendByLocation`, …). A metric shown in several tables has one definition. Each PR adds the entries it uses, taking the wording from the table below.
- The two existing native `title=` hovers (New callers header, No campaign row) are replaced, not kept alongside.

## Tooltip copy

Source of truth for review. Definitions come from base-plan §7 and the UI improvements plan.

| Where | Text |
|---|---|
| Calls (KPI, campaign, daily) | Every call in the date range and office, including calls not tied to a campaign. |
| Booked (KPI, campaign, daily) | Calls whose outcome was a booked appointment. |
| Booking rate | Booked ÷ calls. |
| Revenue (KPI, campaign, daily, calls) | Total revenue recorded on calls in the range. |
| Revenue ÷ spend (KPI, campaign) | Revenue from paid campaigns ÷ their estimated spend. Campaigns with no budget, and calls with no campaign, are left out. |
| Missed calls card | Share of calls nobody answered. Missed rang out; voicemail means the caller left a message. Missed + voicemail = all unanswered calls. |
| Campaign (column) | Click a name for its daily chart and calls. "No campaign" means calls not tied to any campaign. |
| No campaign (row) | The calls-by-channel breakdown (current `title=` text). |
| Channel (column) | The marketing channel the campaign runs on. |
| Unique callers | Distinct phone numbers. The totals row counts each caller once, even if they called several campaigns. |
| New callers | Calls from a number never seen before. Data starts Sep 1, so earlier callers can look new. |
| Unanswered rate | Share of calls not answered (missed or voicemail). |
| Awaiting outcome | Answered calls with no outcome recorded yet. |
| Budgeted spend (est.) | Daily budget × days with data in the range. Assumes the whole budget was spent, so it can overstate cost. Blank for campaigns with no budget. |
| Spend, with an office selected | Same estimate, split by this office's share of the campaign's calls. |
| Spend per booking | Estimated spend ÷ bookings. |
| Date (daily table) | The calendar day in each office's local time. |
| Time (calls table) | Call start time in the office's time zone. |
| Outcome (calls table) | Booked, qualified lead, not qualified, missed, voicemail, or "Awaiting outcome". |
| Duration (calls table) | Length of the call. |
| Agent (calls table) | The agent ID that took the call. |
| Calls / Revenue by day | Daily totals, including calls with no campaign. Shaded days may still be missing outcomes, which arrive up to 3 days late. |
| Calls / Revenue by channel | Grouped by marketing channel. Calls with no campaign are split by the channel they came in on. |
| Revenue vs spend by day | This campaign's daily revenue against its estimated daily spend. |
| About this call | What happened on the call: times in the office's time zone, duration, whether it was answered, outcome, revenue, agent and tracking number. |
| Caller data | Whether this was the caller's first call and how many calls they have made. "First" counts from Sep 1, and phone numbers are never shown. |
| Marketing data | The campaign, channel and office the call came through. |

## Shared files (conflict hot spots)

| File | Tasks |
|---|---|
| `dashboard-ui/lib/help-text.ts` | T1 creates it with the card entries; T2 and T3 each append their own (a trivial textual conflict, whichever merges second rebases) |
| `dashboard-ui/components/campaign-table.tsx` | T2 only |
| `dashboard-ui/components/overview-chart.tsx`, `channel-chart.tsx`, `daily-chart.tsx`, `call-details.tsx` | T3 only |

T2 and T3 touch different files, so they can run in parallel.

## Tasks

### T1 — `InfoTip`, help text, KPI and missed-calls cards
**Status:** merged (PR #87) · **Depends on:** nothing
- `components/info-tip.tsx` per Conventions, and `lib/help-text.ts` with the entries the cards use.
- `components/kpi-cards.tsx`: an icon next to each of the five `<dt>` labels. `components/missed-calls-card.tsx`: an icon next to the `<h2>`.
- This PR also carries the plan docs (`plans/tooltips/`, the PLAN.md status row).
- **Tests:** `info-tip.test.tsx` (opens on hover, focus and tap; tap toggles; Esc and outside click close; the bubble can be hovered; closed text is `display: none`; `aria-label` and `aria-describedby` wiring; stays inside the viewport near the edges), plus updates to `kpi-cards.test.tsx` and `missed-calls-card.test.tsx`.
- **Acceptance:** each card shows an icon and its text on hover, keyboard focus and tap; existing card tests still pass; both themes checked.

### T2 — Table column headers
**Status:** in review · **Depends on:** T1
- `components/campaign-table.tsx`: an icon on all 13 headers. Remove the New callers `title=` and the `Tip` helper. Replace the No campaign row's `title=` with an `InfoTip` next to the "No campaign" link (channel breakdown text). The spend header uses `HELP.spendByLocation` when `locationSelected`.
- `components/daily-table.tsx` (5 headers) and `components/calls-section.tsx` (5 headers).
- Adds the table entries to `lib/help-text.ts`.
- **Tests:** clicking an icon does not change the sort; each table's headers have their tip; the existing campaign-table tests that use `tip-new-callers` and `tip-no-campaign` are updated.
- **Acceptance:** every header in the three tables has an icon; sorting, sticky first column and horizontal scroll still work; tooltips are not clipped inside `TableScroll`; both themes checked.

### T3 — Chart and call detail cards
**Status:** in review · **Depends on:** T1 (parallel with T2)
- Adds the chart and call-detail entries to `lib/help-text.ts`.
- Icon in the `<figcaption>` of `overview-chart.tsx` (text follows the calls/revenue toggle), `channel-chart.tsx` (same) and `daily-chart.tsx`.
- `Card` in `components/call-details.tsx` takes an optional `help` prop rendered next to its `<h2>`; the three cards (About this call, Caller data, Marketing data) pass it.
- **Tests:** each chart's icon and text (and that it changes with the toggle); each call detail card's icon.
- **Acceptance:** every chart and call-detail card has an icon; the toggles still work; both themes checked.

### T4 — Exit check and docs
**Status:** not started · **Depends on:** T2, T3
- Walk the overview, campaign, `/campaigns/none` and call pages in both themes at desktop and phone widths (tap). Check tooltips near the right edge and inside the scrolled campaign table. Small fixes only; split anything over 500 lines.
- Record the results under "Exit check result" below, and update statuses in this file and in PLAN.md.
- **Exit check result:** not yet walked.

## Dependencies

Direct dependencies only; they match the diagram.

- T1 → T2, T3
- T2, T3 → T4
- Start immediately: T1. Then in parallel: T2, T3.
- Longest chain (3 PRs): T1 → T2 → T4 (or T1 → T3 → T4).

See [tooltips-dag.drawio](tooltips-dag.drawio).
