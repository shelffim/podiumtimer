# Step 1: timer-core

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("타이머 동작", "페이스 표시와 계산", "흐름 F. 발표 상태")
- `/docs/ARCHITECTURE.md` ("실행 상태", "인터페이스 (형태만)", "테스트")
- `/docs/ADR.md` (ADR-004, ADR-005)
- `/package.json`, `/tsconfig.json`, `/vitest.config.ts` (step 0에서 만든 설정)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

타입과 실행 상태 순수 함수를 만든다. 발표자 화면·시청자 화면·mock·서버가 모두 이 함수만 쓴다.

TDD: 구현 파일보다 같은 폴더의 `*.test.ts`를 먼저 만든다. TDD 가드 훅이 테스트 없는 구현 파일 작성을 막는다(`src/types/`는 예외).

### 1. 타입 (`src/types/`)

```ts
// src/types/timer.ts
export type Segment = { id: string; name: string; durationSec: number }
export type Timer = { id: string; name: string; segments: Segment[] }
export type TimerInput = { name: string; segments: Segment[] }
export type Verdict = 'late' | 'early' | 'on_time'
export type SegmentTime = { name: string; plannedMs: number; actualMs: number }   // records.segments 한 줄
export type SegmentResult = SegmentTime & { diffMs: number; verdict: Verdict }
export type RunRecord = { id: string; timerId: string; startedAt: number; segments: SegmentTime[] }
export type AverageRow = { name: string; plannedMs: number; actualMs: number; diffMs: number; verdict: Verdict }

// src/types/run.ts
export type RunStatus = 'idle' | 'running' | 'finished' | 'aborted'
export type RunState = { status: RunStatus; startedAt: number | null; transitions: number[]; rev: number }
export type RunAction = { type: 'start' | 'next' | 'undo' | 'abort'; at: number }
export type TimerView = {
  segmentIndex: number; segmentRemainingMs: number; totalRemainingMs: number
  progressMs: number; lastResult: SegmentResult | null
}
export type LocalRun = { segments: Segment[]; run: RunState; shareCode: string | null }  // localStorage run:{timerId}

// src/types/share.ts
export type ShareView = { timerName: string; segments: Segment[]; seatCap: number; state: RunState; rev: number }
export type PresenceRole = 'host' | 'viewer'
export type PresenceMember = { clientId: string; nickname: string; role: PresenceRole; joinedAt: number }

// src/types/api.ts
export type ErrorCode = 'UNAUTHENTICATED' | 'NOT_FOUND' | 'PLAN_LIMIT_TIMERS' | 'PLAN_LIMIT_SEGMENTS' | 'INVALID_INPUT'
export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode }
export type Plan = 'free' | 'pass'
export type PlanStatus = { plan: Plan; expiresAt: number | null; timerCount: number }
export type User = { id: string; email: string | null }
```

`Api` 인터페이스는 step 3에서 `src/types/api.ts`에 추가한다. 지금 만들지 마라.

### 2. `src/lib/timer.ts`

```ts
export const ON_TIME_TOLERANCE_MS = 1000
export const STALE_RUN_MS = 12 * 60 * 60 * 1000

export function createIdleRun(): RunState
export function reduceRun(run: RunState, action: RunAction, segmentCount: number): RunState | null
export function isStaleRun(run: RunState, nowMs: number): boolean
export function computeTimer(segments: Segment[], run: RunState, nowMs: number): TimerView
export function buildResult(segments: Segment[], run: RunState): SegmentResult[]
export function toSegmentResult(time: SegmentTime): SegmentResult
export function verdictOf(diffMs: number): Verdict
export function totalPlannedMs(segments: Segment[]): number
export function formatClock(ms: number): string
export function isOvertime(ms: number): boolean
export function formatDuration(ms: number): string
```

핵심 규칙 (반드시 지켜라):

- **reduceRun**: 허용되지 않는 전이는 `null`을 돌려준다. 입력 객체를 바꾸지 않는다. 성공한 전이는 모두 `rev + 1`.
  - `start`: `idle`이고 `segmentCount >= 1`일 때만 → `running`, `startedAt = at`, `transitions = []`. 구간 0개면 `null`.
  - `next`: `running`일 때만 → `transitions`에 `at`을 붙인다. 붙인 뒤 길이가 `segmentCount`면 `finished`. (마지막 구간의 "한 번 더 누르기" 확인은 화면이 하고, 확인된 뒤에만 `next`를 보낸다.)
  - `undo`: `running`이고 `transitions`가 비어 있지 않을 때만 → 마지막 값을 뺀다. 연달아 가능하다.
  - `abort`: `running`일 때만 → `aborted`.
  - `createIdleRun()`은 `{ status: 'idle', startedAt: null, transitions: [], rev: 0 }`.
