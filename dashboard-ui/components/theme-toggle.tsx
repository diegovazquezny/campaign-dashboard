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
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle dark mode"
    >
      <span className="theme-toggle-to-dark">☾ Dark</span>
      <span className="theme-toggle-to-light">☀ Light</span>
    </button>
  );
}
