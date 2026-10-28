import type { ErrorCode, Plan } from "@/types/api";
import type { Verdict } from "@/types/timer";
import { LIMITS, PASS_DAYS, PASS_PRICE_USD } from "./billing";
import { formatDuration, verdictOf } from "./timer";

export const MESSAGES = {
  serviceName: "Podium Timer",
  mockBadge: "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요",
  common: {
    back: "뒤로",
    cancel: "취소",
    separator: " · ",
  },
  landing: {
    headline: "구간마다, 계획보다 빨랐는지 늦었는지.",
    description: "발표와 토론을 구간으로 나눠 두면, 구간을 넘길 때마다 계획 대비 차이를 바로 보여줘요. 링크로 공유하면 여러 명이 같은 타이머를 봐요.",
    mockSignIn: "체험 계정으로 시작하기",
    googleSignIn: "Google로 시작하기",
    minimumAge: "만 14세 이상",
    consentLead: "계속하면",
    consentAnd: "과",
    consentTail: "에 동의하게 돼요",
    signInFailed: "로그인하지 못했어요. 다시 시도해 주세요",
    previewSegments: ["인사·소개", "문제 정의", "연구 방법", "결과", "결론", "질의응답"],
    features: [
      { title: "구간별 페이스", body: "[다음]을 누를 때마다 직전 구간이 몇 초 늦었는지, 빨랐는지 보여줘요." },
      { title: "링크로 공유", body: "시청자는 로그인 없이 닉네임만 넣고 같은 타이머를 봐요." },
      { title: "기록과 평균", body: "연습이 쌓이면 어느 구간에서 시간이 부족한지 평균으로 보여줘요." },
    ],
  },
  timers: {
    title: "내 타이머",
    free: "무료",
    pass: "30일권",
    buyPass: "30일권 구매",
    viewPass: "30일권 보기",
    signOut: "로그아웃",
    newTimer: "새 타이머",
    firstTimer: "첫 타이머 만들기",
    emptyTitle: "첫 타이머를 만들어 보세요",
    emptyDescription: "발표나 토론을 구간으로 나누고 구간마다 계획 시간을 적어요. 예: 찬성 입론 3:00",
    start: "시작",
    edit: "편집",
    records: "기록",
    loading: "불러오고 있어요",
    createTitle: "새 타이머",
    editTitle: "타이머 편집",
    timerName: "타이머 이름",
    namePlaceholder: "예: 토론 수업 2:2 — 기본소득",
    segments: "구간",
    segmentName: "이름",
    segmentClock: "시간",
    clockColumn: "시간 (m:ss)",
    clockPlaceholder: "3:00",
    reorder: "순서 변경",
    removeSegment: "삭제",
    addSegment: "구간 추가",
    save: "저장",
    saved: "저장했어요",
    rehearse: "바로 리허설 해보기",
    deleteTimer: "타이머 삭제",
    deleteConfirm: "타이머를 삭제할까요?",
    deleteDescription: "이 타이머의 기록과 공유 링크도 함께 사라져요",
    delete: "삭제",
    notFound: "타이머를 찾을 수 없어요",
    backToList: "목록으로",
  },
  run: {
    undo: "되돌리기",
    abort: "중단",
    abortConfirm: "발표를 중단할까요?",
    abortDescription: "중단한 발표는 기록되지 않아요",
    aborted: "발표를 중단했어요",
    finished: "발표가 끝났어요",
    restart: "다시 하기",
    records: "기록 보기",
    editSegments: "구간 고치기",
    noSegments: "구간을 추가해야 시작할 수 있어요",
    saved: "기록에 저장했어요",
    sharedRestart: "다시 하면 새 공유 링크가 필요해요",
    saveFailed: "기록을 저장하지 못했어요",
    retrySave: "다시 저장",
    startHint: "진행 중에는 Space(노트북) 또는 화면 탭(폰)으로 다음 구간으로 넘어가요",
    tapHint: "화면 아무 곳이나 탭하면 다음 구간",
    next: "다음",
    finish: "종료",
    keyHint: "또는",
    spaceKey: "Space",
  },
  share: {
    hostName: "발표자",
    hostSelf: "나 (발표자)",
    title: "공유",
    createHint: "시청자가 같은 타이머를 보려면 시작 전에 링크를 만들어요",
    linkHint: "링크를 보내면 시청자가 닉네임만 넣고 들어와요",
    create: "공유 링크 만들기",
    copy: "복사",
    copied: "복사됨",
    copyFailed: "복사하지 못했어요. 다시 시도해 주세요",
    seats: "접속",
    includesHost: "(발표자 포함)",
    full: "자리가 가득 찼어요",
    passSeats: `30일권은 ${LIMITS.pass.seats}명까지 함께 볼 수 있어요`,
    disconnected: "공유 연결 끊김",
  },
  viewer: {
    sharedTimer: "공유된 타이머",
    nickname: "닉네임",
    nicknamePlaceholder: "다른 사람에게 보이는 이름",
    nicknameHint: "로그인 없이 볼 수 있어요. 닉네임은 이 기기에 저장돼요",
    enter: "입장",
    waitingRoom: "대기실",
    waiting: "발표자가 시작하면 자동으로 시작돼요",
    notFound: "존재하지 않는 링크예요",
    notFoundHint: "링크 주소를 다시 확인해 주세요",
    fullHint: "자리가 비면 링크를 다시 열어 주세요",
    aborted: "발표가 중단되었어요",
    disconnected: "연결 끊김",
  },
  timerFace: {
    finishHint: "한 번 더 누르면 종료",
    lastResult: "직전 구간",
    firstSegment: "첫 구간",
    lastSegment: "마지막 구간",
    totalRemaining: "전체 남은 시간",
  },
  results: {
    segment: "구간",
    planned: "계획",
    actual: "실제",
    difference: "차이",
    total: "합계",
  },
  records: {
    average: "구간별 평균",
    averageEmpty: "기록이 2개 이상 쌓이면 구간별 평균을 보여줘요",
    averageActual: "평균 실제",
    averageDifference: "평균 차이",
    averageChart: "평균 차이 막대그래프",
    earlier: "← 빠름",
    later: "늦음 →",
    empty: "아직 기록이 없어요",
    emptyDescription: "마지막 구간까지 끝낸 발표가 여기에 쌓여요",
    delete: "이 기록 삭제",
    deleteConfirm: "이 기록을 삭제할까요?",
    deleteDescription: "삭제하면 평균에서도 빠져요",
    confirmDelete: "삭제",
  },
  pricing: {
    title: "요금제",
    headline: "혼자 연습은 무료, 함께 보는 행사는 30일권",
    description: `30일권은 계정 전체에 ${PASS_DAYS}일 동안 적용돼요. 자동 갱신은 없어요`,
    freePrice: "$0",
    price: `$${PASS_PRICE_USD}`,
    period: `/ ${PASS_DAYS}일`,
    current: "지금 쓰는 중",
    mockBuy: `가짜 결제 ($${PASS_PRICE_USD})`,
    buy: `30일권 구매 $${PASS_PRICE_USD}`,
    extend: `${PASS_DAYS}일 연장 $${PASS_PRICE_USD}`,
    freeFeatures: [
      `타이머 ${LIMITS.free.timers}개`,
      `타이머마다 구간 ${LIMITS.free.segments}개`,
      `공유 동시 접속 ${LIMITS.free.seats}명 (발표자 포함)`,
      "기록·평균 제한 없음",
    ],
    passFeatures: [
      Number.isFinite(LIMITS.pass.timers) ? `타이머 ${LIMITS.pass.timers}개` : "타이머 무제한",
      `타이머마다 구간 ${LIMITS.pass.segments}개`,
      `공유 동시 접속 ${LIMITS.pass.seats}명 (발표자 포함)`,
      "기록·평균 제한 없음",
    ],
    note: `이미 30일권이 있으면 만료일에 ${PASS_DAYS}일을 더해요. 만료돼도 타이머와 기록은 그대로예요. 결제는 Polar가 처리하고 영수증은 이메일로 보내드려요. 환불은`,
    noteTail: "을 확인해 주세요",
  },
  billingSuccess: {
    pending: "30일권 반영 중",
    pendingDescription: "결제를 확인하고 있어요. 몇 초면 끝나요",
    delayed: "결제는 완료됐어요",
    delayedDescription: "반영이 늦어지고 있어요. 잠시 뒤 타이머 목록에서 플랜을 확인해 주세요",
    backToTimers: "타이머 목록",
  },
  appError: {
    title: "문제가 생겼어요",
    retry: "다시 시도",
  },
  notFound: {
    title: "페이지를 찾을 수 없어요",
    home: "처음으로",
  },
  terms: {
    title: "이용약관",
    sections: [
      {
        title: "서비스 내용",
        paragraphs: ["Podium Timer는 발표·토론을 구간으로 나누고 계획 대비 실제 시간, 공유 화면과 기록을 보여주는 서비스예요. 이 약관은 프로토타입 초안이에요."],
      },
      {
        title: "계정과 이용 나이",
        paragraphs: ["만 14세 이상 이용할 수 있어요. 발표자는 Google 로그인으로 계정을 이용해요. 시청자는 로그인 없이 닉네임으로 참여해요."],
      },
      {
        title: "30일권과 테스트 결제",
        paragraphs: [
          `30일권은 $${PASS_PRICE_USD}이고 자동 갱신 없이 결제한 때부터 ${PASS_DAYS}일 동안 계정에 적용돼요. 이용권이 남아 있을 때 다시 사면 기존 만료일에 ${PASS_DAYS}일을 더해요.`,
          "Polar가 판매 대행과 결제 처리를 맡아요. 지금은 테스트 결제 단계라 실제로 청구되지 않아요.",
        ],
      },
      {
        title: "환불과 회원 탈퇴",
        paragraphs: [
          "환불은 하단 문의 이메일로 요청해 주세요. Polar를 통해 수동으로 처리해요. 환불해도 이용권은 자동으로 회수되지 않아요.",
          "회원 탈퇴도 하단 문의 이메일로 요청해 주세요. 계정과 저장된 데이터 삭제를 처리해요.",
        ],
      },
      {
        title: "프로토타입 안내",
        paragraphs: ["프로토타입이라 서비스가 중단되거나 데이터가 사라질 수 있어요. 중요한 기록은 따로 보관해 주세요."],
      },
      {
        title: "약관 변경",
        paragraphs: ["서비스가 바뀌면 약관을 고칠 수 있어요. 변경 내용과 적용 시점은 서비스에서 미리 안내해요."],
      },
    ],
  },
  privacy: {
    title: "개인정보처리방침",
    sections: [
      {
        title: "수집 항목과 이용 목적",
        paragraphs: [
          "발표자의 Google 계정 이메일·이름·식별자를 로그인과 계정 확인에 이용해요. 타이머와 발표 기록은 저장과 조회, 공유 화면 제공에 이용해요.",
          "결제는 Polar가 처리해요. 앱은 결제 정보로 주문 ID와 결제 시각만 저장하고 이용권 적용에 이용해요. 카드 정보는 앱에 저장하지 않아요.",
        ],
      },
      {
        title: "시청자 닉네임과 기기 저장",
        paragraphs: [
          "시청자 닉네임은 서버 DB에 저장하지 않고 접속 표시에만 써요.",
          "기기에는 발표를 이어가기 위한 실행 상태, 다시 입장할 때 쓰는 닉네임, 접속을 구분하는 기기 식별값과 입장 여부를 저장해요. 테스트용 MOCK 모드에서는 로그인·타이머·기록·공유·가짜 주문도 이 브라우저에만 저장해요.",
        ],
      },
      {
        title: "처리 위탁",
        paragraphs: ["Supabase에 인증·데이터 저장·실시간 접속 처리를, Vercel에 웹앱과 서버 운영을, Polar에 판매 대행과 결제 처리를 맡겨요."],
      },
      {
        title: "보관과 삭제",
        paragraphs: ["서비스 이용에 필요한 동안 정보를 보관해요. 탈퇴를 요청하면 계정과 저장된 개인정보를 삭제해요. 기기에 저장된 값은 브라우저의 사이트 데이터 삭제로 지울 수 있어요."],
      },
      {
        title: "문의",
        paragraphs: ["개인정보 확인·수정·삭제와 탈퇴 요청은 하단 문의 이메일로 보내 주세요. 이 방침은 프로토타입 초안이며 실서비스 전에 다시 검토해요."],
      },
    ],
  },
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
    freeTimers: "30일권은 타이머를 제한 없이 만들 수 있어요",
    freeSegments: `30일권은 타이머마다 구간 ${LIMITS.pass.segments}개까지 저장할 수 있어요`,
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
  if (plan === "free") {
    return `${MESSAGES.errors[code]}. ${code === "PLAN_LIMIT_TIMERS" ? MESSAGES.planLimits.freeTimers : MESSAGES.planLimits.freeSegments}`;
  }
  return code === "PLAN_LIMIT_TIMERS" ? MESSAGES.planLimits.passTimers : MESSAGES.planLimits.passSegments;
}

