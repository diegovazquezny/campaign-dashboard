// Shared Tailwind classes for the data tables (campaign table, daily table).
// Class names must stay complete literals so Tailwind can find them.

// The card border, radius and shadow come from <TableScroll>, which wraps every table.
export const table = "w-full border-separate border-spacing-0 bg-card";

const th =
  "border-b border-border bg-thead align-bottom text-th font-semibold tracking-th whitespace-nowrap text-muted uppercase " +
  "aria-[sort=ascending]:text-accent aria-[sort=descending]:text-accent";
export const thLeft = `${th} text-left`;
export const thRight = `${th} text-right`;
export const thPadding = "px-cell-x py-cell-y";

export const sortButton =
  "w-full cursor-pointer px-cell-x py-cell-y leading-tight whitespace-normal [text-align:inherit] [text-transform:inherit] hover:text-fg";

const cell = "border-b border-row-border px-cell-x py-cell-y";
export const labelCell = `${cell} text-left`;
export const numCell = `${cell} text-right font-num text-num tabular-nums`;
export const rowHover = "group hover:bg-row-hover";

// First column pinned while the rest of a wide table scrolls. Cells need an opaque
// background so scrolled cells don't show through; the body one follows row hover.
export const stickyHead = "sticky left-0 z-10 border-r border-border";
export const stickyCell =
  "sticky left-0 z-10 min-w-32 border-r border-border bg-card group-hover:bg-row-hover";

export const footLabel =
  "border-t border-border bg-thead px-cell-x py-cell-y text-left font-semibold text-muted";
export const footNum =
  "border-t border-border bg-thead px-cell-x py-cell-y text-right font-num text-num font-bold tabular-nums";
