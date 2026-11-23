import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallsResponse, Meta } from "../../../lib/api-types";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/campaigns/none",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/api")>(
      "../../../lib/api",
    );
  return {
    ...actual,
    getMeta: vi.fn(),
    getCalls: vi.fn(),
    getCampaignDaily: vi.fn(),
  };
});

import {
  ApiRequestError,
  getCalls,
  getCampaignDaily,
  getMeta,
} from "../../../lib/api";
import NoCampaignCalls from "./page";

const meta: Meta = {
  data_coverage: { from: "2026-08-31", to: "2026-10-29" },
  freshness: null,
  locations: [{ id: "loc1", name: "Downtown", timezone: "America/New_York" }],
  campaigns: [],
};

const calls: CallsResponse = {
  page: 1,
  page_size: 25,
  total: 1,
  calls: [
    {
      call_id: "n1",
      started_at: "2026-09-02T15:00:00Z",
      ended_at: "2026-09-02T15:00:30Z",
      local_date: "2026-09-02",
      timezone: "America/New_York",
      duration_seconds: 30,
      answered: false,
      outcome: "missed",
      revenue_cents: null,
      agent_id: null,
      tracking_number: "+15550000000",
      campaign: null,
      channel: "organic",
      location: { id: "loc1", name: "Downtown" },
    },
  ],
};

async function renderPage(search: Record<string, string> = {}) {
  render(await NoCampaignCalls({ searchParams: Promise.resolve(search) }));
}

describe("NoCampaignCalls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
    vi.mocked(getMeta).mockResolvedValue(meta);
    vi.mocked(getCalls).mockResolvedValue(calls);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("lists calls with campaign_id none and shows no daily chart or table", async () => {
    await renderPage({ location: "loc1" });
    expect(getCalls).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-09-30",
      campaignId: "none",
      locationId: "loc1",
      page: 1,
    });
    expect(getCampaignDaily).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "No campaign",
    );
    expect(screen.getAllByRole("table").length).toBe(1);
    expect(screen.getByText("Missed")).toBeTruthy();
    expect(screen.getByText("Sep 2, 11:00 AM EDT")).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /All campaigns/ }).getAttribute("href"),
    ).toBe("/?location=loc1");
  });

  it("shows an empty state", async () => {
    vi.mocked(getCalls).mockResolvedValue({ ...calls, total: 0, calls: [] });
    await renderPage();
    expect(screen.getByText("No calls in this range.")).toBeTruthy();
  });

  it("redirects to the last page when the page is past the end", async () => {
    vi.mocked(getCalls).mockResolvedValue({
      ...calls,
      page: 5,
      total: 26,
      calls: [],
    });
    await expect(renderPage({ page: "5" })).rejects.toThrow(
      "NEXT_REDIRECT /campaigns/none?page=2",
    );
  });

  it("shows the message alone when meta fails", async () => {
    vi.mocked(getMeta).mockRejectedValue(
      new ApiRequestError(0, "network_error", "Could not reach the API"),
    );
    await renderPage();
    expect(screen.getByRole("alert").textContent).toBe(
      "Could not reach the API",
    );
  });

  it("links each call to its detail page, carrying the filters and page", async () => {
    await renderPage({ location: "loc1", page: "1" });
    const link = screen.getByRole("link", { name: /Sep 2/ });
    expect(link.getAttribute("href")).toBe("/calls/n1?location=loc1");
  });

  it("makes no calls request for an invalid custom range", async () => {
    await renderPage({
      preset: "custom",
      from: "2026-09-10",
      to: "2026-09-01",
    });
    expect(getCalls).not.toHaveBeenCalled();
  });
});
