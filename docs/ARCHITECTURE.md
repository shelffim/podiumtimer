# 아키텍처

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router, 최신 안정 버전) + TypeScript strict | |
| 스타일 | Tailwind CSS | |
| 인증 | Supabase Auth — Google만 | 시청자는 인증 없음 |
| DB | Supabase Postgres (서울 리전) | 테이블 4개 |
| 서버 DB 쓰기 | supabase-js (서버, 비밀 키) | 트랜잭션·DB 함수 없이 조건부 업데이트와 기본 키·유니크 제약으로 충돌을 막음 |
| 실시간 | Supabase Realtime — 공개 Broadcast 채널 + Presence | 상태 내용이 아니라 "바뀌었음" 신호만 보냄 |
| 결제 | Polar (sandbox) | 30일권($3.99) 1회 결제 상품 하나 |
| 배포 | Vercel CLI (함수 리전: 서울), Supabase CLI(마이그레이션) | mock 단계부터 배포 |
| 입력 검사 | zod | 화면과 서버가 같은 스키마 사용 |
| 그래프 | `div`로 직접 그림 | 차트 라이브러리 없음 |
| 테스트 | Vitest + React Testing Library | DB 통합 테스트·E2E는 하지 않음 |

## 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx                        랜딩
│   ├── layout.tsx                      mock 모드면 "MOCK 모드" 배지 (서버에서 렌더)
│   ├── error.tsx, not-found.tsx
│   ├── timers/                         발표자 화면 + actions.ts(서버 액션)
│   ├── s/[code]/                       시청자 화면
│   ├── pricing/, billing/success/, account/ (+ actions.ts), terms/, privacy/
│   ├── auth/callback/route.ts          Google 로그인 콜백
│   └── api/
│       ├── time/route.ts               서버 시각
│       ├── share/[code]/route.ts       시청자용 공유 상태 조회
│       ├── billing/checkout/route.ts   Polar 결제창 생성
│       └── billing/webhook/route.ts    Polar 웹훅
├── components/                         타이머 화면, 타임라인 바, 구간 편집기, 결과 표, 평균 그래프, 공유 시트
├── types/                              timer.ts, run.ts, share.ts, billing.ts
├── lib/
│   ├── timer/                          reduceRun, computeTimer, buildResult, verdictOf (순수 함수)
│   ├── stats/                          averageRecords (순수 함수)
│   ├── billing/                        computeExpiry, planOf, LIMITS
│   ├── seats/                          admit (Presence 입장 판정)
│   ├── validation/                     타이머·구간·닉네임·공유 상태 검사 (zod)
│   ├── time/                           서버 시각 보정
│   └── messages.ts                     한국어 문구 모음
├── services/
│   ├── api/                            화면이 부르는 유일한 데이터 창구: index.ts · live.ts · mock.ts
│   ├── supabase/                       server(쿠키 세션) · admin(비밀 키) · browser(Realtime 전용)
│   ├── polar.ts
│   └── realtime.ts                     live: Supabase Broadcast·Presence · mock: BroadcastChannel
└── proxy.ts                            live: 세션 갱신 + 보호 경로 리다이렉트
supabase/migrations/                    테이블, 제약, RLS
scripts/sync-env.sh                     .env.local의 live 키를 Vercel 환경변수로 등록
```

테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다. `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `types/`는 TDD 가드 대상이 아니다.

## 패턴
- 페이지(`page.tsx`)는 얇은 Server Component 껍데기다. 데이터를 읽고 쓰는 화면(목록, 편집, 실행, 기록, 시청, 요금제, 계정)은 Client Component로 만들고 `src/services/api`로 읽는다. mock 데이터가 브라우저에 있어서 Server Component에서 데이터를 읽지 않는다.
- 화면 코드는 `src/services/api`와 `src/services/realtime`의 인터페이스만 부른다. 구현은 mock과 live 두 개이고 `NEXT_PUBLIC_DATA_MODE`로 고른다.
- 규칙 계산(시간·판정·실행 상태 전이·평균·입력 검사·한도·만료일·입장 판정)은 `src/lib`의 순수 함수 하나로만 한다. 발표자 화면·시청자 화면·서버·mock이 같은 함수를 쓴다.
- live 모드의 쓰기는 서버 액션과 API 라우트에서만 한다. 서버는 로그인 사용자와 소유권을 확인한 뒤 비밀 키로 쓴다. 읽기는 쿠키 세션 클라이언트로 자기 행만 읽는다. 브라우저는 DB에 쓰지 못한다.
- DB 접근은 supabase-js 하나다. DB 함수(RPC)·트랜잭션·직접 DB 연결은 쓰지 않는다. 동시성은 한 번의 조건부 업데이트와 기본 키·유니크 제약으로 막는다.

