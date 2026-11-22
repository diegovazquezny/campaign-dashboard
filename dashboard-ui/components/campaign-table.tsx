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
  table,
  thLeft,
  thRight,
} from "./table-styles";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRatio,
  SPEND_LABEL,
  SPEND_LOCATION_LABEL,
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
  tip?: string;
  cell: (row: CampaignRow) => string;
};

const COLUMNS: Column[] = [
  { key: "name", label: "Campaign", cell: (r) => r.name },
  { key: "channel", label: "Channel", cell: (r) => r.channel },
  { key: "calls", label: "Calls", cell: (r) => formatCount(r.calls) },
  {
    key: "unique_callers",
    label: "Unique callers",
    cell: (r) => formatCount(r.unique_callers),
  },
  {
    key: "new_callers",
    label: "New callers",
    tip: "First seen since data starts (Sep 1)",
    cell: (r) => formatCount(r.new_callers),
  },
  { key: "booked", label: "Booked", cell: (r) => formatCount(r.booked) },
  {
    key: "booking_rate",
    label: "Booking rate",
    cell: (r) => formatPercent(r.booking_rate),
  },
  {
    key: "unanswered_rate",
    label: "Unanswered rate",
    cell: (r) => formatPercent(r.unanswered_rate),
  },
  {
    key: "awaiting_outcome",
    label: "Awaiting outcome",
    cell: (r) => formatCount(r.awaiting_outcome),
  },
  {
    key: "revenue_cents",
    label: "Revenue",
    cell: (r) => formatMoney(r.revenue_cents),
  },
  {
    key: "spend_cents",
    label: SPEND_LABEL,
    cell: (r) => formatMoney(r.spend_cents),
  },
  {
    key: "revenue_per_spend",
    label: "Revenue ÷ spend",
    cell: (r) => formatRatio(r.revenue_per_spend),
  },
  {
    key: "spend_per_booking_cents",
    label: "Spend per booking",
    cell: (r) => formatMoney(r.spend_per_booking_cents),
  },
];

// Campaign and channel are labels (left-aligned); every other column is a number.
const isLabelKey = (key: SortKey) => key === "name" || key === "channel";

function cellClass(key: SortKey): string {
  if (key === "name") return labelCell;
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

function Tip({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} className="sr-only">
      {text}
    </span>
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
    <table className={table}>
      <thead>
        <tr>
          {COLUMNS.map((c) => {
            const label =
              c.key === "spend_cents" && locationSelected
                ? SPEND_LOCATION_LABEL
                : c.label;
            const active = sort.key === c.key;
            const tipId = c.tip ? `tip-${c.key}` : undefined;
            return (
              <th
                key={c.key}
                scope="col"
                className={isLabelKey(c.key) ? thLeft : thRight}
                title={c.tip}
                aria-describedby={tipId}
                aria-sort={
                  active
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  className={sortButton}
                  onClick={() => onSort(c.key)}
                >
                  {label}
                  {active ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                </button>
                {c.tip && tipId && <Tip id={tipId} text={c.tip} />}
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
          <tr
            data-testid="no-campaign-row"
            className={`${rowHover} opacity-65`}
            title={noCampaignTip ?? undefined}
            aria-describedby={noCampaignTip ? "tip-no-campaign" : undefined}
          >
            {COLUMNS.map((c) => (
              <td key={c.key} className={`${cellClass(c.key)} relative`}>
                {c.key === "spend_cents" ? "—" : c.cell(noCampaign)}
                {c.key === "name" && noCampaignTip && (
                  <Tip id="tip-no-campaign" text={noCampaignTip} />
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
  );
}
