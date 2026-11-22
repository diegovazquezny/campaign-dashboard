import { describe, expect, it } from "vitest";
import { formatCount, formatMoney, formatPercent, formatRatio } from "./format";

const formatters = [formatCount, formatMoney, formatPercent, formatRatio];

describe("formatters with missing or non-finite input", () => {
  it.each(formatters.map((f) => [f.name, f] as const))(
    "%s returns a dash",
    (_n, f) => {
      expect(f(null)).toBe("—");
      expect(f(undefined)).toBe("—");
      expect(f(NaN)).toBe("—");
      expect(f(Infinity)).toBe("—");
      expect(f(-Infinity)).toBe("—");
    },
  );
});

describe("formatCount", () => {
  it("groups thousands and rounds", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(formatCount(2.6)).toBe("3");
    expect(formatCount(-0.2)).toBe("0");
  });
});

describe("formatMoney", () => {
  it("formats cents as whole dollars", () => {
    expect(formatMoney(1234500)).toBe("$12,345");
    expect(formatMoney(0)).toBe("$0");
  });
  it("rounds fractional cents", () => {
    expect(formatMoney(12345.67)).toBe("$123");
    expect(formatMoney(150)).toBe("$2");
    expect(formatMoney(49.9)).toBe("$0");
  });
  it('handles negatives without "-0"', () => {
    expect(formatMoney(-250000)).toBe("-$2,500");
    expect(formatMoney(-10)).toBe("$0");
  });
});

describe("formatPercent", () => {
  it("formats a fraction with one decimal", () => {
    expect(formatPercent(0.4567)).toBe("45.7%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(-0.0001)).toBe("0.0%");
  });
});

describe("formatRatio", () => {
  it("formats with two decimals and a multiplication sign", () => {
    expect(formatRatio(3.436)).toBe("3.44×");
    expect(formatRatio(0)).toBe("0.00×");
    expect(formatRatio(12)).toBe("12.00×");
    expect(formatRatio(1234.5)).toBe("1,234.50×");
  });
});

describe("rounding of half values", () => {
  it("rounds halves away from zero symmetrically", () => {
    expect(formatMoney(150)).toBe("$2");
    expect(formatMoney(-150)).toBe("-$2");
    expect(formatCount(2.5)).toBe("3");
    expect(formatCount(-2.5)).toBe("-3");
  });

  it("matches Intl rounding for ratios and percents", () => {
    expect(formatRatio(1.005)).toBe("1.01×");
    expect(formatRatio(-0.001)).toBe("0.00×");
    expect(formatPercent(-0.00001)).toBe("0.0%");
  });
});