## 데이터 흐름

```
Host UI → lib/timer 리듀서 → localStorage (구간 스냅샷 + 실행 상태)
   │
   ├─(공유 중) 저장 한 번에 하나, 최신 상태만
   │    └→ server action updateShareState → Postgres (rev 조건부 저장)
   │                                          └── 저장 후 Broadcast changed {rev}
   │                                              채널 share:{code} (public)
   └─(완주) server action saveRecord → records

Guest UI → GET /api/share/{code} → lib/timer (local)
           ↑ Broadcast 힌트 + 10초 재조회 + 화면 복귀·재접속

Polar ──(webhook: order.paid)──→ /api/billing/webhook → orders insert (주문 ID 중복 무시)
```

1. **발표자 조작**: 버튼·키보드·탭 → 리듀서가 실행 상태 갱신(보정된 시각) → 발표자 화면에 즉시 반영 → localStorage 저장 → 공유 중이면 최신 상태를 서버 액션으로 저장 → 서버가 `changed` 신호.
2. **시청자 동기화**: 채널 구독 → 상태 조회 → `computeTimer`로 매 프레임 계산. 신호·10초 주기·화면 복귀 때 다시 조회.
3. **기록**: 마지막 구간 종료 → `saveRecord`로 구간 스냅샷과 실제 시간 저장.
4. **결제**: 요금제 → `/api/billing/checkout` → Polar 결제창 → 웹훅 → `orders` 저장 → 결제 완료 화면이 확인 후 원래 화면으로.

## 상태 관리
- 서버 상태: DB(`timers`, `records`, `shares`, `orders`). 화면은 Client Component에서 `services/api`로 읽고, 바꾼 뒤 다시 읽는다. 클라이언트 캐시 라이브러리는 쓰지 않는다.
- 타이머 화면 값: 저장하지 않는다. 구간 스냅샷 + 실행 상태 + 현재 시각으로 매번 계산한다.
- 발표자 클라이언트: localStorage `run:{timerId}` = `{ segments(시작 때 복사), run, shareCode }`, sessionStorage `run-active:{timerId}`(같은 탭 복원 판단), 서버 시각 보정값, 저장 대기 중인 최신 상태 하나.
- 시청자 클라이언트: 최근 조회 결과, 닉네임·clientId(`localStorage`).
- React `useState`/`useReducer`로 충분하다. 전역 상태 라이브러리는 쓰지 않는다.

## 설계 규칙

