import type { Meta, Totals } from "../lib/api-types";
import { freshnessWarning } from "../lib/badges";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRatio,
} from "../lib/format";

type Props = {
  totals: Totals;
  range: { from: string; to: string };
  freshness: Meta["freshness"];
};

// Summary row above the campaign table. Values come straight from the
// metrics `totals`, so they always equal the table's totals row.
export function KpiCards({ totals, range, freshness }: Props) {
  const incomplete = freshness !== null && freshnessWarning(range, freshness);
  const cards = [
    { label: "Calls", value: formatCount(totals.calls) },
    { label: "Booked", value: formatCount(totals.booked), outcome: true },
    {
      label: "Booking rate",
      value: formatPercent(totals.booking_rate),
      outcome: true,
    },
    {
      label: "Revenue",
      value: formatMoney(totals.revenue_cents),
      outcome: true,
    },
    {
      label: "Revenue ÷ spend",
      value: formatRatio(totals.paid.revenue_per_spend),
      note: "paid campaigns only",
    },
  ];
  return (
    <dl
      aria-label="Key figures"
      className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-card border border-border bg-card p-4 shadow-card"
        >
          <dt className="text-th font-semibold tracking-th text-muted uppercase">
            {card.label}
          </dt>
          <dd className="m-0 mt-1 font-num text-2xl font-bold tabular-nums">
            {card.value}
          </dd>
          {card.note && (
            <p className="m-0 mt-1 text-[13px] text-muted">{card.note}</p>
          )}
          {card.outcome && incomplete && (
            <p className="m-0 mt-1 text-[13px] text-warn-fg">
              May be incomplete
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}
