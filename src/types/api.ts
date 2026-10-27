export type ErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "PLAN_LIMIT_TIMERS" | "PLAN_LIMIT_SEGMENTS" | "INVALID_INPUT";
export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };
export type Plan = "free" | "pass";
export type PlanStatus = { plan: Plan; expiresAt: number | null; timerCount: number };
export type User = { id: string; email: string | null };