| # | 규칙 | 이유 |
|---|---|---|
| R1 | **실행 상태는 발표자 기기에 둔다.** 시작 시각과 '다음'을 누른 시각들(`transitions`)만 localStorage에 저장하고, 화면 값은 항상 `computeTimer(구간, 실행 상태, 지금 시각)`으로 계산한다. 서버에는 완주한 기록과 공유 중인 상태만 저장한다 | 되돌리기, 늦게 들어온 시청자, 결과 표를 같은 함수로 처리. 서버 이벤트 기록·충돌 처리가 필요 없음 |
| R2 | **매초 시간을 보내지 않는다.** 발표자가 누를 때만 상태가 바뀌고, 각 화면이 스스로 시간을 계산한다 | 메시지가 거의 없고, 지연이 있어도 시간 값은 정확 |
| R3 | **업무 로직은 전부 TypeScript.** DB에는 테이블·제약·읽기 권한 규칙만 둔다 | 한 언어, 한 가지 DB 접근 방식으로 끝남 |
| R4 | **live 모드에서 쓰기는 전부 서버 코드가 한다.** 로그인 사용자와 소유권을 확인한 뒤 비밀 키로 쓴다. RLS는 자기 행 읽기만 허용한다 | 브라우저의 세션으로 DB에 직접 써서 한도 검사와 권한 검사를 우회할 수 없음 |
| R5 | **서버도 같은 함수로 상태를 검사한다.** `updateShareState`는 `lib/validation`과 `lib/timer`로 상태 모양과 전이(구간 수와 `transitions` 길이, 시각 순서)를 확인한다 | 상태 규칙이 한 곳에만 있음 |
| R6 | **공유 상태는 `rev`로 저장한다.** 상태가 바뀔 때마다 `rev`가 1씩 늘고, 서버는 저장된 `rev`보다 클 때만 쓰는 조건부 업데이트를 한다. 같거나 작으면 덮어쓰지 않고 성공으로 응답한다 | 응답 유실 재전송과 늦게 도착한 옛 요청을 같은 규칙으로 처리 |
| R7 | **타임스탬프는 발표자 기기 시계 + 서버 시각 보정값.** 페이지 진입·10초 재조회·화면 복귀·재접속 때 `/api/time`으로 보정한다. 새 보정값은 이후 생기는 타임스탬프에만 적용한다. 서버는 서버 시각보다 5초 넘게 미래인 시각을 거부한다 | 잠깐 끊긴 동안 누른 '다음'도 실제 누른 시각으로 기록 |
| R8 | **발표자 화면은 서버 응답을 기다리지 않고 먼저 바뀐다.** 공유 저장은 한 번에 하나만 보내고, 저장 중 상태가 또 바뀌면 끝난 뒤 최신 상태 하나만 보낸다. 실패하면 최신 상태로 간격을 늘려 재시도한다 | 끊김 중에도 조작 가능, 저장 순서가 뒤집히지 않음 |
| R9 | **Realtime 메시지는 변경 힌트뿐이다.** `changed`를 받으면 서버에서 다시 읽는다. 10초마다, 화면 복귀·재접속 시에도 다시 읽는다. 조회는 한 번에 하나만 보내 응답 순서가 뒤집히지 않게 한다 | 신호 누락 복구. 공개 채널 메시지로 화면 상태를 바꾸지 않음 |
| R10 | **시청자는 채널을 먼저 구독하고 그다음 상태를 읽는다.** 그사이 받은 신호는 다시 읽어서 처리한다 | 들어오는 순간의 변경을 놓치지 않음 |
| R11 | **접속 인원 한도는 Presence 인원 수로 화면에서 검사한다.** 한도를 넘으면 늦게 들어온 순서대로 "인원 가득"을 보여주고 나간다. 발표자는 기기 수와 상관없이 1명 | 서버 강제는 하지 않음 (프로토타입에서 우회 가능성 감수) |
| R12 | **채널 이름 = 공유 코드.** 링크 하나가 발표 하나라서 채널도 발표 하나다. 재발급·채널 교체는 없다 | 지난 발표 복구·채널 교체 처리가 필요 없음 |
| R13 | **30일권 만료일은 저장하지 않고 `orders`에서 계산한다.** 웹훅은 `order.paid`만 처리하고 주문 ID 기본 키로 중복을 막는다 | 중복 웹훅에도 결과가 같고, 계산이 순수 함수 하나 |
| R14 | **공유 행은 링크를 만들 때 생기고, [시작]할 때 구간과 인원 한도를 덮어쓴다.** 링크 하나에 발표 하나 | 대기 중 편집 반영, 진행 중 플랜 만료에도 한도 유지 |
| R15 | **[시작]할 때 구간을 실행 상태에 복사한다.** 실행 화면·공유·기록은 이 복사본만 쓴다. 진행 중에 타이머를 고쳐도 그 발표에는 반영되지 않는다 | 편집 잠금 없이 진행 중 편집과 결과가 어긋나지 않음 |
| R16 | **화면 코드는 `src/services/api`만 부른다.** R4·R5·R6·R13의 서버 규칙은 live 구현에만 해당한다 | live로 바꿀 때 화면 코드를 고치지 않음 |

## DB 스키마

```
timers   id · user_id · name · segments jsonb · created_at · updated_at
records  id · user_id · timer_id (fk, on delete cascade) · started_at · segments jsonb · created_at
shares   code (pk) · user_id · timer_id (fk, on delete cascade) · timer_name · segments jsonb
         seat_cap · state jsonb · rev int (default 0) · created_at · updated_at
orders   id (pk = Polar order id) · user_id · paid_at
```

- `timers.segments`: `[{ id, name, durationSec }]` (순서 = 배열 순서). `records.segments`: `[{ name, plannedMs, actualMs }]` — 발표 때 복사한 구간과 실제 시간.
- RLS: 네 테이블 모두 켠다. 브라우저·쿠키 세션은 **자기 행 읽기(select)만** 가능하다. insert/update/delete 정책은 두지 않는다. 비로그인 사용자용 공개 정책도 없다.
- 타이머를 지우면 그 타이머의 기록과 공유도 함께 지운다 (on delete cascade, 삭제 전 화면에서 확인).
- 시청자 정보(닉네임)는 DB에 저장하지 않는다. Presence에만 존재한다.
- `shares.rev`는 `state.rev`와 같은 값이다. 조건부 업데이트(`rev < 새 rev`)에 쓴다.
- `orders.paid_at`은 `order.paid` 웹훅의 결제 시각이다. 웹훅 수신 시각을 대신 쓰지 않는다.

