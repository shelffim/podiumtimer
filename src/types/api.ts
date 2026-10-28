import type { RunState } from "./run";
import type { ShareView } from "./share";
import type { RunRecord, Segment, SegmentTime, Timer, TimerInput } from "./timer";

export type ErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "PLAN_LIMIT_TIMERS" | "PLAN_LIMIT_SEGMENTS" | "INVALID_INPUT";
export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };
export type Plan = "free" | "pass";
export type PlanStatus = { plan: Plan; expiresAt: number | null; timerCount: number };
export type User = { id: string; email: string | null };

export interface Api {
  getUser(): Promise<User | null>;
  signIn(next?: string): Promise<void>;
  signOut(): Promise<void>;
  listTimers(): Promise<Result<Timer[]>>;
  getTimer(id: string): Promise<Result<Timer>>;
  createTimer(input: TimerInput): Promise<Result<Timer>>;
  updateTimer(id: string, input: TimerInput): Promise<Result<Timer>>;
  deleteTimer(id: string): Promise<Result<null>>;
  listRecords(timerId: string): Promise<Result<RunRecord[]>>;
  saveRecord(timerId: string, startedAt: number, segments: SegmentTime[]): Promise<Result<RunRecord>>;
  deleteRecord(id: string): Promise<Result<null>>;
  createShare(timerId: string): Promise<Result<{ code: string; seatCap: number }>>;
  updateShareState(code: string, run: RunState, start?: { segments: Segment[] }): Promise<Result<null>>;
  getShare(code: string): Promise<Result<ShareView>>;
  getPlanStatus(): Promise<Result<PlanStatus>>;
  startCheckout(returnTo: string): Promise<Result<{ url: string }>>;
  getServerOffset(): Promise<number>;
}
