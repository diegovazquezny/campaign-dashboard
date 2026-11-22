export type Metric = "calls" | "revenue";

const BUTTON =
  "cursor-pointer rounded-ctl border px-3 py-1 text-[13px] aria-pressed:border-accent aria-pressed:text-accent border-border text-muted";

// Recharts tooltip box, themed with tokens.
export const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
};

// Calls / Revenue switch shared by the overview charts.
export function MetricToggle({
  label,
  metric,
  onChange,
}: {
  label: string;
  metric: Metric;
  onChange: (metric: Metric) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-2">
      <button
        type="button"
        className={BUTTON}
        aria-pressed={metric === "calls"}
        onClick={() => onChange("calls")}
      >
        Calls
      </button>
      <button
        type="button"
        className={BUTTON}
        aria-pressed={metric === "revenue"}
        onClick={() => onChange("revenue")}
      >
        Revenue
      </button>
    </div>
  );
}