## 인터페이스 (형태만)

```ts
// src/types/timer.ts
type Segment = { id: string; name: string; durationSec: number }
type Timer = { id: string; name: string; segments: Segment[] }

// src/types/run.ts
type RunState = {
  status: 'idle' | 'running' | 'finished' | 'aborted'
  startedAt: number | null       // 서버 보정 epoch ms
  transitions: number[]          // i번째 값 = i번째 구간에서 '다음'을 누른 시각
  rev: number                    // 상태가 바뀔 때마다 +1
}
type LocalRun = { segments: Segment[]; run: RunState; shareCode: string | null }
type Verdict = 'late' | 'early' | 'on_time'
type SegmentResult = { name: string; plannedMs: number; actualMs: number; diffMs: number; verdict: Verdict }
type TimerView = {
  segmentIndex: number
  segmentRemainingMs: number     // 음수면 초과
  totalRemainingMs: number       // 음수면 초과
  progressMs: number             // 타임라인 바 진행 위치 (PRD '페이스 표시와 계산')
  lastResult: SegmentResult | null
}

// src/lib/timer — 순수 함수, 발표자·시청자·서버·mock이 공유
reduceRun(run: RunState, action: { type: 'start' | 'next' | 'undo' | 'abort'; at: number }, segmentCount: number):
  { ok: true; run: RunState } | { ok: false }
computeTimer(segments: Segment[], run: RunState, nowMs: number): TimerView
buildResult(segments: Segment[], run: RunState): SegmentResult[]
verdictOf(diffMs: number): Verdict      // |diff| <= 1000 → on_time

// src/lib/stats
averageRecords(timer: Timer, records: Record[]): AverageRow[] | null
  // 구간 개수와 이름 순서가 현재 타이머와 같은 기록만, 2개 이상일 때

// src/lib/billing
type Order = { id: string; paidAt: number }
computeExpiry(orders: Order[]): number | null
  // paidAt 오름차순으로 만료 = max(만료, paidAt) + 30 × 86,400,000ms. 없으면 null
planOf(expiry: number | null, nowMs: number): 'free' | 'pass'
LIMITS = { free: { timers: 3, segments: 10, seats: 3 }, pass: { timers: Infinity, segments: 30, seats: 10 } }

// src/lib/seats
admit(presence: PresenceEntry[], clientId: string, seatCap: number): boolean
  // 발표자 1자리를 빼고 시청자를 (joinedAt, clientId) 순으로 seatCap − 1명까지
```

### 실행 상태 규칙 (`reduceRun`이 판단)
- `start`: `idle`에서만. `startedAt = at`.
- `next`: `running`에서만. `transitions`에 `at`을 붙인다. 마지막 구간에서는 화면이 '한 번 더 누르기' 확인 후에만 보내고, 그러면 `finished`가 된다.
- `undo`: `running`이고 `transitions`가 있을 때만. 마지막 값을 뺀다. 연달아 누르면 하나씩 거꾸로 취소한다.
- `abort`: `running`에서만. `aborted`가 된다.
- 바뀔 때마다 `rev + 1`. `finished`·`aborted` 이후에는 바뀌지 않는다.
- 구간 i 실제 시간 = `transitions[i] − (i === 0 ? startedAt : transitions[i − 1])`.
- 남은 시간은 초 단위 올림으로 표시해서 "0:00"이 되는 순간이 계획 시간과 맞게 한다. 0을 지나면 경과 초를 "-0:05"처럼 표시한다.

### 실행 상태 복원
- [시작]하면 localStorage `run:{timerId}`에 구간 복사본과 실행 상태를, sessionStorage에 `run-active:{timerId}`를 쓴다.
- 실행 화면이 열릴 때 `running` 상태가 있으면:
  - sessionStorage 표시가 있으면(같은 탭의 새로고침·앱 전환) 그대로 이어서 진행한다.
  - 없으면(닫았다가 다시 엶) "진행 중인 발표가 있어요"와 [이어서 하기] [중단]을 보여준다.
- `finished` 상태로 열리면 결과 표를 보여준다. [다시 하기]는 실행 상태를 `idle`로 되돌리고 `shareCode`를 지운다.

