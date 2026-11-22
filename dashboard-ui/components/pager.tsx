const button =
  "cursor-pointer rounded-ctl border border-border bg-card px-3.5 py-1.5 font-medium text-fg hover:border-accent " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-border";

type Props = {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Describes the visible range, e.g. "Days 31–60 of 90". Announced on change. */
  label: string;
  ariaLabel: string;
  prevLabel: string;
  nextLabel: string;
};

// Previous / Next with a live range label. Ends use aria-disabled (not disabled) so
// keyboard focus stays on the button.
// Renders nothing for a single page.
// Agnostic about where the data comes from, so client- and server-paged lists can share it.
export function Pager({
  page,
  pageCount,
  onChange,
  label,
  ariaLabel,
  prevLabel,
  nextLabel,
}: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center justify-end gap-3 text-muted"
    >
      <span aria-live="polite">{label}</span>
      <button
        type="button"
        className={button}
        aria-disabled={page <= 1}
        onClick={() => page > 1 && onChange(page - 1)}
      >
        {prevLabel}
      </button>
      <button
        type="button"
        className={button}
        aria-disabled={page >= pageCount}
        onClick={() => page < pageCount && onChange(page + 1)}
      >
        {nextLabel}
      </button>
    </nav>
  );
}
