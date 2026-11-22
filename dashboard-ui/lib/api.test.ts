import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  getCampaignDaily,
  getAccountDaily,
  getCampaignMetrics,
  getMeta,
} from "./api";
import type { CampaignMetricsResponse } from "./api-types";

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_URL", "http://api.test:3001");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getCampaignMetrics", () => {
  const range = { from: "2026-07-01", to: "2026-09-30" };
  const body: CampaignMetricsResponse = {
    range,
    rows: [],
    totals: {
      calls: 0,
      unique_callers: 0,
      new_callers: 0,
      booked: 0,
      booking_rate: null,
      unanswered_rate: null,
      awaiting_outcome: 0,
      revenue_cents: 0,
      spend_cents: null,
      paid: {
        revenue_cents: 0,
        booked: 0,
        spend_cents: 0,
        revenue_per_spend: null,
        spend_per_booking_cents: null,
      },
    },
  };

  it("builds the query string and maps locationId to location_id", async () => {
    fetchMock.mockResolvedValue(json(body));
    await getCampaignMetrics({ ...range, locationId: "loc_03" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://api.test:3001/api/campaigns/metrics?from=2026-07-01&to=2026-09-30&location_id=loc_03",
    );
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("omits location_id when unset", async () => {
    fetchMock.mockResolvedValue(json(body));
    await getCampaignMetrics(range);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test:3001/api/campaigns/metrics?from=2026-07-01&to=2026-09-30",
    );
  });

  it("returns the parsed success body", async () => {
    fetchMock.mockResolvedValue(json(body));
    await expect(getCampaignMetrics(range)).resolves.toEqual(body);
  });

  it("throws ApiRequestError with the API error shape on 400", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "bad_request", message: "from after to" } }, 400),
    );
    const err = await getCampaignMetrics(range).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({
      status: 400,
      code: "bad_request",
      message: "from after to",
    });
  });

  it("throws invalid_response on a 200 with a non-JSON body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    const err = await getCampaignMetrics(range).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 200, code: "invalid_response" });
  });

  it("throws status 0 timeout when the body read times out", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.reject(new DOMException("signal timed out", "TimeoutError")),
    });
    const err = await getCampaignMetrics(range).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 0, code: "timeout" });
  });

  it("falls back to localhost when API_URL is empty", async () => {
    vi.stubEnv("API_URL", "");
    fetchMock.mockResolvedValue(json(body));
    await getCampaignMetrics(range);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^http:\/\/localhost:3001\//);
    vi.unstubAllEnvs();
  });

  it("throws ApiRequestError on 404", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "not_found", message: "Unknown location" } }, 404),
    );
    await expect(
      getCampaignMetrics({ ...range, locationId: "nope" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("throws status 0 on network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const err = await getCampaignMetrics(range).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 0, code: "network_error" });
  });

  it("throws status 0 on timeout", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("signal timed out", "TimeoutError"),
    );
    const err = await getCampaignMetrics(range).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 0, code: "timeout" });
  });
});

describe("getMeta", () => {
  it("fetches /api/meta and reads API_URL at call time", async () => {
    const meta = {
      data_coverage: null,
      freshness: null,
      locations: [],
      campaigns: [],
    };
    fetchMock.mockResolvedValue(json(meta));
    vi.stubEnv("API_URL", "http://other:9999");
    await expect(getMeta()).resolves.toEqual(meta);
    expect(fetchMock.mock.calls[0][0]).toBe("http://other:9999/api/meta");
  });

  it("falls back to a generic error for a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(getMeta()).rejects.toMatchObject({
      status: 500,
      code: "http_error",
    });
  });
});

describe("getCampaignDaily", () => {
  const range = { from: "2026-09-01", to: "2026-09-02" };
  const body = { campaign: { id: "cmp_11", name: "X" }, days: [] };

  it("builds the path and query, omitting location_id when unset", async () => {
    fetchMock.mockResolvedValue(json(body));
    await getCampaignDaily("cmp_11", range);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test:3001/api/campaigns/cmp_11/daily?from=2026-09-01&to=2026-09-02",
    );
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });

  it("maps locationId to location_id", async () => {
    fetchMock.mockResolvedValue(json(body));
    await getCampaignDaily("cmp_11", { ...range, locationId: "loc_03" });
    expect(fetchMock.mock.calls[0][0]).toContain("&location_id=loc_03");
  });

  it("treats a null locationId as unset", async () => {
    fetchMock.mockResolvedValue(json(body));
    await getCampaignDaily("cmp_11", { ...range, locationId: null });
    expect(fetchMock.mock.calls[0][0]).not.toContain("location_id");
  });

  it("encodes the id in the path", async () => {
    fetchMock.mockResolvedValue(json(body));
    await getCampaignDaily("a/b c", range);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test:3001/api/campaigns/a%2Fb%20c/daily?from=2026-09-01&to=2026-09-02",
    );
  });

  it("throws the API error for a 404 and a 400", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "not_found", message: "record not found" } }, 404),
    );
    await expect(getCampaignDaily("nope", range)).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "record not found",
    });
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "invalid_range", message: "bad range" } }, 400),
    );
    await expect(getCampaignDaily("cmp_11", range)).rejects.toMatchObject({
      status: 400,
      code: "invalid_range",
    });
  });

  it("turns a network failure into status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const err = await getCampaignDaily("cmp_11", range).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.status).toBe(0);
  });
});

describe("getAccountDaily", () => {
  const range = { from: "2026-09-01", to: "2026-09-02" };

  it("calls /api/daily and maps locationId to location_id", async () => {
    fetchMock.mockImplementation(async () => json({ range, days: [] }));
    await getAccountDaily(range);
    await getAccountDaily({ ...range, locationId: "loc_03" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test:3001/api/daily?from=2026-09-01&to=2026-09-02",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://api.test:3001/api/daily?from=2026-09-01&to=2026-09-02&location_id=loc_03",
    );
  });
});
