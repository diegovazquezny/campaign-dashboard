import Link from "next/link";
import { overviewHref } from "../lib/filters";

type Props = { query?: string };

export function BackLink({ query = "" }: Props) {
  return (
    <Link
      href={overviewHref(query)}
      className="self-start text-[13px] font-medium text-muted hover:text-accent"
    >
      ← All campaigns
    </Link>
  );
}
