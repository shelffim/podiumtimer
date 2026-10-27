import { describe, expect, it } from "vitest";
import type { ErrorCode } from "@/types/api";
import { LIMITS } from "./billing";
import { MESSAGES, errorMessage, planLimitMessage, diffLabel, verdictWord } from "./messages";

describe("messages", () => {
  it("covers every error code with Korean copy", () => {
    const expected: Record<ErrorCode, string> = {
      UNAUTHENTICATED: "로그인이 필요해요",
      NOT_FOUND: "찾을 수 없어요",
      PLAN_LIMIT_TIMERS: `무료 한도(타이머 ${LIMITS.free.timers}개)에 도달했어요`,
      PLAN_LIMIT_SEGMENTS: `무료 한도(구간 ${LIMITS.free.segments}개)에 도달했어요`,
      INVALID_INPUT: "입력을 확인해 주세요",
    };
    for (const code of Object.keys(expected) as ErrorCode[]) expect(errorMessage(code)).toBe(expected[code]);
    expect(Object.values(MESSAGES.validation).every((text) => typeof text === "string" && /[가-힣]/u.test(text))).toBe(true);
  });

  it("describes the relevant plan limits without an infinite timer limit", () => {
    expect(planLimitMessage("PLAN_LIMIT_TIMERS", "free")).toBe(`무료 한도(타이머 ${LIMITS.free.timers}개)에 도달했어요`);
    expect(planLimitMessage("PLAN_LIMIT_SEGMENTS", "free")).toBe(`무료 한도(구간 ${LIMITS.free.segments}개)에 도달했어요`);
    expect(planLimitMessage("PLAN_LIMIT_SEGMENTS", "pass")).toBe(`구간은 ${LIMITS.pass.segments}개까지 넣을 수 있어요`);
    expect(planLimitMessage("PLAN_LIMIT_TIMERS", "pass")).toBe("타이머는 제한 없이 만들 수 있어요");
  });

  it.each([[12_000, "0:12 늦음"], [-8_000, "0:08 빠름"], [-1_001, "0:01 빠름"], [12_500, "0:13 늦음"], [-1_000, "정시"], [0, "정시"], [1_000, "정시"]] as const)(
    "labels %i ms as %s", (diffMs, expected) => expect(diffLabel(diffMs)).toBe(expected),
  );

  it("labels every verdict", () => {
    expect(verdictWord("late")).toBe("늦음");
    expect(verdictWord("early")).toBe("빠름");
    expect(verdictWord("on_time")).toBe("정시");
  });
});
