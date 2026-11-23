"use client";

import Link from "next/link";
import { useState } from "react";
import type { CampaignRow, Totals } from "../lib/api-types";
import { detailHref } from "../lib/filters";
import {
  footLabel,
  footNum,
  labelCell,
  numCell,
  rowHover,
  sortButton,
  stickyCell,
  stickyHead,
  table,
  thLeft,
  thRight,
} from "./table-styles";
import { HELP, spendHeader } from "../lib/help-text";
import { InfoTip } from "./info-tip";
import { TableScroll } from "./table-scroll";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRatio,
} from "../lib/format";
import {
  isTextSortKey,
  sortRows,
  type SortDirection,
  type SortKey,
} from "../lib/sort-rows";

type Props = {
  rows: CampaignRow[];
  totals: Totals;
  locationSelected?: boolean;
  /** Query string (no "?") carried to each campaign's detail page. */
  detailQuery?: string;
};

type Column = {
  key: SortKey;
  label: string;
  help: string;
  cell: (row: CampaignRow) => string;
};

const COLUMNS: Column[] = [
  { key: "name", label: "Campaign", help: HELP.campaign, cell: (r) => r.name },
  {
    key: "channel",
    label: "Channel",
    help: HELP.channel,
    cell: (r) => r.channel,
  },
  {
    key: "calls",
    label: "Calls",
    help: HELP.callsPerCampaign,
    cell: (r) => formatCount(r.calls),
  },
  {
    key: "unique_callers",
    label: "Unique callers",
    help: HELP.uniqueCallers,
    cell: (r) => formatCount(r.unique_callers),
  },
  {
    key: "new_callers",
    label: "New callers",
    help: HELP.newCallers,
    cell: (r) => formatCount(r.new_callers),
  },
  {
    key: "booked",
    label: "Booked",
    help: HELP.booked,
    cell: (r) => formatCount(r.booked),
  },
  {
    key: "booking_rate",
    label: "Booking rate",
    help: HELP.bookingRate,
    cell: (r) => formatPercent(r.booking_rate),
  },
  {
    key: "unanswered_rate",
    label: "Unanswered rate",
    help: HELP.unansweredRate,
    cell: (r) => formatPercent(r.unanswered_rate),
  },
  {
    key: "awaiting_outcome",
    label: "Awaiting outcome",
    help: HELP.awaitingOutcome,
    cell: (r) => formatCount(r.awaiting_outcome),
  },
  {
    key: "revenue_cents",
    label: "Revenue",
    help: HELP.revenuePerCampaign,
    cell: (r) => formatMoney(r.revenue_cents),
  },
  {
    key: "spend_cents",
    ...spendHeader(),
    cell: (r) => formatMoney(r.spend_cents),
  },
  {
    key: "revenue_per_spend",
    label: "Revenue ÷ spend",
    help: HELP.revenueOverSpend,
    cell: (r) => formatRatio(r.revenue_per_spend),
  },
  {
    key: "spend_per_booking_cents",
    label: "Spend per booking",
    help: HELP.spendPerBooking,
    cell: (r) => formatMoney(r.spend_per_booking_cents),
  },
];

// Campaign and channel are labels (left-aligned); every other column is a number.
const isLabelKey = (key: SortKey) => key === "name" || key === "channel";

function cellClass(key: SortKey): string {
  if (key === "name") return `${labelCell} ${stickyCell}`;
  if (key === "channel") return `${labelCell} text-muted`;
  return numCell;
}

function breakdownText(row: CampaignRow): string | null {
  if (!row.channel_breakdown?.length) return null;
  return (
    "Calls by channel: " +
    row.channel_breakdown
      .map((b) => `${b.channel} ${formatCount(b.calls)}`)
      .join(", ")
  );
}

export function CampaignTable({
  rows,
  totals,
  locationSelected,
  detailQuery = "",
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "revenue_cents",
    direction: "desc",
  });
  const { ranked, noCampaign } = sortRows(rows, sort.key, sort.direction);

  function onSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === "asc" ? "desc" : "asc" }
        : { key, direction: isTextSortKey(key) ? "asc" : "desc" },
    );
  }

  const noCampaignTip = noCampaign ? breakdownText(noCampaign) : null;
  const paid = totals.paid;

  return (
    <TableScroll label="Campaigns">
      <table className={table}>
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const { label, help } =
                c.key === "spend_cents" ? spendHeader(locationSelected) : c;
              const active = sort.key === c.key;
              // The icon sits beside the sort button, not inside it, so
              // clicking it never sorts.
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`${isLabelKey(c.key) ? thLeft : thRight} ${c.key === "name" ? stickyHead : ""}`}
                  aria-sort={
                    active
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <div className="flex items-center pr-1">
                    <button
                      type="button"
                      className={sortButton}
                      onClick={() => onSort(c.key)}
                    >
                      {label}
                      {active ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                    <InfoTip label={label} text={help} />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, i) => (
            <tr key={row.campaign_id ?? `null-${i}`} className={rowHover}>
              {COLUMNS.map((c) => (
                <td key={c.key} className={cellClass(c.key)}>
                  {c.key === "name" && row.campaign_id ? (
                    <Link
                      href={detailHref(row.campaign_id, detailQuery)}
                      className="font-semibold text-fg hover:text-accent hover:underline"
                    >
                      {c.cell(row)}
                    </Link>
                  ) : (
                    c.cell(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
          {noCampaign && (
            <tr data-testid="no-campaign-row" className={rowHover}>
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  // The row reads as muted, but the info icon stays at full
                  // strength, so the dimming is on the cells and the link, not
                  // on the row. The pinned name cell is already positioned
                  // (sticky) and has an opaque background, so it is not dimmed
                  // itself.
                  className={`${cellClass(c.key)} ${c.key === "name" ? "" : "relative opacity-65"}`}
                >
                  {c.key === "name" ? (
                    <div className="flex items-center gap-1">
                      <Link
                        href={detailHref("none", detailQuery)}
                        className="font-semibold text-fg opacity-65 hover:text-accent hover:underline"
                      >
                        {c.cell(noCampaign)}
                      </Link>
                      {noCampaignTip && (
                        <InfoTip label="No campaign" text={noCampaignTip} />
                      )}
                    </div>
                  ) : c.key === "spend_cents" ? (
                    "—"
                  ) : (
                    c.cell(noCampaign)
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr data-testid="totals-row">
            <th scope="row" colSpan={2} className={footLabel}>
              Totals (spend ratios: paid campaigns only)
            </th>
            <td className={footNum}>{formatCount(totals.calls)}</td>
            <td className={footNum}>{formatCount(totals.unique_callers)}</td>
            <td className={footNum}>{formatCount(totals.new_callers)}</td>
            <td className={footNum}>{formatCount(totals.booked)}</td>
            <td className={footNum}>{formatPercent(totals.booking_rate)}</td>
            <td className={footNum}>{formatPercent(totals.unanswered_rate)}</td>
            <td className={footNum}>{formatCount(totals.awaiting_outcome)}</td>
            <td className={footNum}>{formatMoney(totals.revenue_cents)}</td>
            <td className={footNum}>{formatMoney(totals.spend_cents)}</td>
            <td className={footNum}>{formatRatio(paid.revenue_per_spend)}</td>
            <td className={footNum}>
              {formatMoney(paid.spend_per_booking_cents)}
            </td>
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  );
}
