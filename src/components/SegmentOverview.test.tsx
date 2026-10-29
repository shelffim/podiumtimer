import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SegmentOverview } from "./SegmentOverview";

afterEach(cleanup);

describe("SegmentOverview", () => {
  it("shows the count, total, a finished-tone timeline and the numbered list in one card", () => {
    const { container } = render(<SegmentOverview segments={[{ id: "a", name: "도입", durationSec: 60 }, { id: "b", name: "본론", durationSec: 125 }]} />);
    expect(screen.getByText("구간 2개")).toHaveClass("label");
    expect(screen.getByText("합계 3:05")).toHaveClass("tabular-nums");
    expect(container.firstElementChild).toHaveClass("card");
    expect(container.querySelectorAll("[data-block]")).toHaveLength(2);
    expect(container.querySelector("[data-marker]")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("leaves out the timeline when there are no segments", () => {
    const { container } = render(<SegmentOverview segments={[]} />);
    expect(screen.getByText("구간 0개")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-block]")).toHaveLength(0);
  });
});
