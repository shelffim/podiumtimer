import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SegmentList } from "./SegmentList";

afterEach(cleanup);

describe("SegmentList", () => {
  it("shows ordered names, planned durations and a final total with dividers", () => {
    render(<SegmentList segments={[{ id: "a", name: "도입", durationSec: 60 }, { id: "b", name: "본론", durationSec: 125 }]} />);
    expect(screen.getByRole("list")).toHaveClass("divide-y", "divide-neutral-800");
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("도입")).toBeInTheDocument();
    expect(within(rows[0]).getByText("1:00")).toHaveClass("tabular-nums");
    expect(within(rows[1]).getByText("2:05")).toHaveClass("tabular-nums");
    expect(rows.at(-1)).toHaveTextContent("전체 3:05");
    expect(screen.getByText("전체 3:05")).toHaveClass("tabular-nums");
  });

  it("shows a zero total for no segments", () => {
    render(<SegmentList segments={[]} />);
    expect(screen.getByText("전체 0:00")).toBeInTheDocument();
  });
});
