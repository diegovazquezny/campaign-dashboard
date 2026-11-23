// Card around a data table. Wide tables scroll sideways inside it instead of
// widening the page. Focusable, so keyboard users can scroll it too.
// `relative` contains the absolutely-positioned sr-only tips inside the tables;
// without it they sit outside the scroller and still widen the page.
export function TableScroll({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative overflow-x-auto rounded-card border border-border bg-card shadow-card focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </div>
  );
}
