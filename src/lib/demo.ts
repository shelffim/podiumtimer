import type { RunState } from "@/types/run";
import type { AverageRow, Segment, SegmentResult } from "@/types/timer";
import { MESSAGES } from "./messages";
import { toSegmentResult } from "./timer";

export const DEMO_TICK_MS = 250;
export const DEMO_LOOP_TICKS = 36;

const plannedSeconds = [30, 90, 120, 150, 60, 150];
export const DEMO_SEGMENTS: Segment[] = MESSAGES.landing.previewSegments.map((name, index) => ({
  id: `demo-${index}`,
  name,
  durationSec: plannedSeconds[index],
}));

export type DemoFrame = { run: RunState; nowMs: number; pressed: boolean };

export function demoFrame(tick: number): DemoFrame {
  const t = ((tick % DEMO_LOOP_TICKS) + DEMO_LOOP_TICKS) % DEMO_LOOP_TICKS;
  return {
    run: {
      status: "running",
      startedAt: 0,
      transitions: t < 20 ? [26_000] : [26_000, 128_000],
      rev: 0,
    },
    nowMs: (108 + t) * 1000,
    pressed: t === 19 || t === 20,
  };
}

export const DEMO_STILL: DemoFrame = {
  run: { status: "running", startedAt: 0, transitions: [26_000, 128_000], rev: 0 },
  nowMs: 164_000,
  pressed: false,
};

const actualSeconds = [26, 102, 120, 171, 52, 142];
export const DEMO_RESULTS: SegmentResult[] = DEMO_SEGMENTS.map((segment, index) => toSegmentResult({
  name: segment.name,
  plannedMs: segment.durationSec * 1000,
  actualMs: actualSeconds[index] * 1000,
}));

const averageDiffSeconds = [-3, 11, 0, 15, -6, -4];
export const DEMO_AVERAGE_ROWS: AverageRow[] = DEMO_SEGMENTS.map((segment, index) => toSegmentResult({
  name: segment.name,
  plannedMs: segment.durationSec * 1000,
  actualMs: (segment.durationSec + averageDiffSeconds[index]) * 1000,
}));
export const DEMO_AVERAGE_COUNT = 5;
