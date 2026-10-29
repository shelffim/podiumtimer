import { describe, expect, it } from "vitest";
import { MESSAGES } from "./messages";
import { computeTimer, formatClock, resultTotals, totalPlannedMs } from "./timer";
import {
  DEMO_AVERAGE_COUNT,
  DEMO_AVERAGE_ROWS,
  DEMO_LOOP_TICKS,
  DEMO_RESULTS,
  DEMO_SEGMENTS,
  DEMO_STILL,
  DEMO_TICK_MS,
  demoFrame,
} from "./demo";

describe("demo playback", () => {
  it("plays six named segments over a nine-second loop", () => {
    expect(DEMO_TICK_MS).toBe(250);
    expect(DEMO_LOOP_TICKS).toBe(36);
    expect(DEMO_TICK_MS * DEMO_LOOP_TICKS).toBe(9_000);
    expect(DEMO_SEGMENTS.map((segment) => segment.id)).toEqual([
      "demo-0", "demo-1", "demo-2", "demo-3", "demo-4", "demo-5",
    ]);
    expect(DEMO_SEGMENTS.map((segment) => segment.name)).toEqual(MESSAGES.landing.previewSegments);
    expect(DEMO_SEGMENTS.map((segment) => segment.durationSec)).toEqual([30, 90, 120, 150, 60, 150]);
    expect(totalPlannedMs(DEMO_SEGMENTS)).toBe(600_000);
  });

  it.each([
    { tick: 0, index: 1, remaining: "0:08", previous: 0, verdict: "early", diffMs: -4_000, total: "8:12" },
    { tick: 19, index: 1, remaining: "-0:11", previous: 0, verdict: "early", diffMs: -4_000, total: "7:53" },
    { tick: 20, index: 2, remaining: "2:00", previous: 1, verdict: "late", diffMs: 12_000, total: "7:52" },
    { tick: 35, index: 2, remaining: "1:45", previous: 1, verdict: "late", diffMs: 12_000, total: "7:37" },
  ])("computes the timer view at tick $tick", ({ tick, index, remaining, previous, verdict, diffMs, total }) => {
    const frame = demoFrame(tick);
    expect(frame.run).toMatchObject({ status: "running", startedAt: 0, rev: 0 });
    const view = computeTimer(DEMO_SEGMENTS, frame.run, frame.nowMs);
    expect(view.segmentIndex).toBe(index);
    expect(formatClock(view.segmentRemainingMs)).toBe(remaining);
    expect(view.lastResult).toMatchObject({
      name: MESSAGES.landing.previewSegments[previous], verdict, diffMs,
    });
    expect(formatClock(view.totalRemainingMs)).toBe(total);
  });

  it("shows the pressed state only at ticks 19 and 20", () => {
    const pressedTicks = Array.from({ length: DEMO_LOOP_TICKS }, (_, tick) => tick)
      .filter((tick) => demoFrame(tick).pressed);
    expect(pressedTicks).toEqual([19, 20]);
  });

  it.each([[36, 0], [-1, 35], [72, 0], [-36, 0], [-37, 35]])(
    "wraps tick %i to tick %i", (tick, wrapped) => {
      expect(demoFrame(tick)).toEqual(demoFrame(wrapped));
    },
  );

  it("computes the still view for the first render and reduced motion", () => {
    expect(DEMO_STILL.pressed).toBe(false);
    expect(DEMO_STILL.run).toMatchObject({ status: "running", startedAt: 0, rev: 0 });
    const view = computeTimer(DEMO_SEGMENTS, DEMO_STILL.run, DEMO_STILL.nowMs);
    expect(view.segmentIndex).toBe(2);
    expect(formatClock(view.segmentRemainingMs)).toBe("1:24");
    expect(view.lastResult).toMatchObject({
      name: MESSAGES.landing.previewSegments[1], verdict: "late", diffMs: 12_000,
    });
    expect(formatClock(view.totalRemainingMs)).toBe("7:16");
  });
});

describe("demo example results", () => {
  const verdicts = ["early", "late", "on_time", "late", "early", "early"];

  it("provides a completed presentation with a thirteen-second total delay", () => {
    expect(DEMO_RESULTS.map((result) => result.name)).toEqual(MESSAGES.landing.previewSegments);
    expect(DEMO_RESULTS.map((result) => result.plannedMs)).toEqual([30_000, 90_000, 120_000, 150_000, 60_000, 150_000]);
    expect(DEMO_RESULTS.map((result) => result.actualMs)).toEqual([26_000, 102_000, 120_000, 171_000, 52_000, 142_000]);
    expect(DEMO_RESULTS.map((result) => result.verdict)).toEqual(verdicts);
    expect(resultTotals(DEMO_RESULTS)).toEqual({
      plannedMs: 600_000, actualMs: 613_000, diffMs: 13_000, verdict: "late",
    });
  });

  it("provides six average rows for five matching records", () => {
    expect(DEMO_AVERAGE_COUNT).toBe(5);
    expect(DEMO_AVERAGE_ROWS.map((row) => row.name)).toEqual(MESSAGES.landing.previewSegments);
    expect(DEMO_AVERAGE_ROWS.map((row) => row.plannedMs)).toEqual([30_000, 90_000, 120_000, 150_000, 60_000, 150_000]);
    expect(DEMO_AVERAGE_ROWS.map((row) => row.diffMs)).toEqual([-3_000, 11_000, 0, 15_000, -6_000, -4_000]);
    expect(DEMO_AVERAGE_ROWS.map((row) => row.actualMs)).toEqual([27_000, 101_000, 120_000, 165_000, 54_000, 146_000]);
    expect(DEMO_AVERAGE_ROWS.map((row) => row.verdict)).toEqual(verdicts);
  });
});
