# Step 2: lib-rules

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("정책"의 플랜·결제·입력 범위, "결과와 기록"의 평균)
- `/docs/ARCHITECTURE.md` ("인터페이스 (형태만)", "공유 동기화"의 입장 판정·시각 보정, "보안 규칙"의 returnTo, "테스트")
- `/docs/ADR.md` (ADR-008, ADR-010, ADR-011)
- `/docs/UI_GUIDE.md` ("문구")
- `/src/types/timer.ts`, `/src/types/run.ts`, `/src/types/share.ts`, `/src/types/api.ts`
- `/src/lib/timer.ts`, `/src/lib/timer.test.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

규칙 계산용 순수 함수와 문구 파일을 `src/lib/`에 만든다. 파일마다 옆에 `*.test.ts`를 먼저 만든다(TDD 가드).

import 방향: `validation` → `messages` → `billing`, `timer`. `messages`가 `validation`을 import하면 안 된다(순환).

### 1. `src/lib/billing.ts`

```ts
export const PASS_DAYS = 30
export const PASS_MS: number                 // 30일(ms)
export const PASS_PRICE_USD = 3.99
export const LIMITS = {
  free: { timers: 3, segments: 10, seats: 3 },
  pass: { timers: Infinity, segments: 30, seats: 10 },
} as const
export function computeExpiry(orders: { paidAt: number }[]): number | null
export function planOf(expiry: number | null, nowMs: number): Plan
export function checkTimerLimit(input: {
  plan: Plan; existingTimerCount: number; segmentCount: number; isNew: boolean
}): ErrorCode | null
```

- `computeExpiry`: `paidAt` 오름차순으로 접는다. `만료 = max(만료 ?? 0, paidAt) + PASS_MS`. 주문이 없으면 `null`. 입력 순서와 상관없이 같은 결과.
- `planOf`: `expiry !== null && expiry > nowMs`면 `'pass'`.
- `checkTimerLimit`: `isNew && existingTimerCount >= LIMITS[plan].timers` → `PLAN_LIMIT_TIMERS`(먼저 검사), `segmentCount > LIMITS[plan].segments` → `PLAN_LIMIT_SEGMENTS`, 아니면 `null`. 저장(`isNew: false`)에는 타이머 수를 검사하지 않는다(만료 뒤에도 기존 타이머 편집 가능).

### 2. `src/lib/stats.ts`

```ts
export function averageRecords(timer: Timer, records: RunRecord[]): AverageRow[] | null
```

- 구성이 같은 기록만 쓴다: 구간 개수가 같고 구간 이름이 순서대로 정확히 같다(현재 `timer.segments` 기준).
- 같은 구성의 기록이 2개 미만이면 `null`.
- 행마다 `plannedMs` = 기록들의 계획 평균, `actualMs` = 실제 평균(둘 다 `Math.round`), `diffMs = actualMs − plannedMs`, `verdict = verdictOf(diffMs)`. 계획 + 차이 = 실제가 항상 맞게 한다.

### 3. `src/lib/seats.ts`

```ts
export function admit(presence: PresenceMember[], clientId: string, seatCap: number): boolean
export function seatUsage(presence: PresenceMember[], seatCap: number): { used: number; full: boolean }
```

- 발표자 자리는 기기 수와 상관없이 1자리다. 같은 `clientId`가 여러 번 있으면 하나로 본다(가장 이른 `joinedAt`).
- `admit`: `clientId`의 역할이 `host`면 `true`. 시청자는 `joinedAt` 오름차순(같으면 `clientId` 오름차순)으로 줄 세워 앞에서 `seatCap − 1`명 안이면 `true`. 목록에 없으면 `false`.
- `seatUsage`: `used = 1 + min(시청자 수, seatCap − 1)` (발표자가 목록에 없어도 1), `full = 시청자 수 >= seatCap − 1`.

### 4. `src/lib/time.ts`

```ts
export function computeOffset(serverNow: number, requestedAt: number, receivedAt: number): number
// offset = serverNow + (receivedAt − requestedAt) / 2 − receivedAt
```

### 5. `src/lib/messages.ts`

모든 화면 문구를 모으는 파일이다. 짧은 존댓말("~해요")만 쓴다. 이 step에서는 아래만 만들고, 화면 step마다 필요한 문구를 이 파일에 추가한다.

```ts
export const MESSAGES = { ... } as const
export function errorMessage(code: ErrorCode): string
export function planLimitMessage(code: 'PLAN_LIMIT_TIMERS' | 'PLAN_LIMIT_SEGMENTS', plan: Plan): string
export function diffLabel(diffMs: number): string          // "0:12 늦음" · "0:08 빠름" · "정시"
export function verdictWord(verdict: Verdict): string      // "늦음" · "빠름" · "정시"
```

- 에러 코드마다 문구가 있어야 한다 (예: `UNAUTHENTICATED` "로그인이 필요해요", `NOT_FOUND` "찾을 수 없어요", `INVALID_INPUT` "입력을 확인해 주세요").
- `planLimitMessage`: 무료면 "무료 한도(타이머 3개)에 도달했어요", "무료 한도(구간 10개)에 도달했어요". 30일권이면 "구간은 30개까지 넣을 수 있어요"처럼 그 플랜에 맞게 쓴다. 숫자는 `LIMITS`에서 가져온다.
- `diffLabel`: `verdictOf`와 `formatDuration`을 쓴다. 정시면 시간 없이 "정시".
- 입력 검사 문구(이름 비어 있음, 길이 초과, `m:ss` 형식 오류, 5초~3시간 범위, 닉네임 길이)를 `MESSAGES.validation`에 둔다.

### 6. `src/lib/validation.ts`

```ts
export const TIMER_NAME_MAX = 60
export const SEGMENT_NAME_MAX = 40
export const NICKNAME_MAX = 20
export const SEGMENT_MIN_SEC = 5
export const SEGMENT_MAX_SEC = 3 * 60 * 60
export const segmentSchema        // { id: 1자 이상, name: trim 후 1~40자, durationSec: 정수 5~10800 }
export const timerInputSchema     // { name: trim 후 1~60자, segments: segmentSchema[] (0개 허용, 최대 LIMITS.pass.segments) }
export const runStateSchema       // RunState 모양 (status 4종, startedAt number|null, transitions number[], rev 0 이상 정수)
export const recordInputSchema    // { startedAt: number, segments: SegmentTime[] 1개 이상, ms는 0 이상 정수 }
export function parseClock(text: string): number | null
export function sanitizeNickname(raw: string): string
export const nicknameSchema
export function safeReturnTo(value: string | null | undefined, fallback?: string): string
```

- 스키마의 에러 메시지는 `MESSAGES.validation`의 문구를 쓴다. 화면이 zod issue의 `path`와 `message`로 필드 아래에 바로 보여줄 수 있게 한다.
- `parseClock`: 앞뒤 공백을 지운 뒤 `^\d+:[0-5]\d$`만 받는다. 초 단위 정수를 돌려준다. 범위 검사는 하지 않는다(스키마가 한다).
  예: `"3:00" → 180`, `"125:00" → 7500`, `"0:04" → 4`, `"3:0" → null`, `"180" → null`, `"3:60" → null`.
- `sanitizeNickname`: 제어 문자와 보이지 않는 서식 문자(`/[\p{Cc}\p{Cf}]/gu`)를 지우고 앞뒤 공백을 지운다. `nicknameSchema`는 정리한 값이 코드 포인트 기준 1~20자인지 본다. 중복은 허용한다.
- `safeReturnTo`: `/`로 시작하고 `//`·`/\`로 시작하지 않으며 제어 문자가 없을 때만 그대로 돌려준다. 아니면 `fallback`(기본 `/timers`). 외부 URL(`https://…`)은 거부한다.

