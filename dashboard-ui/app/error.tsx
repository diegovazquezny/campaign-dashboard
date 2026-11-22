"use client";

import { Notice } from "../components/notice";
import { PageShell } from "../components/page-shell";

// Generic fallback for unexpected failures. Expected API errors are rendered
// inline by app/page.tsx, because production replaces forwarded messages.
export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <PageShell>
      <Notice role="alert">Something went wrong.</Notice>
      <button
        type="button"
        onClick={() => retry()}
        className="cursor-pointer self-start rounded-ctl border border-border bg-card px-3.5 py-1.5 font-medium text-fg hover:border-accent"
      >
        Try again
      </button>
    </PageShell>
  );
}
