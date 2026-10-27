import type { ErrorCode, Plan } from "@/types/api";

export const PASS_DAYS = 30;
export const PASS_MS: number = PASS_DAYS * 24 * 60 * 60 * 1000;
export const PASS_PRICE_USD = 3.99;
export const LIMITS = {
  free: { timers: 3, segments: 10, seats: 3 },
  pass: { timers: Infinity, segments: 30, seats: 10 },
} as const;

export function computeExpiry(orders: { paidAt: number }[]): number | null {
  return [...orders].sort((a, b) => a.paidAt - b.paidAt).reduce<number | null>(
    (expiry, order) => Math.max(expiry ?? 0, order.paidAt) + PASS_MS,
    null,
  );
}

export function planOf(expiry: number | null, nowMs: number): Plan {
  return expiry !== null && expiry > nowMs ? "pass" : "free";
}

export function checkTimerLimit(input: {
  plan: Plan; existingTimerCount: number; segmentCount: number; isNew: boolean;
}): ErrorCode | null {
  const limits = LIMITS[input.plan];
  if (input.isNew && input.existingTimerCount >= limits.timers) return "PLAN_LIMIT_TIMERS";
  if (input.segmentCount > limits.segments) return "PLAN_LIMIT_SEGMENTS";
  return null;
}
