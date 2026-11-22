// Shared Tailwind classes for the data tables (campaign table, daily table).
// Class names must stay complete literals so Tailwind can find them.

export const table =
  "w-full border-separate border-spacing-0 rounded-card border border-border bg-card shadow-card " +
  "[&>thead>tr>:first-child]:rounded-tl-card [&>thead>tr>:last-child]:rounded-tr-card " +
  "[&>tfoot>tr>:first-child]:rounded-bl-card [&>tfoot>tr>:last-child]:rounded-br-card";

const th =
  "sticky top-0 border-b border-border bg-thead align-bottom text-th font-semibold tracking-th whitespace-nowrap text-muted [text-transform:var(--th-transform)] " +
  "aria-[sort=ascending]:text-accent aria-[sort=descending]:text-accent";
export const thLeft = `${th} text-left`;
export const thRight = `${th} text-right`;
export const thPadding = "px-cell-x py-cell-y";

export const sortButton =
  "w-full cursor-pointer px-cell-x py-cell-y leading-tight whitespace-normal [text-align:inherit] [text-transform:inherit] hover:text-fg";

const cell = "border-b border-row-border px-cell-x py-cell-y";
export const labelCell = `${cell} text-left`;
export const numCell = `${cell} text-right font-num text-num tabular-nums`;
export const rowHover = "hover:bg-row-hover";

export const footLabel =
  "border-t border-border bg-thead px-cell-x py-cell-y text-left font-semibold text-muted";
export const footNum =
  "border-t border-border bg-thead px-cell-x py-cell-y text-right font-num text-num font-bold tabular-nums";
