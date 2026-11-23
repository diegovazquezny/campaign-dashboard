import type { Totals } from "../lib/api-types";
import { formatCount, formatPercent } from "../lib/format";
import { HELP } from "../lib/help-text";
import { InfoTip } from "./info-tip";

// Unanswered calls split into missed and voicemail. The rate is the metrics
// `unanswered_rate`, so missed + voicemail = rate × calls.
export function MissedCallsCard({ totals }: { totals: Totals }) {
  const rows = [
    { label: "Missed", value: formatCount(totals.missed) },
    { label: "Voicemail", value: formatCount(totals.voicemail) },
  ];
  return (
    <section
      aria-label="Missed calls"
      className="rounded-card border border-border bg-card p-5 shadow-card"
    >
      <h2 className="m-0 flex items-center gap-1 text-[15px] font-semibold text-fg">
        Missed calls
        <InfoTip label="Missed calls" text={HELP.missedCalls} />
      </h2>
      <p className="m-0 mt-2 font-num text-3xl font-bold tabular-nums">
        {formatPercent(totals.unanswered_rate)}
      </p>
      <p className="m-0 text-[13px] text-muted">of calls went unanswered</p>
      <dl className="m-0 mt-4 grid grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-th font-semibold tracking-th text-muted uppercase">
              {r.label}
            </dt>
            <dd className="m-0 mt-1 font-num text-xl font-bold tabular-nums">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
