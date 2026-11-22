import { Notice } from "../components/notice";
import { PageShell } from "../components/page-shell";

export default function Loading() {
  return (
    <PageShell>
      <Notice role="status">Loading…</Notice>
    </PageShell>
  );
}
