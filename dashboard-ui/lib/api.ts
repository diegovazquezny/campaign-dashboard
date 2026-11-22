import type { ApiError, CampaignMetricsResponse, Meta } from "./api-types";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, params?: URLSearchParams): Promise<T> {
  // Read at call time, not module load, so runtime env is honored.
  const apiUrl = process.env.API_URL ?? "http://localhost:3001";
  const query = params ? `?${params}` : "";

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    const timedOut = (err as { name?: string } | null)?.name === "TimeoutError";
    throw new ApiRequestError(
      0,
      timedOut ? "timeout" : "network_error",
      timedOut ? "API request timed out" : "Could not reach the API",
    );
  }

  if (!res.ok) {
    let code = "http_error";
    let message = `API responded with ${res.status}`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Non-JSON error body: keep the defaults.
    }
    throw new ApiRequestError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export function getMeta(): Promise<Meta> {
  return request<Meta>("/api/meta");
}

export function getCampaignMetrics(args: {
  from: string;
  to: string;
  locationId?: string | null;
}): Promise<CampaignMetricsResponse> {
  const params = new URLSearchParams({ from: args.from, to: args.to });
  if (args.locationId) params.set("location_id", args.locationId);
  return request<CampaignMetricsResponse>("/api/campaigns/metrics", params);
}
