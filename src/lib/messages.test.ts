import { describe, expect, it } from "vitest";
import type { ErrorCode } from "@/types/api";
import { LIMITS } from "./billing";
import { MESSAGES, errorMessage, planLimitMessage, diffLabel, verdictWord } from "./messages";

describe("messages", () => {
  it("provides the app shell copy and structured policy drafts", () => {
    expect(MESSAGES.serviceName).toBe("Podium Timer");
    expect(MESSAGES.mockBadge).toBe("MOCK 모드 · 데이터는 이 브라우저에만 저장돼요");
    for (const policy of [MESSAGES.terms, MESSAGES.privacy]) {
      expect(policy.title).toMatch(/[가-힣]/u);
      expect(policy.sections.length).toBeGreaterThan(0);
      for (const section of policy.sections) {
        expect(section.title).toMatch(/[가-힣]/u);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        expect(section.paragraphs.every((text) => /[가-힣]/u.test(text) && !text.includes("@"))).toBe(true);
      }
    }
  });

  it("explains sandbox billing, extension and email requests in the terms", () => {
    const text = MESSAGES.terms.sections.flatMap((section) => section.paragraphs).join(" ");
    for (const phrase of ["만 14세", "Google", "$3.99", "자동 갱신", "만료일", "Polar", "테스트 결제", "실제로 청구되지 않아요", "환불", "탈퇴", "하단 문의 이메일", "데이터가 사라질 수 있어요"]) {
      expect(text).toContain(phrase);
    }
  });

  it("explains stored data, viewer presence, processors and deletion in privacy", () => {
    const text = MESSAGES.privacy.sections.flatMap((section) => section.paragraphs).join(" ");
    for (const phrase of ["이메일", "이름", "식별자", "타이머", "기록", "주문 ID", "결제 시각", "닉네임", "접속 표시", "실행 상태", "기기 식별값", "Supabase", "Vercel", "Polar", "탈퇴", "삭제", "하단 문의 이메일"]) {
      expect(text).toContain(phrase);
    }
  });

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