테스트에 반드시 넣을 것: 만료일 연장(만료 전 재구매는 만료일 + 30일, 만료 후 재구매는 결제일 + 30일, 순서 섞인 입력), 한도 경계(무료 타이머 2개 → 통과, 3개 → `PLAN_LIMIT_TIMERS`, 구간 10 → 통과, 11 → `PLAN_LIMIT_SEGMENTS`, 새로 만들 때 구간 수 포함, `isNew: false`는 타이머 수 무시), 같은 구성만 평균, 입장 판정(발표자 여러 기기 = 1자리, 무료 3자리에서 시청자 3번째 거절, `joinedAt` 같을 때 순서), 입력 검사 경계값(60/61자, 40/41자, 4/5초, 10800/10801초, 닉네임 공백·제어 문자), `safeReturnTo`의 `//evil.com`·`https://evil.com` 거부, 모든 `ErrorCode`에 문구 존재.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/lib/`의 billing·stats·seats·validation·time·messages)
   - ADR 기술 스택을 벗어나지 않았는가? (입력 검사는 zod)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 파일과 export 이름)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/lib`에서 `Date.now()`, `window`, `localStorage`, 네트워크를 쓰지 마라. 이유: 순수 함수여야 서버·mock·화면이 같은 결과를 낸다.
- 만료일을 저장하는 값이나 함수를 만들지 마라. 이유: ADR-010, 만료일은 주문에서 매번 계산한다.
- 한도 숫자(3, 10, 30 등)를 `LIMITS` 밖에 다시 쓰지 마라. 이유: 규칙이 두 군데 있으면 어긋난다.
- 공유 링크 만들기 횟수를 제한하는 규칙을 만들지 마라. 이유: PRD 정책상 제한이 없다.
- 영어 문구나 반말 문구를 넣지 마라. 이유: 한국어만, "~해요" 말투가 규칙이다.
- `src/lib/timer.ts`의 동작을 바꾸지 마라. 이유: step 1 테스트가 고정한 규칙이다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
