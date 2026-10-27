import type { ErrorCode, Plan } from "@/types/api";
import type { Verdict } from "@/types/timer";
import { LIMITS } from "./billing";
import { formatDuration, verdictOf } from "./timer";

export const MESSAGES = {
  errors: {
    UNAUTHENTICATED: "로그인이 필요해요",
    NOT_FOUND: "찾을 수 없어요",
    PLAN_LIMIT_TIMERS: `무료 한도(타이머 ${LIMITS.free.timers}개)에 도달했어요`,
    PLAN_LIMIT_SEGMENTS: `무료 한도(구간 ${LIMITS.free.segments}개)에 도달했어요`,
    INVALID_INPUT: "입력을 확인해 주세요",
  } satisfies Record<ErrorCode, string>,
  planLimits: {
    passTimers: "타이머는 제한 없이 만들 수 있어요",
    passSegments: `구간은 ${LIMITS.pass.segments}개까지 넣을 수 있어요`,
  },
  verdicts: {
    late: "늦음",
    early: "빠름",
    on_time: "정시",
  } satisfies Record<Verdict, string>,
  validation: {
    invalidInput: "입력을 확인해 주세요",
    nameRequired: "이름을 입력해 주세요",
    timerNameTooLong: "타이머 이름은 60자까지 입력해 주세요",
    segmentNameTooLong: "구간 이름은 40자까지 입력해 주세요",
    segmentIdRequired: "구간 식별자를 확인해 주세요",
    clockFormat: "시간은 분:초 형식으로 입력해 주세요",
    durationRange: "구간 시간은 5초부터 3시간까지 정수로 입력해 주세요",
    segmentLimit: `구간은 ${LIMITS.pass.segments}개까지 넣을 수 있어요`,
    nicknameLength: "닉네임은 1자부터 20자까지 입력해 주세요",
    recordSegmentsRequired: "기록할 구간이 하나 이상 필요해요",
    nonnegativeInteger: "시간은 0 이상의 정수로 입력해 주세요",
  },
} as const;

export function errorMessage(code: ErrorCode): string {
  return MESSAGES.errors[code];
}

export function planLimitMessage(code: "PLAN_LIMIT_TIMERS" | "PLAN_LIMIT_SEGMENTS", plan: Plan): string {
  if (plan === "free") return MESSAGES.errors[code];
  return code === "PLAN_LIMIT_TIMERS" ? MESSAGES.planLimits.passTimers : MESSAGES.planLimits.passSegments;
}

export function diffLabel(diffMs: number): string {
  const verdict = verdictOf(diffMs);
  return verdict === "on_time" ? verdictWord(verdict) : `${formatDuration(diffMs)} ${verdictWord(verdict)}`;
}

export function verdictWord(verdict: Verdict): string {
  return MESSAGES.verdicts[verdict];
}
