import { describe, expect, it } from "vitest";
import { PASS_DAYS, PASS_MS, PASS_PRICE_USD, LIMITS, computeExpiry, planOf, checkTimerLimit } from "./billing";

describe("billing", () => {
  it("defines the pass and plan limits", () => {
    expect(PASS_DAYS).toBe(30);
    expect(PASS_MS).toBe(2_592_000_000);
    expect(PASS_PRICE_USD).toBe(3.99);
    expect(LIMITS).toEqual({ free: { timers: 3, segments: 10, seats: 3 }, pass: { timers: Infinity, segments: 30, seats: 10 } });
  });

  it("returns no expiry without orders and extends from payment for the first order", () => {
    expect(computeExpiry([])).toBeNull();
    expect(computeExpiry([{ paidAt: 0 }])).toBe(PASS_MS);
    expect(computeExpiry([{ paidAt: 1_000 }])).toBe(1_000 + PASS_MS);
  });

  it("extends from expiry before expiry and from payment after expiry", () => {
    expect(computeExpiry([{ paidAt: 0 }, { paidAt: PASS_MS - 1 }])).toBe(2 * PASS_MS);
    expect(computeExpiry([{ paidAt: 0 }, { paidAt: PASS_MS }])).toBe(2 * PASS_MS);
    expect(computeExpiry([{ paidAt: 0 }, { paidAt: PASS_MS + 1 }])).toBe(2 * PASS_MS + 1);
  });

  it("sorts payments without mutating the input", () => {
    const orders = [{ paidAt: 4 * PASS_MS }, { paidAt: 0 }, { paidAt: 1_000 }];
    orders.forEach(Object.freeze);
    Object.freeze(orders);
    expect(computeExpiry(orders)).toBe(5 * PASS_MS);
    expect(orders.map((order) => order.paidAt)).toEqual([4 * PASS_MS, 0, 1_000]);
  });

  it.each([[null, 0, "free"], [1_000, 999, "pass"], [1_000, 1_000, "free"], [1_000, 1_001, "free"]] as const)(
    "classifies expiry %s at %i as %s", (expiry, now, expected) => {
      expect(planOf(expiry, now)).toBe(expected);
    },
  );

  it.each([
    ["free", 2, 10, true, null],
    ["free", 3, 10, true, "PLAN_LIMIT_TIMERS"],
    ["free", 3, 11, true, "PLAN_LIMIT_TIMERS"],
    ["free", 2, 11, true, "PLAN_LIMIT_SEGMENTS"],
    ["free", 99, 10, false, null],
    ["free", 99, 11, false, "PLAN_LIMIT_SEGMENTS"],
    ["pass", 99, 30, true, null],
    ["pass", 99, 31, true, "PLAN_LIMIT_SEGMENTS"],
  ] as const)("checks %s with %i timers and %i segments (new: %s)", (plan, existingTimerCount, segmentCount, isNew, expected) => {
    expect(checkTimerLimit({ plan, existingTimerCount, segmentCount, isNew })).toBe(expected);
  });
});
