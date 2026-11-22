import Link from "next/link";
import { overviewHref } from "../lib/filters";

type Props = { query?: string };

export function BackLink({ query = "" }: Props) {
  return <Link href={overviewHref(query)}>← All campaigns</Link>;
}