### 서버 액션 (`src/app/**/actions.ts`, 모두 로그인 사용자 확인. 쓰기는 소유권 확인 후 비밀 키)

| 함수 | 결과 |
|---|---|
| `listTimers()` · `getTimer(id)` | 자기 타이머 (쿠키 세션 읽기) |
| `createTimer(input)` | 입력 검사 → 타이머 개수를 센 뒤 플랜 한도(구간 수 포함) 검사 → 생성. 타이머 또는 `PLAN_LIMIT_TIMERS` · `PLAN_LIMIT_SEGMENTS` · `INVALID_INPUT` |
| `updateTimer(id, input)` | 입력·한도 검사 → 저장. 타이머 또는 `NOT_OWNER` · `PLAN_LIMIT_SEGMENTS` · `INVALID_INPUT` |
| `deleteTimer(id)` | 기록·공유 포함 삭제 |
| `listRecords(timerId)` · `deleteRecord(id)` | 자기 기록 |
| `saveRecord(timerId, startedAt, results)` | 입력 검사 → 타이머 소유 확인 → 저장. 타이머가 없으면 `TIMER_NOT_FOUND` |
| `createShare(timerId)` | 소유 확인 → 128비트 무작위 코드 → `shares` 생성(이름·구간, `seat_cap` = 지금 플랜, `state` = idle, `rev` = 0) → `{ code, seatCap }` |
| `updateShareState(code, run, start?: { segments })` | 소유 확인 → 상태 검사(R5·R7) → 저장된 `rev` ≥ 새 `rev`면 저장하지 않고 성공 → 저장된 상태가 `finished`·`aborted`면 `SHARE_ENDED` → `rev < 새 rev` 조건부 업데이트. `start`가 있으면 `segments`와 `seat_cap`(지금 플랜)을 함께 덮어씀 → 저장 후 `changed` 전송 |
| `getPlanStatus()` | `orders`로 만료일 계산 → `{ plan, expiresAt, timerCount }` |

### 공유 저장 처리 (발표자)
- 화면은 저장을 기다리지 않는다. 저장 요청은 한 번에 하나만 보내고, 응답을 받으면 그사이 바뀐 최신 상태가 있을 때만 그것 하나를 보낸다.
- 실패하면 최신 상태로 간격을 늘려 재시도한다. 계속 실패하면 "공유 연결 안 됨 · 다시 시도" 버튼을 보인다. `INVALID_INPUT`·`SHARE_ENDED`는 재시도하지 않는다.
- 화면 복귀·재접속 때 최신 상태를 한 번 더 저장한다(같은 `rev`면 서버가 무시).
- Broadcast는 저장 뒤에 서버가 보낸다. 실패해도 저장을 되돌리지 않는다. 최종 복구 수단은 재조회다.

### API 라우트

| 경로 | 내용 |
|---|---|
| `GET /api/time` | `{ now }` — 서버 시각 보정용. `Cache-Control: no-store` |
| `GET /api/share/[code]` | 시청자용: `{ timerName, segments, seatCap, state, rev }`. admin 클라이언트로 그 코드의 행 하나만 읽는다. 없는 코드는 404. 사용자 ID·이메일 제외. `Cache-Control: no-store` |
| `POST /api/billing/checkout` | 로그인 필수. `{ returnTo }` → `{ url }`. returnTo는 결제 후 복귀용으로만 사용(사이트 안 경로만). 상품은 서버의 30일권 ID만, `external_customer_id` = 로그인 사용자 ID. successUrl = `/billing/success?returnTo=…` |
| `POST /api/billing/webhook` | 원본 본문 서명 검증 → `order.paid`만 처리 → 대상 상품 검사 → `external_customer_id`로 사용자 확인 → `orders` insert(같은 주문 ID면 이미 처리된 것으로 보고 200) → 200. 대상 외 정상 이벤트는 200으로 무시 |
| `GET /auth/callback` | Google 로그인 코드 교환. `next`는 사이트 안 경로만 |