export function diffLabel(diffMs: number): string {
  const verdict = verdictOf(diffMs);
  return verdict === "on_time" ? verdictWord(verdict) : `${formatDuration(diffMs)} ${verdictWord(verdict)}`;
}

export function verdictWord(verdict: Verdict): string {
  return MESSAGES.verdicts[verdict];
}

export function planLabel(plan: Plan, expiresAt: number | null): string {
  if (plan === "free") return MESSAGES.timers.free;
  if (expiresAt === null) return MESSAGES.timers.pass;
  const date = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(expiresAt);
  return `${MESSAGES.timers.pass} · ${date}까지`;
}

export function timerSummary(segmentCount: number, plannedMs: number): string {
  return `${segmentCount}구간 · ${totalTimeLabel(plannedMs)}`;
}

export function totalTimeLabel(plannedMs: number): string {
  return `${MESSAGES.results.total} ${formatDuration(plannedMs)}`;
}

export function segmentCountLabel(count: number): string {
  return `${MESSAGES.timers.segments} ${count}개`;
}

export function segmentUsageLabel(count: number, limit: number | null, plannedMs: number): string {
  return `${limit === null ? count : `${count} / ${limit}`}개 · ${totalTimeLabel(plannedMs)}`;
}

const segmentFields = {
  name: MESSAGES.timers.segmentName,
  clock: MESSAGES.timers.segmentClock,
  reorder: MESSAGES.timers.reorder,
  remove: MESSAGES.timers.removeSegment,
};

