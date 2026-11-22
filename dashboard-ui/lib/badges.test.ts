import { describe, expect, it } from "vitest";
import { formatShortDate, freshnessWarning, partialRange } from "./badges";

const cov = { from: "2026-08-31", to: "2026-10-29" };
const fresh = {
  latest_update_at: "2026-11-01T00:00:00Z",
  outcomes_may_be_incomplete_from: "2026-10-29",
};

describe("formatShortDate year and day validation", () => {
  it("includes year on request and rejects impossible days", () => {
    expect(formatShortDate("2026-09-01", true)).toBe("Sep 1, 2026");
    expect(formatShortDate("2026-02-31")).toBe("2026-02-31");
    expect(formatShortDate("2024-02-29")).toBe("Feb 29");
    expect(formatShortDate("2026-02-29")).toBe("2026-02-29");
    expect(formatShortDate("2026-04-00")).toBe("2026-04-00");
  });
});

describe("formatShortDate", () => {
  it("formats without local time", () => {
    expect(formatShortDate("2026-09-01")).toBe("Sep 1");
    expect(formatShortDate("2026-12-31")).toBe("Dec 31");
    expect(formatShortDate("2026-01-05")).toBe("Jan 5");
  });
});

describe("partialRange", () => {
  it("false inside coverage", () => {
    expect(partialRange({ from: "2026-08-31", to: "2026-10-29" }, cov)).toBe(
      false,
    );
  });
  it("true when starting one day early", () => {
    expect(partialRange({ from: "2026-08-30", to: "2026-10-01" }, cov)).toBe(
      true,
    );
  });
  it("true when ending one day late", () => {
    expect(partialRange({ from: "2026-09-01", to: "2026-10-30" }, cov)).toBe(
      true,
    );
  });
  it("false when coverage null", () => {
    expect(partialRange({ from: "2026-01-01", to: "2026-12-31" }, null)).toBe(
      false,
    );
  });
});

describe("freshnessWarning", () => {
  const r = (to: string) => ({ from: "2026-09-01", to });
  it("false the day before", () => {
    expect(freshnessWarning(r("2026-10-28"), fresh)).toBe(false);
  });
  it("true on the date", () => {
    expect(freshnessWarning(r("2026-10-29"), fresh)).toBe(true);
  });
  it("true after", () => {
    expect(freshnessWarning(r("2026-10-30"), fresh)).toBe(true);
  });
  it("false when freshness null", () => {
    expect(freshnessWarning(r("2026-12-01"), null)).toBe(false);
  });
});
