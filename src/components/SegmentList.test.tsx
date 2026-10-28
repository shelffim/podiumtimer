import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SegmentList } from "./SegmentList";

afterEach(cleanup);

describe("SegmentList", () => {
  it("shows numbered names with tabular planned durations in order", () => {
    render(<SegmentList segments={[{ id: "a", name: "도입", durationSec: 60 }, { id: "b", name: "본론", durationSec: 125 }]} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("1")).toHaveClass("tabular-nums");
    expect(within(rows[0]).getByText("도입")).toBeInTheDocument();
    expect(within(rows[0]).getByText("1:00")).toHaveClass("tabular-nums");
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2:05")).toHaveClass("tabular-nums");
  });

  it("renders an empty list for no segments", () => {
    render(<SegmentList segments={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
