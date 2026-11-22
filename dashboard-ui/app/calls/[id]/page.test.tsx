import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CallDetail } from "../../../lib/api-types";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../../../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/api")>(
      "../../../lib/api",
    );
  return { ...actual, getCall: vi.fn() };
});

import { ApiRequestError, getCall } from "../../../lib/api";
import CallNotFound from "./not-found";
import CallPage from "./page";

const call: CallDetail = {
  call_id: "call-1",
  started_at: "2026-09-02T15:00:00Z",
  ended_at: "2026-09-02T15:02:05Z",
  local_date: "2026-09-02",
  timezone: "America/Chicago",
  duration_seconds: 125,
  answered: true,
  outcome: "booked",
  revenue_cents: 12500,
  agent_id: "agent-7",
  tracking_number: "+15551234567",
  campaign: { id: "c1", name: "Spring Promo" },
  channel: "paid_search",
  location: { id: "loc1", name: "Downtown" },
  is_first_call: true,
  caller_call_count: 1,
  caller_first_seen: "2026-09-02",
};

async function renderPage(
  detail: CallDetail,
  search: Record<string, string> = {},
) {
  vi.mocked(getCall).mockResolvedValue(detail);
  render(
    await CallPage({
      params: Promise.resolve({ id: detail.call_id }),
      searchParams: Promise.resolve(search),
    }),
  );
}

function card(name: string) {
  return screen.getByRole("region", { name });
}

describe("CallPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the three cards with the call's facts in its office zone", async () => {
    await renderPage(call);
    expect(getCall).toHaveBeenCalledWith("call-1");
    const about = card("About this call");
    expect(about.textContent).toContain("call-1");
    expect(about.textContent).toContain("Sep 2, 10:00 AM CDT");
    expect(about.textContent).toContain("Sep 2, 10:02 AM CDT");
    expect(about.textContent).toContain("2m 05s");
    expect(about.textContent).toContain("Booked");
    expect(about.textContent).toContain("$125");
    expect(about.textContent).toContain("agent-7");
    expect(about.textContent).toContain("+15551234567");
    expect(card("Caller data").textContent).toContain("First call");
    const marketing = card("Marketing data");
    expect(marketing.textContent).toContain("Paid search");
    expect(marketing.textContent).toContain("Downtown");
    expect(
      screen.getByRole("link", { name: "Spring Promo" }).getAttribute("href"),
    ).toBe("/campaigns/c1");
  });

  it("shows a repeat caller with their count and first-seen date", async () => {
    await renderPage({
      ...call,
      is_first_call: false,
      caller_call_count: 4,
      caller_first_seen: "2026-08-31",
    });
    const caller = card("Caller data").textContent ?? "";
    expect(caller).toContain("Repeat caller");
    expect(caller).toContain("4");
    expect(caller).toContain("Aug 31, 2026");
    expect(caller).not.toMatch(/hash/i);
  });

  it("shows a null outcome as awaiting and null revenue and agent as dashes", async () => {
    await renderPage({
      ...call,
      outcome: null,
      revenue_cents: null,
      agent_id: null,
    });
    const about = card("About this call").textContent ?? "";
    expect(about).toContain("Awaiting outcome");
    expect(about).toContain("Revenue—");
    expect(about).toContain("Agent—");
  });

  it("shows plain text, not a link, when there is no campaign", async () => {
    await renderPage({ ...call, campaign: null });
    expect(card("Marketing data").textContent).toContain("No campaign");
    expect(screen.queryByRole("link", { name: "Spring Promo" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "← No campaign" }).getAttribute("href"),
    ).toBe("/campaigns/none");
  });

  it("links back to the campaign's list with the filters and page kept", async () => {
    await renderPage(call, {
      preset: "last_30_days",
      location: "loc1",
      page: "3",
    });
    expect(
      screen.getByRole("link", { name: "← Spring Promo" }).getAttribute("href"),
    ).toBe("/campaigns/c1?preset=last_30_days&location=loc1&page=3");
  });

  it("keeps the filters and page on the campaign link in the Marketing card", async () => {
    await renderPage(call, { location: "loc1", page: "3" });
    expect(
      screen.getByRole("link", { name: "Spring Promo" }).getAttribute("href"),
    ).toBe("/campaigns/c1?location=loc1&page=3");
  });

  it("links back to /campaigns/none at the same page for a call with no campaign", async () => {
    await renderPage({ ...call, campaign: null }, { page: "2" });
    expect(
      screen.getByRole("link", { name: "← No campaign" }).getAttribute("href"),
    ).toBe("/campaigns/none?page=2");
  });

  it("calls notFound for an unknown id", async () => {
    vi.mocked(getCall).mockImplementation(async () => {
      throw new ApiRequestError(404, "not_found", "x");
    });
    await expect(
      CallPage({
        params: Promise.resolve({ id: "nope" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows other API errors inline", async () => {
    vi.mocked(getCall).mockImplementation(async () => {
      throw new ApiRequestError(500, "boom", "API is down");
    });
    render(
      await CallPage({
        params: Promise.resolve({ id: "x" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByRole("alert").textContent).toBe("API is down");
  });
});

describe("CallNotFound", () => {
  afterEach(cleanup);

  it("says the call was not found and links to the overview", () => {
    render(<CallNotFound />);
    expect(
      screen.getByRole("heading", { name: "Call not found" }),
    ).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/");
  });
});
