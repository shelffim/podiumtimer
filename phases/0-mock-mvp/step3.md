# Step 3: api-mock

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (핵심 규칙 R1·R2·R6, "실행 상태", "서버 액션", "API 라우트", "mock 모드")
- `/docs/ADR.md` (ADR-005, ADR-012)
- `/docs/PRD.md` ("정책", "흐름 E. 결제와 플랜")
- `/src/types/` 전체
- `/src/lib/timer.ts`, `/src/lib/billing.ts`, `/src/lib/validation.ts`, `/src/lib/messages.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

화면이 데이터를 읽고 쓰는 유일한 창구 `src/services/api`를 만든다. 이번 phase는 mock(브라우저 localStorage) 구현만 만든다. live 구현은 다음 phase에서 `live.ts`로 추가한다.

TDD: `mock.ts`, `device.ts`, `index.ts` 각각 옆에 `*.test.ts`를 먼저 만든다(TDD 가드).

### 1. `Api` 인터페이스 (`src/types/api.ts`에 추가)

```ts
export interface Api {
  // 로그인 (발표자)
  getUser(): Promise<User | null>
  signIn(next?: string): Promise<void>
  signOut(): Promise<void>
  // 타이머
  listTimers(): Promise<Result<Timer[]>>
  getTimer(id: string): Promise<Result<Timer>>
  createTimer(input: TimerInput): Promise<Result<Timer>>
  updateTimer(id: string, input: TimerInput): Promise<Result<Timer>>
  deleteTimer(id: string): Promise<Result<null>>
  // 기록
  listRecords(timerId: string): Promise<Result<RunRecord[]>>            // 시작 일시 최신순
  saveRecord(timerId: string, startedAt: number, segments: SegmentTime[]): Promise<Result<RunRecord>>
  deleteRecord(id: string): Promise<Result<null>>
  // 공유
  createShare(timerId: string): Promise<Result<{ code: string; seatCap: number }>>
  updateShareState(code: string, run: RunState, start?: { segments: Segment[] }): Promise<Result<null>>
  getShare(code: string): Promise<Result<ShareView>>                    // 로그인 불필요 (시청자)
  // 플랜·결제
  getPlanStatus(): Promise<Result<PlanStatus>>
  startCheckout(returnTo: string): Promise<Result<{ url: string }>>
  // 시각 보정
  getServerOffset(): Promise<number>
}
```

### 2. `src/services/api/mock.ts` — `export const mockApi: Api`

- 저장: localStorage 키 `mock:user`, `mock:timers`, `mock:records`, `mock:shares`, `mock:orders` (JSON). 다른 탭이 바뀐 값을 보도록 호출할 때마다 읽고 쓴다. JSON이 깨졌으면 빈 값으로 본다.
- 로그인: `signIn()`은 가짜 사용자 `{ id: 'mock-user', email: null }`를 저장한다. `signOut()`은 사용자만 지우고 데이터는 둔다. `getShare`를 뺀 모든 메서드는 사용자가 없으면 `UNAUTHENTICATED`.
- 규칙은 반드시 `src/lib` 함수로 한다:
  - `createTimer`: `timerInputSchema` 실패 → `INVALID_INPUT`. 플랜 = `planOf(computeExpiry(orders), Date.now())`. `checkTimerLimit({ isNew: true, ... })`가 코드를 돌려주면 그 코드. 통과하면 `crypto.randomUUID()` ID로 저장.
  - `updateTimer`: 없으면 `NOT_FOUND` → 입력 검사 → `checkTimerLimit({ isNew: false, ... })` → 저장.
  - `listTimers`: 만든 순서.
  - `deleteTimer`: 그 타이머의 기록과 공유도 함께 지운다.
  - `listRecords`·`saveRecord`: 타이머가 없으면 `NOT_FOUND`. `saveRecord`는 `recordInputSchema`로 검사하고 `{ id, timerId, startedAt, segments: [{ name, plannedMs, actualMs }] }`만 저장한다(넘어온 `diffMs`·`verdict`는 버린다).
  - `createShare`: 타이머가 없으면 `NOT_FOUND`. 코드 = `crypto.getRandomValues`로 만든 16바이트(128비트)를 base64url(패딩 없음)로. 타이머 ID와 무관해야 한다. `timerName`, `segments` = 타이머의 지금 값, `seatCap = LIMITS[지금 플랜].seats`, `state = createIdleRun()`, `rev = 0`.
  - `updateShareState`: 공유가 없으면 `NOT_FOUND`, `runStateSchema` 실패 → `INVALID_INPUT`. `state = run`, `rev = run.rev`로 덮어쓴다. `start`가 있으면 `segments`와 `seatCap`(지금 플랜)도 덮어쓴다. mock은 `rev` 조건부 업데이트를 흉내 내지 않는다(ARCHITECTURE "mock 모드").
  - `getShare`: 로그인 없이 동작한다. 없으면 `NOT_FOUND`. `{ timerName, segments, seatCap, state, rev }`만 돌려준다(사용자 ID 제외).
  - `getPlanStatus`: `{ plan, expiresAt: computeExpiry(orders), timerCount }`.
  - `startCheckout(returnTo)`: mock의 "가짜 결제"다. 주문 `{ id: crypto.randomUUID(), paidAt: Date.now() }`를 추가하고 `{ url: '/billing/success?returnTo=' + encodeURIComponent(safeReturnTo(returnTo)) }`를 돌려준다.
  - `getServerOffset`: `0` (mock은 기기 시계 그대로).
- 모든 메서드는 Promise를 돌려준다(live와 같은 모양).

### 3. `src/services/api/device.ts` — `export const device`

두 모드가 함께 쓰는 기기 저장소다 (ARCHITECTURE R6: 실행 상태는 발표자 기기의 localStorage).

```ts
export const device: {
  loadRun(timerId: string): LocalRun | null      // 키 run:{timerId}. 모양이 깨졌으면 null
  saveRun(timerId: string, local: LocalRun): void
  clearRun(timerId: string): void
  loadNickname(): string | null                  // 키 nickname
  saveNickname(nickname: string): void
  getClientId(): string                          // 키 clientId. 없으면 crypto.randomUUID()로 만들어 저장
  hasJoined(code: string): boolean               // 이 공유 코드로 입장한 적이 있는지 (시청자 새로고침 자동 재입장용)
  markJoined(code: string): void
}
```

- `LocalRun` 모양 검사가 필요하면 `src/lib/validation.ts`에 `localRunSchema`를 추가해도 된다(테스트도 함께).
- localStorage 접근 예외(사생활 모드 등)는 삼키고 기능만 빠지게 한다. 화면이 죽으면 안 된다.

### 4. `src/services/api/index.ts`

```ts
export type DataMode = 'mock' | 'live'
export function resolveDataMode(value: string | undefined): DataMode   // 'live'일 때만 live, 나머지는 mock
export const dataMode: DataMode                                        // resolveDataMode(process.env.NEXT_PUBLIC_DATA_MODE)
export const api: Api                                                  // 이번 phase는 mockApi
export { device }
```

- 서버 컴포넌트(루트 레이아웃)가 `dataMode`를 import하므로, 모듈을 불러오는 시점에 `window`·`localStorage`를 건드리지 마라. 저장소 접근은 메서드를 부를 때만 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 비로그인 `UNAUTHENTICATED`, 무료 4번째 타이머 `PLAN_LIMIT_TIMERS`, 가짜 결제 후 같은 요청 통과, 구간 11개 `PLAN_LIMIT_SEGMENTS`, 타이머 삭제 시 기록·공유도 삭제, 기록 최신순, 공유 코드가 22자 base64url이고 매번 다름, `getShare`는 로그아웃 상태에서도 동작하고 사용자 ID가 없음, `updateShareState`의 `start`가 구간·인원 한도를 덮어씀, `startCheckout`이 외부 `returnTo`를 `/timers`로 바꿈, `resolveDataMode`, 깨진 localStorage 값.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/services/api/`의 index·mock + 기기 저장 device)
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (규칙은 `src/lib` 함수로만, 문구는 messages)
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (Api 메서드 목록, localStorage 키, device 메서드)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `live.ts`나 live 분기용 빈 자리를 만들지 마라. 이유: live 구현은 다음 phase에서 서버 액션과 함께 만든다. 이번에는 `api`가 항상 mock을 가리킨다.
- Supabase·Polar SDK를 설치하거나 import하지 마라. 이유: 다음 phase 범위다.
- 한도·만료일·입력 검사 규칙을 mock 안에 다시 구현하지 마라. 이유: AGENTS.md CRITICAL, `src/lib` 함수 하나로만 한다.
- 공유 코드를 타이머 ID나 `Math.random`으로 만들지 마라. 이유: 추측할 수 없는 128비트 무작위 값이어야 한다.
- 시청자 닉네임을 `mock:shares`나 다른 공유 데이터에 저장하지 마라. 이유: 닉네임은 Presence에만 있다(ARCHITECTURE DB 스키마).
- 화면 컴포넌트를 만들지 마라. 이유: 다음 step 범위다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
