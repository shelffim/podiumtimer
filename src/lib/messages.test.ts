import { describe, expect, it } from "vitest";
import type { ErrorCode } from "@/types/api";
import { LIMITS, PASS_DAYS, PASS_PRICE_USD } from "./billing";
import { MESSAGES, errorMessage, planLimitMessage, diffLabel, verdictWord, planLabel, timerSummary, totalTimeLabel, segmentFieldLabel, segmentCountLabel, segmentUsageLabel, segmentPlaceholder, progressLabel, nextSegmentLabel, lastResultLabel, seatLabel, seatCountLabel, seatsFullLabel, savedLabel, viewerFullLabel, recordDateLabel, recordCountLabel, recordTotalsLabel, averageCaption, resultSummaryLabel } from "./messages";

describe("messages", () => {
  it("provides billing screen copy from shared product constants", () => {
    expect(MESSAGES.pricing.price).toBe(`$${PASS_PRICE_USD}`);
    expect(MESSAGES.pricing.period).toBe(`/ ${PASS_DAYS}일`);
    expect(MESSAGES.pricing.mockBuy).toBe(`가짜 결제 ($${PASS_PRICE_USD})`);
    expect(MESSAGES.pricing.buy).toBe(`30일권 구매 $${PASS_PRICE_USD}`);
    expect(MESSAGES.pricing.extend).toBe(`${PASS_DAYS}일 연장 $${PASS_PRICE_USD}`);
    expect(MESSAGES.pricing.note).toContain(`만료일에 ${PASS_DAYS}일을 더해요`);
    expect(MESSAGES.pricing.freeFeatures).toEqual([
      `타이머 ${LIMITS.free.timers}개`, `타이머마다 구간 ${LIMITS.free.segments}개`, `공유 동시 접속 ${LIMITS.free.seats}명 (발표자 포함)`, "기록·평균 제한 없음",
    ]);
    expect(MESSAGES.pricing.passFeatures).toEqual([
      Number.isFinite(LIMITS.pass.timers) ? `타이머 ${LIMITS.pass.timers}개` : "타이머 무제한", `타이머마다 구간 ${LIMITS.pass.segments}개`, `공유 동시 접속 ${LIMITS.pass.seats}명 (발표자 포함)`, "기록·평균 제한 없음",
    ]);
    expect(MESSAGES.billingSuccess).toMatchObject({ pending: "30일권 반영 중", delayed: "결제는 완료됐어요", backToTimers: "타이머 목록" });
  });
  it("formats records titles and Korean start dates with a padded 24-hour clock", () => {
    expect(recordCountLabel(4)).toBe("기록 4개");
    expect(recordTotalsLabel(613_000, 600_000)).toBe("실제 10:13 · 계획 10:00");
    expect(averageCaption(3)).toBe("같은 구간 구성의 기록 3개");
    expect(resultSummaryLabel(Date.UTC(2026, 9, 26, 12, 30), 600_000, 613_000)).toBe("10월 26일 (월) 21:30 · 계획 10:00 / 실제 10:13");
    expect(recordDateLabel(Date.UTC(2026, 9, 26, 5, 5))).toBe("10월 26일 (월) 14:05");
    expect(recordDateLabel(Date.UTC(2026, 9, 26, 15, 5))).toBe("10월 27일 (화) 00:05");
  });
  it("provides viewer copy and capacity labels", () => {
    expect(MESSAGES.viewer).toMatchObject({ nickname: "닉네임", enter: "입장", waiting: "발표자가 시작하면 자동으로 시작돼요", notFound: "존재하지 않는 링크예요", aborted: "발표가 중단되었어요", disconnected: "연결 끊김" });
    expect(viewerFullLabel(3)).toBe("인원이 가득 찼어요 (3/3)");
    expect(viewerFullLabel(10)).toBe("인원이 가득 찼어요 (10/10)");
  });
  it("provides sharing labels and formats seat usage", () => {
    expect(seatLabel(2, 3)).toBe("접속 2/3명");
    expect(seatCountLabel(2, 3)).toBe("2/3");
    expect(MESSAGES.share).toMatchObject({ hostName: "발표자", hostSelf: "나 (발표자)", create: "공유 링크 만들기", copy: "복사", copied: "복사됨", full: "자리가 가득 찼어요", passSeats: "30일권은 10명까지 함께 볼 수 있어요", disconnected: "공유 연결 끊김" });
    expect(seatsFullLabel(true)).toBe("자리가 가득 찼어요 · 30일권은 10명까지 함께 볼 수 있어요");
    expect(seatsFullLabel(false)).toBe("자리가 가득 찼어요");
  });
  it("joins a saved record note with the new-link reminder only after sharing", () => {
    expect(MESSAGES.common.separator).toBe(" · ");
    expect(savedLabel(true)).toBe("기록에 저장했어요 · 다시 하면 새 공유 링크가 필요해요");
    expect(savedLabel(false)).toBe("기록에 저장했어요");
  });
  it("provides the presenter run controls and persistence messages", () => {
    expect(MESSAGES.run).toMatchObject({
      undo: "되돌리기", abort: "중단", abortConfirm: "발표를 중단할까요?",
      aborted: "발표를 중단했어요", restart: "다시 하기", records: "기록 보기",
      noSegments: "구간을 추가해야 시작할 수 있어요",
      saved: "기록에 저장했어요", saveFailed: "기록을 저장하지 못했어요", retrySave: "다시 저장",
      finished: "발표가 끝났어요", editSegments: "구간 고치기", next: "다음", finish: "종료",
    });
  });
  it("formats face labels using zero-based progress and the shared clock rounding", () => {
    expect(progressLabel(2, 7)).toBe("3 / 7");
    expect(progressLabel(0, 1)).toBe("1 / 1");
    expect(nextSegmentLabel("반대 입론")).toBe("다음 · 반대 입론");
    expect(nextSegmentLabel()).toBe("마지막 구간");
    expect(lastResultLabel("찬성 입론")).toBe("직전 구간 · 찬성 입론");
    expect(MESSAGES.timerFace).toMatchObject({ finishHint: "한 번 더 누르면 종료", firstSegment: "첫 구간", totalRemaining: "전체 남은 시간" });
    expect(Object.values(MESSAGES.results)).toEqual(["구간", "계획", "실제", "차이", "합계"]);
  });
  it("formats timer screen labels and Korean pass expiry dates", () => {
    expect(planLabel("free", null)).toBe("무료");
    expect(planLabel("pass", Date.UTC(2026, 10, 24, 15))).toBe("30일권 · 11월 25일까지");
    expect(timerSummary(2, 125_000)).toBe("2구간 · 합계 2:05");
    expect(totalTimeLabel(125_000)).toBe("합계 2:05");
    expect(segmentCountLabel(6)).toBe("구간 6개");
    expect(segmentUsageLabel(6, 10, 840_000)).toBe("6 / 10개 · 합계 14:00");
    expect(segmentUsageLabel(6, null, 840_000)).toBe("6개 · 합계 14:00");
    expect(segmentFieldLabel(0, "name")).toBe("구간 1 이름");
    expect(segmentFieldLabel(1, "clock")).toBe("구간 2 시간");
    expect(segmentFieldLabel(2, "reorder")).toBe("구간 3 순서 변경");
    expect(segmentFieldLabel(3, "remove")).toBe("구간 4 삭제");
    expect(segmentPlaceholder(0)).toBe("구간 1");
  });

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
    expect(planLimitMessage("PLAN_LIMIT_TIMERS", "free")).toBe(`무료 한도(타이머 ${LIMITS.free.timers}개)에 도달했어요. 30일권은 타이머를 제한 없이 만들 수 있어요`);
    expect(planLimitMessage("PLAN_LIMIT_SEGMENTS", "free")).toBe(`무료 한도(구간 ${LIMITS.free.segments}개)에 도달했어요. 30일권은 타이머마다 구간 ${LIMITS.pass.segments}개까지 저장할 수 있어요`);
    expect(planLimitMessage("PLAN_LIMIT_SEGMENTS", "pass")).toBe(`구간은 ${LIMITS.pass.segments}개까지 넣을 수 있어요`);
    expect(planLimitMessage("PLAN_LIMIT_TIMERS", "pass")).toBe("타이머는 제한 없이 만들 수 있어요");
  });

  it.each([[12_000, "0:12 늦음"], [-8_000, "0:08 빠름"], [-1_001, "정시"], [12_500, "0:13 늦음"], [-1_000, "정시"], [0, "정시"], [1_000, "정시"],
    [1_499, "정시"], [1_500, "0:02 늦음"], [-1_500, "0:02 빠름"]] as const)(
    "labels %i ms as %s", (diffMs, expected) => expect(diffLabel(diffMs)).toBe(expected),
  );

  it("never shows a one-second late or early label", () => {
    for (let diffMs = -3_000; diffMs <= 3_000; diffMs += 50) {
      expect(diffLabel(diffMs)).not.toMatch(/^0:0[01] /);
    }
  });

  it("labels every verdict", () => {
    expect(verdictWord("late")).toBe("늦음");
    expect(verdictWord("early")).toBe("빠름");
    expect(verdictWord("on_time")).toBe("정시");
  });
});