- **isStaleRun**: `running`이고 `nowMs - startedAt > STALE_RUN_MS`일 때만 `true`.
- **구간 i 실제 시간** = `transitions[i] − (i === 0 ? startedAt : transitions[i − 1])`. 계획 = `durationSec * 1000`.
- **verdictOf**: `|diff| <= 1000` → `on_time`, `diff > 1000` → `late`, `diff < -1000` → `early`.
- **computeTimer** (`nowMs`는 호출자가 넘긴 서버 보정 시각):
  - `idle`: `segmentIndex 0`, `segmentRemainingMs` = 첫 구간 계획(구간이 없으면 0), `totalRemainingMs` = 계획 합계, `progressMs 0`, `lastResult null`.
  - `running`: `i = transitions.length`, 구간 경과 = `max(0, nowMs − 구간 i 시작 시각)`.
    `segmentRemainingMs` = 계획 i − 구간 경과, `totalRemainingMs` = 계획 합계 − `max(0, nowMs − startedAt)`,
    `progressMs` = 구간 i의 계획상 시작 지점 + `min(구간 경과, 계획 i)` (구간을 넘겨 쓰면 그 블록 끝에서 멈춘다),
    `lastResult` = `i > 0`이면 구간 i−1의 결과, 아니면 `null`.
  - `finished`: 마지막 구간 기준으로 값을 고정한다. `segmentIndex` = 마지막 구간, `progressMs` = 계획 합계, `totalRemainingMs` = 계획 합계 − (마지막 전이 − `startedAt`), `lastResult` = 마지막 구간 결과.
  - `aborted`: 화면이 쓰지 않는다. `running`과 같은 방식으로 계산하되 `nowMs` 대신 마지막 전이 시각(없으면 `startedAt`)을 쓰고, 예외를 던지지 않는다.
- **buildResult**: 끝난 구간(`transitions` 개수만큼)의 결과를 순서대로 돌려준다. `idle`이면 `[]`.
- **formatClock** (남은 시간 표기): `s = Math.ceil(ms / 1000)`(−0은 0). `s >= 0`이면 `m:ss`, `s < 0`이면 `-m:ss`. 분은 59를 넘어도 그대로 쓴다.
  예: `180000 → "3:00"`, `179001 → "3:00"`, `179000 → "2:59"`, `1 → "0:01"`, `0 → "0:00"`, `-999 → "0:00"`, `-1000 → "-0:01"`, `-65000 → "-1:05"`, `7500000 → "125:00"`.
- **isOvertime**: `formatClock(ms)`가 마이너스를 보여줄 때만 `true` (빨간 숫자 판단에 쓴다).
- **formatDuration** (계획·실제·차이 표기): 절댓값을 가장 가까운 초로 반올림해 `m:ss`.
  예: `12400 → "0:12"`, `12500 → "0:13"`, `-8000 → "0:08"`, `1001 → "0:01"`.

테스트에 반드시 넣을 것: 상태 전이 표(허용/거부), `rev` 증가, 구간 0개 시작 거부, 연속 되돌리기, 마지막 구간 `next` → `finished`, 정시 경계(±1000 정시, ±1001 늦음/빠름), 남은 시간 올림 예시 전부, 진행 위치가 구간 초과 시 멈춤, 12시간 경계, `buildResult` 실제 시간 계산.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (타입은 `src/types/`, 로직은 `src/lib/`)
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 파일과 export한 함수 이름)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/lib/timer.ts`에서 `Date.now()`, `window`, `localStorage`를 쓰지 마라. 이유: 순수 함수여야 서버·mock·화면이 같은 결과를 낸다. 시각은 항상 인자로 받는다.
- 누적(전체) 차이 판정이나 계획 대비 위치를 계산하지 마라. 이유: PRD MVP 제외 사항이다.
- 일시정지 상태를 만들지 마라. 이유: PRD에 일시정지가 없다.
- 날짜·시간 라이브러리를 설치하지 마라. 이유: 직접 계산으로 충분하다.
- 문구("늦음" 등)를 이 파일에 쓰지 마라. 이유: 문구는 step 2의 `src/lib/messages.ts`에 모은다.
- 화면·서비스 파일을 만들지 마라. 이유: 다음 step 범위다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
