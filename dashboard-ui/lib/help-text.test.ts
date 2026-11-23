import { describe, expect, it } from "vitest";
import { SPEND_LABEL, SPEND_LOCATION_LABEL } from "./format";
import { HELP, spendHeader } from "./help-text";

describe("spendHeader", () => {
  it("is the plain estimate without an office", () => {
    expect(spendHeader()).toEqual({ label: SPEND_LABEL, help: HELP.spend });
    expect(spendHeader(false)).toEqual(spendHeader());
  });

  it("is the allocated estimate with an office", () => {
    expect(spendHeader(true)).toEqual({
      label: SPEND_LOCATION_LABEL,
      help: HELP.spendByLocation,
    });
  });
});
