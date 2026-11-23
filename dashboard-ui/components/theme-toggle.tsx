"use client";

// The <html data-theme> attribute is the source of truth (set before paint by
// the inline script in layout.tsx). Both labels are always rendered and CSS
// shows the one for the active theme, so there is no label flash on load.
export function ThemeToggle() {
  function toggle() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      className="fixed right-4 bottom-4 z-50 inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center gap-2 sm:min-h-0 sm:min-w-0 rounded-full border border-border bg-card px-3.5 py-[9px] text-[13px] leading-none font-medium text-fg shadow-card hover:border-accent"
      onClick={toggle}
      aria-label="Toggle dark mode"
    >
      <span className="dark:hidden">
        ☾<span className="hidden sm:inline"> Dark</span>
      </span>
      <span className="hidden dark:inline">
        ☀<span className="hidden sm:inline"> Light</span>
      </span>
    </button>
  );
}
