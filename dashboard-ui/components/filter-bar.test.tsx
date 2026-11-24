import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Meta } from "../lib/api-types";
import type { ResolvedRange } from "../lib/date-ranges";
import { FilterBar } from "./filter-bar";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search),
}));

const meta: Meta = {
  data_coverage: null,
  freshness: null,
  campaigns: [],
  locations: [
    { id: "l1", name: "Austin", timezone: "America/Chicago" },
    { id: "l2", name: "Boston", timezone: "America/New_York" },
  ],
};
const quarter: ResolvedRange = {
  preset: "last_90_days",
  from: "2026-08-25",
  to: "2026-11-22",
};

beforeEach(() => {
  cleanup();
  push.mockReset();
  search = "";
});

test("renders presets, locations and marks the active preset", () => {
  render(<FilterBar meta={meta} range={quarter} />);
  expect(screen.getByRole("button", { name: "Last 90 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
    "All offices",
    "Austin",
    "Boston",
  ]);
  expect(screen.queryByLabelText("From")).toBeNull();
});

test("preset click pushes the query and keeps the location", () => {
  search = "location=l1";
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
  expect(push).toHaveBeenCalledWith("/?preset=last_30_days&location=l1");
});

test("Last month sits after This quarter and pushes preset=last_month", () => {
  search = "location=l1";
  render(<FilterBar meta={meta} range={quarter} />);
  const names = screen.getAllByRole("button").map((b) => b.textContent);
  expect(names.indexOf("Last month")).toBe(names.indexOf("This quarter") + 1);
  fireEvent.click(screen.getByRole("button", { name: "Last month" }));
  expect(push).toHaveBeenCalledWith("/?preset=last_month&location=l1");
});

test("location change pushes the query", () => {
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.change(screen.getByLabelText("Office"), {
    target: { value: "l2" },
  });
  expect(push).toHaveBeenLastCalledWith("/?location=l2");
});

test("Custom prefills the current resolved range", () => {
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.click(screen.getByRole("button", { name: "Custom" }));
  expect(push).toHaveBeenCalledWith(
    "/?preset=custom&from=2026-08-25&to=2026-11-22",
  );
});

test("custom inputs show for Custom and edits push", () => {
  const range: ResolvedRange = {
    preset: "custom",
    from: "2026-01-01",
    to: "2026-01-31",
  };
  render(<FilterBar meta={meta} range={range} />);
  expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
  fireEvent.change(screen.getByLabelText("To"), {
    target: { value: "2026-02-15" },
  });
  expect(push).toHaveBeenCalledWith(
    "/?preset=custom&from=2026-01-01&to=2026-02-15",
  );
});

test("shows the error for an invalid custom range", () => {
  const range: ResolvedRange = {
    preset: "custom",
    from: "2026-03-01",
    error: "Custom range needs both a start and an end date.",
  };
  render(<FilterBar meta={meta} range={range} />);
  expect(screen.getByRole("alert")).toHaveTextContent("needs both");
});

test("quick From then To edits do not lose the first edit", () => {
  const range: ResolvedRange = {
    preset: "custom",
    from: "2026-01-01",
    to: "2026-01-31",
  };
  render(<FilterBar meta={meta} range={range} />);
  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2026-01-05" },
  });
  fireEvent.change(screen.getByLabelText("To"), {
    target: { value: "2026-01-20" },
  });
  expect(push).toHaveBeenLastCalledWith(
    "/?preset=custom&from=2026-01-05&to=2026-01-20",
  );
});

test("partial dates stay local until complete or blurred", () => {
  const range: ResolvedRange = {
    preset: "custom",
    from: "2026-01-01",
    to: "2026-01-31",
  };
  render(<FilterBar meta={meta} range={range} />);
  const from = screen.getByLabelText("From");
  fireEvent.change(from, { target: { value: "0002-01-01" } });
  expect(push).not.toHaveBeenCalled();
  expect(from).toHaveValue("0002-01-01");
  fireEvent.change(from, { target: { value: "2025-12-01" } });
  expect(push).toHaveBeenCalledTimes(1);
});

test("preserves unrelated search params", () => {
  search = "foo=bar&location=l1";
  render(<FilterBar meta={meta} range={quarter} />);
  fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
  expect(push).toHaveBeenCalledWith(
    "/?foo=bar&preset=last_30_days&location=l1",
  );
});

test("unknown location is shown rather than All offices", () => {
  search = "location=gone";
  render(<FilterBar meta={meta} range={quarter} />);
  expect(screen.getByLabelText("Office")).toHaveValue("gone");
});

test("shows a pending state while the transition is in flight", async () => {
  // push is synchronous (void) in Next; pending lasts until the render settles.
  push.mockImplementation(() => undefined);
  render(<FilterBar meta={meta} range={quarter} />);
  expect(screen.queryByRole("status")).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "This quarter" }));
  });
  expect(push).toHaveBeenCalledWith("/?preset=this_quarter");
  expect(screen.queryByRole("status")).toBeNull();
});
