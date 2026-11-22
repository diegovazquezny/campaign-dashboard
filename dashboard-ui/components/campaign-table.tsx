"use client";

import Link from "next/link";
import { useState } from "react";
import type { CampaignRow, Totals } from "../lib/api-types";
import { detailHref } from "../lib/filters";
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
    <span id={id} style={visuallyHidden}>
      {text}
    </span>
  );
}

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  margin: -1,
  whiteSpace: "nowrap",
};

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
    <table>
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
                style={{ position: "relative" }}
                scope="col"
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
                <button type="button" onClick={() => onSort(c.key)}>
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
          <tr key={row.campaign_id ?? `null-${i}`}>
            {COLUMNS.map((c) => (
              <td key={c.key}>
                {c.key === "name" && row.campaign_id ? (
                  <Link href={detailHref(row.campaign_id, detailQuery)}>
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
            style={{ opacity: 0.65 }}
            title={noCampaignTip ?? undefined}
            aria-describedby={noCampaignTip ? "tip-no-campaign" : undefined}
          >
            {COLUMNS.map((c) => (
              <td key={c.key} style={{ position: "relative" }}>
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
          <th scope="row" colSpan={2}>
            Totals (spend ratios: paid campaigns only)
          </th>
          <td>{formatCount(totals.calls)}</td>
          <td>{formatCount(totals.unique_callers)}</td>
          <td>{formatCount(totals.new_callers)}</td>
          <td>{formatCount(totals.booked)}</td>
          <td>{formatPercent(totals.booking_rate)}</td>
          <td>{formatPercent(totals.unanswered_rate)}</td>
          <td>{formatCount(totals.awaiting_outcome)}</td>
          <td>{formatMoney(totals.revenue_cents)}</td>
          <td>{formatMoney(totals.spend_cents)}</td>
          <td>{formatRatio(paid.revenue_per_spend)}</td>
          <td>{formatMoney(paid.spend_per_booking_cents)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
