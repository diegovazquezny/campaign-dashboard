import Link from "next/link";
import { Notice } from "../../../components/notice";
import { PageShell } from "../../../components/page-shell";
import { PageTitle } from "../../../components/page-title";

export default function CallNotFound() {
  return (
    <PageShell>
      <Link
        href="/"
        className="self-start text-[13px] font-medium text-muted hover:text-accent"
      >
        ← All campaigns
      </Link>
      <PageTitle>Call not found</PageTitle>
      <Notice>No call has this ID.</Notice>
    </PageShell>
  );
}
