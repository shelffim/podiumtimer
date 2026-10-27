import type { ErrorCode, Plan } from "@/types/api";
import type { Verdict } from "@/types/timer";
import { LIMITS, PASS_DAYS, PASS_PRICE_USD } from "./billing";
import { formatDuration, verdictOf } from "./timer";

export const MESSAGES = {
  serviceName: "Podium Timer",
  mockBadge: "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요",
  footer: {
    contact: "문의 이메일",
    separator: "·",
  },
  landing: {
    description: "구간마다 계획보다 빨랐는지 늦었는지 알려주는 발표 타이머예요",
    mockSignIn: "체험 계정으로 로그인",
    googleSignIn: "Google로 로그인",
    minimumAge: "만 14세 이상 이용할 수 있어요",
    signInFailed: "로그인하지 못했어요. 다시 시도해 주세요",
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
    start: "시작",
    edit: "편집",
    records: "기록",
    loading: "불러오고 있어요",
    createTitle: "타이머 만들기",
    editTitle: "타이머 편집",
    timerName: "타이머 이름",
    segments: "구간",
    segmentName: "이름",
    segmentClock: "시간",
    clockPlaceholder: "3:00",
    moveUp: "위로",
    moveDown: "아래로",
    removeSegment: "삭제",
    addSegment: "구간 추가",
    save: "저장",
    saved: "저장했어요",
    rehearse: "바로 리허설 해보기",
    deleteTimer: "타이머 삭제",
    deleteConfirm: "타이머를 삭제할까요? 기록과 공유 링크도 함께 지워져요",
    notFound: "타이머를 찾을 수 없어요",
    backToList: "목록으로",
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

export function planLabel(plan: Plan, expiresAt: number | null): string {
  if (plan === "free") return MESSAGES.timers.free;
  if (expiresAt === null) return MESSAGES.timers.pass;
  const date = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(expiresAt);
  return `${MESSAGES.timers.pass} · ${date}까지`;
}

export function timerSummary(segmentCount: number, plannedMs: number): string {
  return `구간 ${segmentCount}개 · ${totalTimeLabel(plannedMs)}`;
}

export function totalTimeLabel(plannedMs: number): string {
  return `전체 ${formatDuration(plannedMs)}`;
}

export function segmentFieldLabel(index: number, field: "name" | "clock"): string {
  return `구간 ${index + 1} ${field === "name" ? MESSAGES.timers.segmentName : MESSAGES.timers.segmentClock}`;
}
