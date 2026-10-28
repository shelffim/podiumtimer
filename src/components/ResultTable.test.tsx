import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toSegmentResult } from "@/lib/timer";
import { ResultTable } from "./ResultTable";

afterEach(cleanup);

describe("ResultTable", () => {
  it("formats durations and colors only difference cells, always with verdict words", () => {
    const results = [
      toSegmentResult({ name: "도입", plannedMs: 60_000, actualMs: 72_000 }),
      toSegmentResult({ name: "본론", plannedMs: 120_000, actualMs: 112_000 }),
      toSegmentResult({ name: "결론", plannedMs: 30_000, actualMs: 30_500 }),
    ];
    const { container } = render(<ResultTable results={results} />);
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["구간", "계획", "실제", "차이"]);
    const rows = screen.getAllByRole("row").slice(1, -1);
    const expected = [["도입", "1:00", "1:12", "0:12 늦음"], ["본론", "2:00", "1:52", "0:08 빠름"], ["결론", "0:30", "0:31", "정시"]];
    expect(within(screen.getAllByRole("row").at(-1)!).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["합계", "3:30", "3:35", ""]);
    rows.forEach((row, index) => {
      const cells = within(row).getAllByRole("cell");
      expect(cells.map((cell) => cell.textContent)).toEqual(expected[index]);
      cells.slice(1).forEach((cell) => expect(cell).toHaveClass("tabular-nums"));
      cells.slice(0, 3).forEach((cell) => expect(cell.className).not.toMatch(/text-(?:red|blue|green)-/));
      expect(cells[3]).toHaveClass(["text-red-400", "text-blue-400", "text-neutral-300"][index]);
    });
    const colored = container.querySelectorAll(".text-red-400, .text-blue-400");
    expect(colored).toHaveLength(2);
    colored.forEach((element) => expect(element.tagName).toBe("TD"));
  });

  it("keeps the headers without a total row when there are no results", () => {
    render(<ResultTable results={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
