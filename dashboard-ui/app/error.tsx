"use client";

// Generic fallback for unexpected failures. Expected API errors are rendered
// inline by app/page.tsx, because production replaces forwarded messages.
export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <main>
      <p role="alert">Something went wrong.</p>
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