### Realtime 계약
- 채널: `share:{code}` (공개)
- 서버 → 모두: `changed { rev }`.
- Presence: 키 = 기기별 무작위 clientId, 내용 = `{ nickname, role: 'host' | 'viewer', joinedAt }`. `joinedAt`은 서버 보정 시각(`lib/time`). 표시와 인원 계산용이며 권한 판단에는 쓰지 않는다.
- 메시지 내용은 믿지 않고 재조회 계기로만 쓴다. 1초 안에 온 여러 신호는 묶어 한 번 조회한다. 조회는 한 번에 하나만 보내고, 조회 중에 새 신호가 오면 끝난 뒤 한 번 더 조회한다. 받은 `rev`가 지금보다 클 때만 화면에 반영한다.
- 대기·진행·결과 화면이 보이는 동안 10초 간격으로 최신 상태를 읽는다. 화면이 숨겨진 동안 멈추고, 다시 보이면 즉시 조회한다. API 실패는 간격을 늘려 재시도하며 연결 상태를 표시한다. 이 재조회 때 `/api/time` 시각 보정도 갱신한다.
- 입장 판정: 시청자는 Presence가 바뀔 때마다 `admit`으로 자기 자리를 확인한다. 자리가 없으면 "인원이 가득 찼어요" 화면으로 바꾸고 채널을 떠난다. 발표자 화면은 한도를 넘어 들어왔다 나간 시청자 수를 세어 안내한다.
- Presence에 `role: 'host'`가 없으면 시청자 화면에 "발표자 연결 끊김 · 타이머는 계속 흘러요"를 표시한다.

### 결제 처리 규칙
- 30일권 활성 = `computeExpiry(orders)` > 지금. 만료일은 화면이 필요할 때마다 계산한다.
- 결제 완료 화면(`/billing/success`)은 2초 간격으로 최대 10회 `getPlanStatus`를 확인한다. 반영되면 returnTo로 보내고, 안 되면 "결제는 완료됐어요, 반영이 늦어지고 있어요" 후 계정 화면으로 보낸다.
- 웹훅에서 사용자를 찾지 못하면 성공 처리하지 않고 식별자만 로그에 남긴 뒤 500을 돌려준다(Polar 재시도).
- 환불은 Polar 대시보드에서 수동으로 한다. `order.refunded`는 처리하지 않는다(실서비스 전 보강).

### 에러 코드
화면 문구와 1:1로 연결한다 (`src/lib/messages.ts`).

`UNAUTHENTICATED` · `NOT_OWNER` · `TIMER_NOT_FOUND` · `SHARE_NOT_FOUND` · `SHARE_ENDED` · `SHARE_FULL`(화면 판정) · `PLAN_LIMIT_TIMERS` · `PLAN_LIMIT_SEGMENTS` · `INVALID_INPUT`

## 보안 규칙
- 모든 테이블 RLS를 켜고 기본 거부. 브라우저와 쿠키 세션은 자기 행 읽기만. 비로그인용 공개 정책은 없다.
- 비밀 키(`SUPABASE_SECRET_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`)는 서버 코드에서만 쓴다. `NEXT_PUBLIC_` 환경변수에 넣지 않는다. 코드에 키를 직접 쓰지 않는다. 비밀 키는 RLS를 우회하므로 서버 코드에서 사용자·소유권을 명시적으로 검사한다.
- admin 클라이언트(비밀 키)는 서버 액션의 쓰기, `/api/share/[code]` 조회, 결제 웹훅에서만 쓴다.
- 공유 코드는 128비트 무작위 값이며 타이머 ID와 별개다.
- 웹훅은 원본 본문으로 서명을 검증하고 (Standard Webhooks), 5분 넘은 요청은 거부한다.
- 결제 상품은 서버에 정해 둔 ID만 쓴다. 브라우저가 보낸 상품·가격은 무시한다. 사용자 구분은 `external_customer_id`로 하고 이메일로 찾지 않는다.
- `returnTo`(결제 후)와 `next`(로그인 후)는 `/`로 시작하는 사이트 안 경로만 허용한다 (`//`, 외부 URL 거부).
- Supabase Auth의 리다이렉트 허용 목록에 `https://*.vercel.app/**` 같은 넓은 와일드카드를 넣지 않는다. 운영 주소, 팀 이름이 들어간 미리보기 패턴, localhost만.
- 사용자 입력(타이머 이름, 구간 이름, 닉네임)은 React 기본 렌더링으로만 표시한다 (`dangerouslySetInnerHTML` 금지). `frame-ancestors 'none'` 헤더를 보낸다.
- 로그에 공유 코드·이메일을 남기지 않는다.

