import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { computeTimer, createIdleRun, toSegmentResult } from "@/lib/timer";
import type { TimerView } from "@/types/run";
import { TimerFace } from "./TimerFace";

afterEach(cleanup);
const segments = [
  { id: "a", name: "찬성 입론", durationSec: 60 },
  { id: "b", name: "반대 입론", durationSec: 120 },
];
const view: TimerView = computeTimer(segments, createIdleRun(), 0);

describe("TimerFace", () => {
  it.each([[-5_000, "-0:05", "text-red-400"], [0, "0:00", "text-neutral-50"], [-999, "0:00", "text-neutral-50"], [59_001, "1:00", "text-neutral-50"]])(
    "renders remaining %i ms as %s with %s", (remaining, text, color) => {
      render(<TimerFace segments={segments} view={{ ...view, segmentRemainingMs: Number(remaining) }} />);
      expect(screen.getByText(String(text))).toHaveClass(String(color), "tabular-nums", "text-[clamp(5rem,28vw,12rem)]", "leading-none");
      if (color !== "text-red-400") expect(screen.getByText(String(text))).not.toHaveClass("text-red-400");
    },
  );

  it("shows the current name, next segment, timeline and total without progress or a first-segment result", () => {
    render(<TimerFace segments={segments} view={view} />);
    expect(screen.getAllByText("찬성 입론")[0]).toHaveClass("text-xl", "font-medium", "text-neutral-50");
    expect(screen.getByText("다음: 반대 입론")).toHaveClass("text-neutral-400");
    expect(screen.getByText("전체 3:00 남음")).toHaveClass("text-3xl", "tabular-nums", "text-neutral-300");
    expect(screen.queryByText(/직전 구간/)).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 2")).not.toBeInTheDocument();
    expect(screen.queryByText("한 번 더 누르면 종료")).not.toBeInTheDocument();
  });

  it.each([[12_000, "직전 구간 0:12 늦음", "text-red-400"], [-8_000, "직전 구간 0:08 빠름", "text-blue-400"], [1_000, "직전 구간 정시", "text-neutral-300"]] as const)(
    "renders the last result %i with text and color", (diff, text, color) => {
      const lastResult = toSegmentResult({ name: "찬성 입론", plannedMs: 60_000, actualMs: 60_000 + diff });
      render(<TimerFace segments={segments} view={{ ...view, segmentIndex: 1, lastResult }} />);
      expect(screen.getByText(text)).toHaveClass(color, "tabular-nums");
      expect(screen.getByText("마지막 구간")).toHaveClass("text-neutral-400");
    },
  );

  it("shows the finish hint immediately and an overdue total without the remaining suffix", () => {
    const { rerender } = render(<TimerFace segments={segments} view={{ ...view, totalRemainingMs: -80_000 }} finishHint />);
    expect(screen.getByText("전체 -1:20")).toHaveClass("text-red-400");
    expect(screen.getByText("전체 -1:20")).not.toHaveClass("text-neutral-300");
    expect(screen.getByText("한 번 더 누르면 종료")).toBeInTheDocument();
    rerender(<TimerFace segments={segments} view={{ ...view, totalRemainingMs: 0 }} />);
    expect(screen.getByText("전체 0:00 남음")).not.toHaveClass("text-red-400");
    expect(screen.queryByText("한 번 더 누르면 종료")).not.toBeInTheDocument();
  });
});
