import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ApiStatus } from "./api-status";

test("shows OK when the API is up", () => {
  render(<ApiStatus ok />);
  expect(screen.getByText("API: OK")).toBeInTheDocument();
});

test("shows unreachable when the API is down", () => {
  render(<ApiStatus ok={false} />);
  expect(screen.getByText("API: unreachable")).toBeInTheDocument();
});
