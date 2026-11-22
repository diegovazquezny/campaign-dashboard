import Link from "next/link";
import type { CallDetail } from "../lib/api-types";
import { outcomeLabel } from "../lib/calls";
import { CHANNELS } from "../lib/channels";
import { listHref } from "../lib/filters";
import {
  formatCallTime,
  formatDuration,
  formatLocalDate,
  formatMoney,
} from "../lib/format";

type Item = { label: string; value: React.ReactNode };

function Card({ title, items }: { title: string; items: Item[] }) {
  return (
    <section
      aria-label={title}
      className="rounded-card border border-border bg-card p-5 shadow-card"
    >
      <h2 className="m-0 text-[15px] font-semibold text-fg">{title}</h2>
      <dl className="m-0 mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3">
        {items.map((i) => (
          <div key={i.label} className="contents">
            <dt className="text-th font-semibold tracking-th text-muted uppercase">
              {i.label}
            </dt>
            <dd className="m-0 font-num tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const channelLabel = (key: string) =>
  CHANNELS.find((c) => c.key === key)?.label ?? key;

// The three cards of the call detail page. Times are in the call's office zone.
// The caller is only ever described (first or repeat, count, first seen): never identified.
export function CallDetails({
  call,
  listQuery,
}: {
  call: CallDetail;
  /** The filters and page the call was opened from, kept on the campaign link. */
  listQuery: string;
}) {
  const { timezone: tz } = call;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        title="About this call"
        items={[
          { label: "Call ID", value: call.call_id },
          { label: "Started", value: formatCallTime(call.started_at, tz) },
          { label: "Ended", value: formatCallTime(call.ended_at, tz) },
          { label: "Duration", value: formatDuration(call.duration_seconds) },
          { label: "Answered", value: call.answered ? "Yes" : "No" },
          { label: "Outcome", value: outcomeLabel(call.outcome) },
          { label: "Revenue", value: formatMoney(call.revenue_cents) },
          { label: "Agent", value: call.agent_id ?? "—" },
          { label: "Tracking number", value: call.tracking_number },
        ]}
      />
      <Card
        title="Caller data"
        items={[
          {
            label: "Caller",
            value: call.is_first_call ? "First call" : "Repeat caller",
          },
          { label: "Calls from this caller", value: call.caller_call_count },
          {
            label: "First seen",
            value: formatLocalDate(call.caller_first_seen),
          },
        ]}
      />
      <Card
        title="Marketing data"
        items={[
          {
            label: "Campaign",
            value: call.campaign ? (
              <Link
                href={listHref(call.campaign.id, listQuery)}
                className="text-accent hover:underline"
              >
                {call.campaign.name}
              </Link>
            ) : (
              "No campaign"
            ),
          },
          { label: "Channel", value: channelLabel(call.channel) },
          { label: "Office", value: call.location.name },
        ]}
      />
    </div>
  );
}