## 에러 처리 규칙
- 서버 액션과 API는 위 에러 코드로만 실패를 알린다. 화면은 코드별 한국어 문구를 보여준다.
- 연결 상태 표시: 연결됨 / 다시 연결 중 / 연결 안 됨. Realtime이 끊기면 간격을 늘려가며 재접속하고, 다시 연결되면 상태를 새로 읽는다.
- 발표자 공유 저장 실패는 위 "공유 저장 처리"를 따른다.
- `saveRecord`가 실패하면 결과 화면에 "다시 저장" 버튼을 보여준다. `TIMER_NOT_FOUND`면 "타이머가 삭제돼 기록을 저장하지 못했어요".
- 웹훅 처리 실패는 500을 돌려 Polar가 재시도하게 한다. 같은 주문의 재처리는 기간을 중복으로 만들지 않는다.
- `error.tsx`, `not-found.tsx`를 둔다. 시청자 페이지는 동적 렌더링한다.
- 환경변수는 실행할 때 검사한다 (`next build`가 키 없이도 성공해야 함).

## mock 모드
외부 계정 없이 앱 전체가 돌아가는 모드. 첫 배포, 화면 개발, 컴포넌트 테스트에 쓴다.

| 기능 | mock | live |
|---|---|---|
| 로그인 | "체험 계정으로 로그인" (가짜 사용자) | Google |
| 타이머·기록·공유·주문 저장 | 브라우저 localStorage | Supabase |
| 실시간 신호·접속 인원 | 같은 브라우저의 다른 탭끼리 (BroadcastChannel) | Supabase Realtime |
| 결제 | "가짜 결제" 버튼 → 주문 기록 추가 | Polar sandbox |
| 서버 시각 보정 | 기기 시계 그대로 | `/api/time` |
| 보호 경로 | 화면이 mock 로그인 여부를 보고 랜딩으로 보냄 | `proxy.ts` |

- 선택: `NEXT_PUBLIC_DATA_MODE=mock|live`. 값이 없으면 mock이라 키 없이도 빌드와 배포가 된다.
- mock일 때는 화면 위에 "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요" 배지를 띄운다. 배지는 루트 레이아웃(서버 컴포넌트)에서 그려서 서버가 내려주는 HTML에 들어가게 한다.
- 실행 상태 규칙, 판정, 입력 검사, 한도 계산, `computeExpiry`, 입장 판정은 mock과 live가 같은 코드를 쓴다. 다른 것은 저장과 전송뿐이다.
- mock은 서버의 조건부 업데이트·RLS·웹훅을 흉내 내지 않는다. 그 동작은 live 연동 단계에서 확인한다.

## 배포와 DB 반영
- 배포: `npm run deploy` = `vercel deploy --prod --yes`. `vercel`은 devDependency로 버전을 고정한다. 처음 실행하면 Vercel 프로젝트를 만들고 연결한다 (`.vercel/`은 커밋하지 않음). 인증은 사용자가 미리 `vercel login`을 하거나 `VERCEL_TOKEN`을 넣는다.
- DB 반영: `npm run db:push` = `supabase db push --dry-run`으로 적용될 마이그레이션을 먼저 출력한 뒤 `supabase db push`. `supabase`는 devDependency로 버전을 고정한다. 처음에는 `supabase link --project-ref $SUPABASE_PROJECT_REF`로 연결하고, 인증은 `SUPABASE_ACCESS_TOKEN`·`SUPABASE_DB_PASSWORD` 환경변수로 한다.
  - 마이그레이션은 추가만 한다. 이미 원격에 적용된 마이그레이션 파일을 고치지 않는다.
  - 원격 DB에 `supabase db reset`을 실행하지 않는다.
- **mock 단계부터 배포한다.** 순서:
  1. 화면 + `lib` + mock 데이터 → **1차 배포** (외부 계정 없이 동작)
  2. 1차 배포로 확정된 운영 주소를 `.env.local`의 `NEXT_PUBLIC_SITE_URL`에 기록한다. 이름이 겹치면 `podiumtimer.vercel.app`이 아닐 수 있으므로 CLI 출력에서 확인한 실제 주소를 쓴다.
     - 이 주소는 Supabase Auth의 Site URL·리다이렉트 허용 목록과 Polar 웹훅 주소(`<주소>/api/billing/webhook`)에 쓴다.
     - Google Cloud 콘솔의 OAuth 리다이렉트 URI에는 Vercel 주소가 아니라 Supabase 콜백 주소(`https://<project-ref>.supabase.co/auth/v1/callback`)를 넣는다.
  3. Supabase(로그인·DB·실시간) 연동 → `sync-env` → `npm run db:push` → **2차 배포** (`NEXT_PUBLIC_DATA_MODE=live`)
  4. Polar sandbox 결제 연동 → `sync-env` → 새 마이그레이션이 있으면 `npm run db:push` → **3차 배포**
