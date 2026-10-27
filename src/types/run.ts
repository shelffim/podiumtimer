import type { Segment, SegmentResult } from "./timer";

export type RunStatus = "idle" | "running" | "finished" | "aborted";
export type RunState = {
  status: RunStatus;
  startedAt: number | null;
  transitions: number[];
  rev: number;
};
export type RunAction = { type: "start" | "next" | "undo" | "abort"; at: number };
export type TimerView = {
  segmentIndex: number;
  segmentRemainingMs: number;
  totalRemainingMs: number;
  progressMs: number;
  lastResult: SegmentResult | null;
};
export type LocalRun = { segments: Segment[]; run: RunState; shareCode: string | null };
