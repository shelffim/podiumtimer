export type Segment = { id: string; name: string; durationSec: number };
export type Timer = { id: string; name: string; segments: Segment[] };
export type TimerInput = { name: string; segments: Segment[] };
export type Verdict = "late" | "early" | "on_time";
export type SegmentTime = { name: string; plannedMs: number; actualMs: number };
export type SegmentResult = SegmentTime & { diffMs: number; verdict: Verdict };
export type RunRecord = { id: string; timerId: string; startedAt: number; segments: SegmentTime[] };
export type AverageRow = { name: string; plannedMs: number; actualMs: number; diffMs: number; verdict: Verdict };
