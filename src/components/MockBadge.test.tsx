import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { MockBadge } from "./MockBadge";

afterEach(cleanup);

describe("MockBadge", () => {
  it("shows a fixed, noninteractive notice in mock mode", () => {
    render(<MockBadge mode="mock" />);
    expect(screen.getByText(MESSAGES.mockBadge)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.mockBadge).closest(".fixed")).toHaveClass("pointer-events-none");
  });

  it("renders nothing in live mode", () => {
    const { container } = render(<MockBadge mode="live" />);
    expect(container).toBeEmptyDOMElement();
  });
});
