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

describe("BackLink with a target", () => {
  afterEach(cleanup);

  it("links to the given href with the given label", () => {
    render(
      <BackLink to={{ href: "/campaigns/c1?page=2", label: "← Spring" }} />,
    );
    const link = screen.getByRole("link", { name: "← Spring" });
    expect(link.getAttribute("href")).toBe("/campaigns/c1?page=2");
  });
});