export function segmentFieldLabel(index: number, field: keyof typeof segmentFields): string {
  return `${MESSAGES.timers.segments} ${index + 1} ${segmentFields[field]}`;
}

export function segmentPlaceholder(index: number): string {
  return `${MESSAGES.timers.segments} ${index + 1}`;
}

export function progressLabel(index: number, count: number): string {
  return `${index + 1} / ${count}`;
}

export function nextSegmentLabel(name?: string): string {
  return name === undefined ? MESSAGES.timerFace.lastSegment : `다음 · ${name}`;
}

export function lastResultLabel(name: string): string {
  return `${MESSAGES.timerFace.lastResult} · ${name}`;
}

export function seatCountLabel(used: number, cap: number): string {
  return `${used}/${cap}`;
}

export function seatLabel(used: number, cap: number): string {
  return `${MESSAGES.share.seats} ${seatCountLabel(used, cap)}명`;
}

export function seatsFullLabel(showPass: boolean): string {
  return showPass ? `${MESSAGES.share.full}${MESSAGES.common.separator}${MESSAGES.share.passSeats}` : MESSAGES.share.full;
}

export function savedLabel(shared: boolean): string {
  return shared ? `${MESSAGES.run.saved}${MESSAGES.common.separator}${MESSAGES.run.sharedRestart}` : MESSAGES.run.saved;
}

export function viewerFullLabel(cap: number): string {
  return `인원이 가득 찼어요 (${cap}/${cap})`;
}

export function recordCountLabel(count: number): string {
  return `${MESSAGES.timers.records} ${count}개`;
}

export function recordTotalsLabel(actualMs: number, plannedMs: number): string {
  return `${MESSAGES.results.actual} ${formatDuration(actualMs)} · ${MESSAGES.results.planned} ${formatDuration(plannedMs)}`;
}

export function averageCaption(count: number): string {
  return `같은 구간 구성의 기록 ${count}개`;
}

export function resultSummaryLabel(startedAt: number, plannedMs: number, actualMs: number): string {
  return `${recordDateLabel(startedAt)} · ${MESSAGES.results.planned} ${formatDuration(plannedMs)} / ${MESSAGES.results.actual} ${formatDuration(actualMs)}`;
}

export function recordDateLabel(startedAt: number): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23", timeZone: "Asia/Seoul",
  }).formatToParts(startedAt);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("month")} ${part("day")}일 (${part("weekday")}) ${part("hour")}:${part("minute")}`;
}
