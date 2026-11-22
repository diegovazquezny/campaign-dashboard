import { ApiRequestError, getCalls } from "./api";
import type { CallRow, CallsResponse } from "./api-types";

const OUTCOME_LABELS: Record<NonNullable<CallRow["outcome"]>, string> = {
  booked: "Booked",
  qualified_lead: "Qualified lead",
  not_qualified: "Not qualified",
  missed: "Missed",
  voicemail: "Voicemail",
};

/** A call that was answered but has no outcome yet reads "Awaiting outcome". */
export function outcomeLabel(outcome: CallRow["outcome"]): string {
  return outcome ? OUTCOME_LABELS[outcome] : "Awaiting outcome";
}

export type CallsResult = { data: CallsResponse | null; error: string | null };

/** Fetches one page of calls; an API error becomes a message, anything else is rethrown. */
export async function loadCalls(
  args: Parameters<typeof getCalls>[0],
): Promise<CallsResult> {
  try {
    return { data: await getCalls(args), error: null };
  } catch (err) {
    if (err instanceof ApiRequestError) return { data: null, error: err.message };
    throw err;
  }
}

/** True when the page is past the last one, so the caller should redirect. */
export function isPastEnd(data: CallsResponse): boolean {
  return data.calls.length === 0 && data.total > 0;
}

export function pageCount(data: CallsResponse): number {
  return Math.max(1, Math.ceil(data.total / data.page_size));
}