- live 키는 `.env.local`에 두고 `scripts/sync-env.sh`가 Vercel 운영 환경변수로 등록한다. 키 값을 파일에서 바로 넘겨서 대화나 로그에 남지 않게 한다. `NEXT_PUBLIC_DATA_MODE`는 빌드할 때 코드에 박히므로 반드시 배포 전에 등록한다.
- 배포 확인: `NEXT_PUBLIC_SITE_URL`의 운영 주소가 200을 돌려준다. 2·3차 배포는 운영 페이지 HTML에 "MOCK 모드" 문구가 없어야 한다. 배포마다 생기는 고유 주소는 Vercel 기본 보호 설정 때문에 401이 날 수 있으므로 운영 주소로 확인한다.
- DB 반영 확인: `npx supabase migration list`에서 로컬과 원격 목록이 일치한다.

### 환경 변수 (`.env.example`에 이름만)

| 이름 | 용도 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `mock` \| `live`. 없으면 mock | 공개 |
| `NEXT_PUBLIC_SITE_URL` | 운영 주소. OAuth redirect, Polar successUrl | 공개 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 주소 | 공개 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 쿠키 세션·브라우저 클라이언트 | 공개 |
| `SUPABASE_SECRET_KEY` | admin 클라이언트 | 서버 전용 |
| `POLAR_ENVIRONMENT` | `sandbox` | 서버 전용 |
| `POLAR_ACCESS_TOKEN` | 체크아웃 생성 | 서버 전용 |
| `POLAR_WEBHOOK_SECRET` | 웹훅 서명 검증 | 서버 전용 |
| `POLAR_PRODUCT_ID` | 30일권 상품 ($3.99, 1회 결제) | 서버 전용 |
| `CONTACT_EMAIL` | 하단 문의 이메일 | 서버 |
| `SUPABASE_ACCESS_TOKEN` · `SUPABASE_PROJECT_REF` · `SUPABASE_DB_PASSWORD` | `npm run db:push` | CLI 전용 |
| `VERCEL_TOKEN` | (선택) 배포 인증 | CLI 전용 |

## 테스트 전략
- `npm test`(Vitest)는 외부 서비스·네트워크·Docker 없이 통과해야 한다 (작업 종료 훅이 매번 실행).
- 집중 대상: `lib/timer`(실행 상태 규칙, 정시 ±1초 경계, 되돌리기 연속, 마지막 구간 종료, 남은 시간 올림, 진행 위치가 구간 초과 시 블록 끝에서 멈춤, 결과 표), `lib/stats`(같은 구성만 평균), `lib/billing`(연장 이어 붙이기, 한도 경계), `lib/seats`(발표자 자리, joinedAt 순서), `lib/validation`, 서버 액션과 웹훅(Supabase·Polar는 목으로).
- 자동 검증 사례: 새로 만들 때 구간 수 한도, 만료 후 구간 11개 이상 저장 거부, 같은 `rev` 재전송은 덮어쓰지 않고 성공, 늦게 도착한 작은 `rev` 무시, 끝난 공유 갱신 거부(`SHARE_ENDED`), 시작 때 구간·인원 한도 덮어쓰기, 5초 넘게 미래인 시각 거부, `/api/share/[code]`의 404와 사용자 ID 미포함, 웹훅 서명 실패·오래된 요청 거부와 같은 주문 중복 무시.
- 화면 컴포넌트 테스트는 mock 어댑터로 돌린다: 0.5초 안 두 번째 '다음' 무시, 마지막 구간 3초 확인, 상단 바 탭은 '다음' 아님, 입력 칸에서 스페이스 꺼짐, 닫았다 다시 열면 "이어서 하기 / 중단".
- 손으로 확인하는 체크리스트: Google 로그인, 실시간 동기화(기기 2~3대), 인원 가득, Polar sandbox 결제 → 반영 → 원래 화면 복귀, 만료, 화면 꺼짐 방지, 스페이스바, 모바일 화면 탭.
- 실패 경로 수동 검증: Broadcast만 의도적으로 실패시켜 10초 재조회로 복구하는지, 발표자 연결을 끊었다 붙였을 때 시청자가 따라오는지, 저장 응답을 늦춰 순서가 뒤집혀도 최신 상태가 남는지, 진행 중 편집이 그 발표에 반영되지 않는지.
