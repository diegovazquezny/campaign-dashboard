import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BackLink } from "./back-link";

describe("BackLink", () => {
  afterEach(cleanup);

  it("links to the overview with the query carried", () => {
    render(<BackLink query="preset=last_quarter&location=o1" />);
    expect(
      screen.getByRole("link", { name: /all campaigns/i }).getAttribute("href"),
    ).toBe("/?preset=last_quarter&location=o1");
  });

  it("links to / when there is no query", () => {
    render(<BackLink />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/");
  });
});
