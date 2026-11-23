import { describe, expect, test } from "vitest";
import {
  buildQuery,
  callHref,
  detailHref,
  listHref,
  overviewHref,
  pageHref,
  parsePage,
} from "./filters";

describe("buildQuery", () => {
  test("drops default preset and empty location", () => {
    expect(
      buildQuery({ preset: "this_quarter" }, { preset: "last_quarter" }),
    ).toBe("");
    expect(buildQuery({ location: "a" }, { location: "" })).toBe("");
  });
  test("preset change clears from/to", () => {
    expect(
      buildQuery(
        { preset: "custom", from: "2026-01-01", to: "2026-01-31" },
        { preset: "last_30_days" },
      ),
    ).toBe("preset=last_30_days");
  });
  test("custom keeps from/to", () => {
    expect(
      buildQuery(
        { preset: "custom", from: "2026-01-01", to: "2026-01-31" },
        { preset: "custom" },
      ),
    ).toBe("preset=custom&from=2026-01-01&to=2026-01-31");
  });
  test("custom with prefilled dates in the change", () => {
    expect(
      buildQuery(
        {},
        { preset: "custom", from: "2026-07-01", to: "2026-09-30" },
      ),
    ).toBe("preset=custom&from=2026-07-01&to=2026-09-30");
  });
  test("location is kept across preset changes", () => {
    expect(buildQuery({ location: "x" }, { preset: "last_90_days" })).toBe(
      "preset=last_90_days&location=x",
    );
  });
  test("ignores from/to when preset is not custom", () => {
    expect(buildQuery({ from: "2026-01-01" }, { location: "x" })).toBe(
      "location=x",
    );
  });
  test("empty date is dropped", () => {
    expect(
      buildQuery(
        { preset: "custom", from: "2026-01-01", to: "2026-02-01" },
        { to: "" },
      ),
    ).toBe("preset=custom&from=2026-01-01");
  });
});

describe("buildQuery page", () => {
  test("sets page above 1 and drops page 1", () => {
    expect(buildQuery({ location: "x" }, { page: 3 })).toBe(
      "location=x&page=3",
    );
    expect(buildQuery({ location: "x" }, { page: 1 })).toBe("location=x");
  });
  test("a page change keeps the other filters and extra params", () => {
    expect(
      buildQuery(
        { preset: "last_30_days" },
        { page: 2 },
        "preset=last_30_days&foo=1&page=5",
      ),
    ).toBe("foo=1&preset=last_30_days&page=2");
  });
  test.each([
    [{ preset: "last_90_days" as const }],
    [{ location: "y" }],
    [{ from: "2026-01-01" }],
    [{ to: "2026-01-31" }],
  ])("changing a filter (%o) resets page to 1", (change) => {
    expect(
      buildQuery({ preset: "custom", page: 4 }, change, "page=4"),
    ).not.toContain("page=");
  });
  test("a stale page in extra is dropped when no page is given in state", () => {
    expect(buildQuery({}, { location: "x" }, "page=3")).toBe("location=x");
  });
});

describe("parsePage", () => {
  test("accepts positive integers", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("12")).toBe(12);
    expect(parsePage(["3", "4"])).toBe(3);
  });
  test.each(["0", "-1", "abc", "1.5", "", "007", undefined])(
    "%s is page 1",
    (v) => {
      expect(parsePage(v)).toBe(1);
    },
  );
});

describe("pageHref", () => {
  test("keeps the filters and adds the page", () => {
    expect(pageHref("/campaigns/a", { location: "x" }, 2)).toBe(
      "/campaigns/a?location=x&page=2",
    );
    expect(pageHref("/campaigns/a", {}, 1)).toBe("/campaigns/a");
  });
});

describe("detailHref / overviewHref", () => {
  test("encodes the id", () => {
    expect(detailHref("a b/c?", "")).toBe("/campaigns/a%20b%2Fc%3F");
  });
  test('empty query gives no "?"', () => {
    expect(detailHref("x", "")).toBe("/campaigns/x");
    expect(overviewHref("")).toBe("/");
  });
  test("preserves preset/from/to/location", () => {
    const q = buildQuery(
      {
        preset: "custom",
        from: "2026-09-01",
        to: "2026-09-30",
        location: "o1",
      },
      {},
    );
    expect(detailHref("x", q)).toBe(`/campaigns/x?${q}`);
    expect(q).toContain("preset=custom");
    expect(q).toContain("location=o1");
    expect(overviewHref(q)).toBe(`/?${q}`);
  });
});

describe("listHref / callHref", () => {
  test("listHref goes to the campaign page, or /campaigns/none without a campaign", () => {
    expect(listHref("c 1", "page=2")).toBe("/campaigns/c%201?page=2");
    expect(listHref(null, "location=o1&page=3")).toBe(
      "/campaigns/none?location=o1&page=3",
    );
    expect(listHref("none", "")).toBe("/campaigns/none");
  });

  test("callHref encodes the id and carries the query", () => {
    expect(callHref("a/b", "page=2")).toBe("/calls/a%2Fb?page=2");
    expect(callHref("x", "")).toBe("/calls/x");
  });
});
