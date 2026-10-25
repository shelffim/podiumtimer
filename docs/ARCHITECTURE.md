# 아키텍처

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router, 최신 안정 버전) + TypeScript strict | |
| 스타일 | Tailwind CSS | |
| 인증 | Supabase Auth — Google만 | 참여자는 인증 없음 |
| DB | Supabase Postgres (서울 리전) | 테이블 4개 |
| 서버 DB 쓰기 | supabase-js (서버, 비밀 키) | 트랜잭션·DB 함수 없이 한 번의 조건부 업데이트와 유니크 제약으로 충돌을 막음 |
| 실시간 | Supabase Realtime — 공개 Broadcast 채널 + Presence | 이벤트 내용이 아니라 "바뀌었음" 신호만 보냄 |
| 결제 | Polar (sandbox) | 30일권 1회 결제 상품 하나 |
| 배포 | Vercel CLI (함수 리전: 서울), Supabase CLI(마이그레이션) | mock 단계부터 배포 |
| 입력 검사 | zod | 화면과 서버가 같은 스키마 사용 |
| QR | 브라우저에서 직접 생성하는 라이브러리 | 외부 QR 서비스 금지 (토큰 유출) |
| 그래프 | SVG 직접 작성 | 차트 라이브러리 없음 |
| 테스트 | Vitest + React Testing Library | DB 통합 테스트·E2E는 하지 않음 |

## 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx                        랜딩
│   ├── rooms/                          방장 화면 + actions.ts(서버 액션)
│   ├── j/[token]/                      참여자 화면
│   ├── pricing/, billing/success/, account/, terms/, privacy/
│   ├── auth/callback/route.ts          Google 로그인 콜백
│   └── api/
│       ├── time/route.ts               서버 시각
│       ├── j/[token]/route.ts          참여자용 상태 조회
│       ├── billing/checkout/route.ts   Polar 결제창 생성
│       └── billing/webhook/route.ts    Polar 웹훅
├── components/                         타이머 화면, 구간 편집기, 리포트, QR
├── types/                              room.ts, session.ts, billing.ts
├── lib/
│   ├── pace/                           applyEvent, computePace, buildReport (순수 함수)
│   ├── billing/                        computeProUntil, LIMITS, planOf
│   ├── validation/                     룸 입력 검사 (zod)
│   ├── time/                           서버 시각 보정
│   └── messages.ts                     한국어 문구 모음
└── services/
    ├── api/                            화면이 부르는 유일한 창구: live.ts · mock.ts
    ├── supabase/                       server/browser 클라이언트
    ├── polar.ts
    └── realtime.ts                     live: Supabase broadcast · mock: BroadcastChannel
supabase/migrations/                    테이블, 제약, RLS
scripts/sync-env.sh                     .env.local의 live 키를 Vercel 환경변수로 등록
```

## 패턴
- Server Components가 기본이다. 상호작용이 필요한 화면(타이머, 구간 편집기, 참여자 화면, 공유 패널)만 Client Component로 만든다.
- 화면 코드는 `src/services/api`의 인터페이스만 부른다. 구현은 mock과 live 두 개이고 `NEXT_PUBLIC_DATA_MODE`로 고른다.
- 규칙 계산(페이스, 이벤트 전이, 입력 검사, 한도, 만료일)은 `src/lib`의 순수 함수 하나로만 한다. 방장 화면·참여자 화면·서버·mock이 같은 함수를 쓴다.
- live 모드의 쓰기는 서버 액션과 API 라우트에서만 한다. 서버는 로그인 사용자와 소유권을 확인한 뒤 비밀 키로 쓴다. 브라우저는 자기 행 읽기만 한다.
- DB 접근은 supabase-js 하나다. DB 함수(RPC)·트랜잭션·직접 DB 연결은 쓰지 않는다. 동시성은 한 번의 조건부 업데이트와 유니크 제약으로 막는다.

## 데이터 흐름

```
Host UI → 메모리 직렬 큐 → Next.js server action → Postgres (eventId·seq 조건부 저장)
   └── pace engine (local)                         │
                                                  └── 저장 후 Broadcast changed {sessionId, seq}
                                                      채널 room:{shareToken} (public)
Guest UI → GET /api/j/{token}?observedSessionId=... → pace engine (local)
           ↑ Broadcast 힌트 + 10초 재조회 + 화면 복귀·재접속

Polar ──(webhook: order.paid · order.refunded)──→ /api/billing/webhook
                                               └──→ passes 병합 → pro_until 재계산
```

1. **방장 조작**: 버튼·키보드·탭 → 이벤트 생성(eventId, 보정된 시각) → 방장 화면에 즉시 반영 → 메모리 큐에서 한 건씩 서버 액션으로 전송 → 조건부 저장 → `changed` 신호.
2. **참여자 동기화**: 채널 구독 → 상태 조회 → `computePace`로 매 프레임 계산. 신호·10초 주기·화면 복귀 때 다시 조회.
3. **결제**: 요금제 → `/api/billing/checkout` → Polar 결제창 → 웹훅 → `passes` 병합 → `pro_until` 재계산 → 결제 완료 화면이 확인 후 원래 화면으로.

## 상태 관리
- 서버 상태: DB(`profiles`, `rooms`, `sessions`, `passes`). 관리 화면은 Server Component에서 읽는다.
- 타이머 화면 상태: 저장하지 않는다. `plan_snapshot` + `events` + 현재 시각으로 매번 계산한다.
- 방장 클라이언트: 미전송 이벤트 메모리 큐, 서버 시각 보정값, 알림 재생 기록. 기기에 저장하지 않는다.
- 참여자 클라이언트: 최근 조회 결과, `observedSessionId`(공유 토큰별 `sessionStorage`), 닉네임·clientId(`localStorage`).
- React `useState`/`useReducer`로 충분하다. 전역 상태 라이브러리는 쓰지 않는다.

## 설계 규칙

| # | 규칙 | 이유 |
|---|---|---|
| R1 | **세션은 이벤트 기록이다.** `start`·`next`·`undo`·`pause`·`resume`·`end`만 저장하고, 화면 상태는 항상 `computePace(계획, 이벤트들, 지금 시각)`으로 계산한다 | 취소, 일시정지, 늦게 들어온 참여자, 리포트를 같은 함수 하나로 처리 |
| R2 | **매초 시간을 보내지 않는다.** 방장이 버튼을 누를 때만 이벤트가 생기고, 각 화면이 스스로 시간을 계산한다 | 메시지가 거의 없고, 지연이 있어도 시간 값은 정확 |
| R3 | **업무 로직은 전부 TypeScript.** DB에는 테이블·제약·읽기 권한 규칙만 둔다 | 한 언어, 한 가지 DB 접근 방식으로 끝남 |
| R4 | **live 모드에서 쓰기는 전부 서버 코드가 한다.** 로그인 사용자와 소유권을 확인한 뒤 비밀 키로 쓴다 | 한도 검사와 권한 검사를 우회할 수 없음 |
| R5 | **서버도 같은 엔진으로 이벤트를 검사한다** (`applyEvent`) | 상태 전이 규칙이 한 곳에만 있음 |
| R6 | **이벤트마다 eventId(UUID)와 순번(seq)을 붙인다.** 같은 세션에 같은 eventId가 이미 있으면 내용이 같을 때 기존 성공을 반환하고, 다르면 `INVALID_EVENT`. 새 이벤트는 `last_seq`가 기대값일 때만 저장하는 조건부 업데이트로 기록한다 | 응답 유실에 따른 재전송과 다른 기기의 조작을 구분 |
| R7 | **이벤트 시각(`at`)은 방장 기기 시계 + 서버 시각 보정값.** 페이지 진입·10초 재조회·화면 복귀·재접속 때 `/api/time`으로 보정한다. 새 보정값은 이후 생성 이벤트에만 적용하고 큐에 있는 at은 바꾸지 않는다. 서버는 새 이벤트가 이전보다 이르거나 서버 시각보다 5초 넘게 미래이면 거부한다 | 잠깐 끊긴 동안 누른 '다음'도 실제 누른 시각으로 기록 |
| R8 | **방장 화면은 서버 응답을 기다리지 않고 먼저 바뀐다.** 메모리 FIFO 큐로 한 건씩 보내고, eventId·payload·expectedSeq를 고정해 재시도한다. 성공 확인 전에는 다음 이벤트를 보내지 않는다. 다른 기기와 실제로 충돌하면 큐를 비우고 서버 상태로 맞춘 뒤 "다른 기기의 기록으로 맞췄어요"를 안내한다 | 끊김 중에도 조작 가능 |
| R9 | **Realtime 메시지는 변경 힌트뿐이다.** `changed`를 받으면 서버에서 다시 읽는다. 10초마다, 화면 복귀·재접속 시에도 다시 읽는다. 조회는 한 번에 하나만 보내 응답 순서가 뒤집히지 않게 한다. 방장 화면도 같은 규칙 | 신호 누락 복구. 공개 채널 메시지로 상태·권한을 바꾸지 않음 |
| R10 | **참여자는 채널을 먼저 구독하고 그다음 상태를 읽는다.** 그사이 받은 신호는 다시 읽어서 처리한다 | 들어오는 순간의 이벤트를 놓치지 않음 |
| R11 | **접속 인원 한도는 Presence 인원 수로 화면에서 검사한다.** 한도를 넘으면 늦게 들어온 순서대로 "인원 가득"을 보여주고 나간다. 방장은 기기 수와 상관없이 1명 | 서버 강제는 하지 않음 (프로토타입에서 우회 가능성 감수) |
| R12 | **채널 이름 = 공유 토큰.** 링크 재발급은 DB의 토큰을 바꾸고 옛 채널에 `link_rotated`를 보낸다. 참여자는 옛 토큰의 API가 404임을 확인한 뒤 연결을 끊고 데이터를 지운다. 신호를 놓쳐도 재조회로 감지한다 | 가짜 끊김 신호를 따르지 않음 |
| R13 | **플랜 판정은 `profiles.pro_until`, 구매·환불 기록은 `passes`.** 웹훅은 주문을 병합해 저장한 뒤 그 계정의 전체 이용권으로 `pro_until`을 다시 계산한다. 결제 완료·계정 화면을 조회할 때도 다시 계산한다 | 중복·역순 웹훅에도 결과가 같고, 어긋나도 다음 계산에서 복구 |
| R14 | **세션은 [시작]할 때 만들고 계획과 인원 한도를 복사한다.** 룸당 진행 중 세션은 하나 (부분 유니크 인덱스) | 대기 중 편집 반영, 지난 리포트 보존, 진행 중 플랜 만료 처리 |
| R15 | **진행 중 편집 잠금은 `rooms.active_session_id`로 한다.** 시작할 때 설정하고 종료할 때 비운다. 룸 편집·삭제는 이 값이 비어 있을 때만 저장하는 조건부 쓰기다. 룸 생성 한도는 개수를 센 뒤 생성한다 (동시 생성으로 1개 넘는 드문 경우는 감수) | 트랜잭션 없이 편집·시작 경합을 막음 |
| R16 | **화면 코드는 `src/services/api`만 부른다.** R4·R13·R15의 서버 규칙은 live 구현에만 해당한다 | live로 바꿀 때 화면 코드를 고치지 않음 |

## DB 스키마

```
profiles  id(=auth.users) · pro_until timestamptz null · signup_ref null · created_at
rooms     id · owner_id · title · mode('presentation'|'debate') · speakers jsonb · segments jsonb
          tolerance_sec · alert_sec · share_token(unique) · active_session_id null · created_at · updated_at
sessions  id · room_id · owner_id · plan_snapshot jsonb · seat_cap · events jsonb · last_seq
          started_at · ended_at null · ended_reason('completed'|'stopped') null · peak_guests(default 0)
          부분 유니크 인덱스: (room_id) where ended_at is null   ← 룸당 진행 중 세션 1개
passes    id · user_id · polar_order_id(unique) · days(default 30) · paid_at null · refunded_at null
          purchase_source(default 'unknown')
```

- RLS: 네 테이블 모두 켠다. 브라우저는 **자기 행 읽기(select)만** 가능하다. insert/update/delete 정책은 두지 않는다.
- 룸을 지우면 그 룸의 세션(기록)도 함께 지운다 (on delete cascade, 삭제 전 화면에서 확인).
- 참여자 정보(닉네임)는 DB에 저장하지 않는다. Presence에만 존재한다.
- `rooms.active_session_id`는 시작할 때 설정하고 종료할 때 비운다. 값이 있는데 가리키는 세션이 이미 종료됐거나 없으면(저장 도중 실패) 방장이 룸을 열 때 비운다.
- `sessions.events` 안의 eventId 중복은 서버 코드에서 검사한다 (jsonb에는 유니크 제약을 걸 수 없음). 저장은 `last_seq = expectedSeq` 조건부 업데이트 한 번으로 `events`, `last_seq`, 종료 정보를 함께 쓴다.
- `passes.paid_at`은 `order.paid`의 이벤트 시각이다. 환불 웹훅이 먼저 오면 `paid_at`이 비어 있고 `refunded_at`이 있는 행을 만든다. `refunded_at`이 있는 행은 부분 환불이어도 기간 계산에서 뺀다. 주문 생성 시각이나 웹훅 수신 시각을 결제 시각으로 대신 쓰지 않는다.

## 인터페이스 (형태만)

```ts
// src/types/room.ts
type Mode = 'presentation' | 'debate'
type Speaker = { id: string; label: string }
type Segment = { id: string; name: string; durationSec: number
                 speakerId?: string; alertSec?: number; toleranceSec?: number }
type RoomPlan = { mode: Mode; segments: Segment[]; speakers: Speaker[]
                  toleranceSec: number; alertSec: number }

// src/types/session.ts
type EventType = 'start' | 'next' | 'undo' | 'pause' | 'resume' | 'end'
type EventInput = { eventId: string; at: number } & (
  | { type: Exclude<EventType, 'end'> }
  | { type: 'end'; reason: 'completed' | 'stopped' }
)
type SessionEvent = EventInput & { seq: number }   // at: 서버 보정된 epoch ms
type PaceState = {
  phase: 'waiting' | 'running' | 'paused' | 'ended'
  segmentIndex: number
  segmentRemainingMs: number      // 음수면 초과
  totalRemainingMs: number
  cumulativeDiffMs: number        // +면 늦음, -면 빠름 (PRD '페이스 표시와 계산')
  status: 'ahead' | 'on_track' | 'behind'
  perSpeakerDiffMs: Record<string, number>
  plannedPositionMs: number       // 타임라인 바: 계획상 지금 위치
  actualPositionMs: number        // 타임라인 바: 실제 위치
  alertDue: boolean
}

// src/lib/pace — 순수 함수, 방장·참여자·서버·mock이 공유
applyEvent(plan: RoomPlan, events: SessionEvent[], next: EventInput):
  { ok: true } | { ok: false; code: 'INVALID_EVENT' }
computePace(plan: RoomPlan, events: SessionEvent[], nowMs: number): PaceState
buildReport(plan: RoomPlan, events: SessionEvent[]): Report
  // Report: 구간별 { plannedMs, actualMs: number | null, diffMs: number | null,
  //                  state: 'done' | 'stopped' | 'skipped' },
  // endedReason, 전체 계획·진행한 구간 계획·실제 활성 시간, 최종 차이, 그래프 점 목록

// src/lib/billing
type PurchaseSource = 'room_limit' | 'segment_limit' | 'seat_limit' | 'pricing' | 'unknown'
type Pass = { polarOrderId: string; paidAt: number | null; days: number; refundedAt: number | null }
computeProUntil(passes: Pass[]): number | null
  // paidAt이 있고 refundedAt이 없는 이용권만 (paidAt, polarOrderId) 순으로 정렬.
  // 시작 = max(paidAt, 직전 종료), 끝 = 시작 + days × 86,400,000ms로 이어 붙임. 없으면 null.
planOf(proUntil: number | null, nowMs: number): 'free' | 'pro'
LIMITS = { free: { rooms: 3, segments: 6, seats: 3 }, pro: { rooms: Infinity, segments: 50, seats: 10 } }
```

### 이벤트 규칙 (`applyEvent`가 판단)
- `start`: 첫 이벤트로만. 취소 불가.
- `next`: 진행 중일 때만. 마지막 구간에서는 쓰지 않는다 (화면이 '한 번 더 누르기' 확인 후 `end`를 보냄).
- `undo`: 진행 중이고 직전 유효 전이가 `next`일 때만. 연달아 누른 `next`는 하나씩 거꾸로 취소 가능.
- `pause`: 진행 중일 때만. `resume`: 일시정지일 때만.
- `end`: 진행 중 또는 일시정지일 때. `reason` 필수. `completed`는 마지막 구간에서만, `stopped`는 어느 구간에서든 허용한다. `ended_at = at`, `ended_reason = reason`을 이벤트와 함께 저장한다. 이후 새 이벤트는 거부하되 이미 저장된 eventId의 동일 요청은 성공으로 응답한다.

### 서버 액션 (`src/app/rooms/**/actions.ts`, 모두 로그인 사용자와 소유자 확인)

| 함수 | 결과 |
|---|---|
| `createRoom(input)` | 입력 검사 → 룸 개수를 센 뒤 플랜 한도 검사 → 생성. 룸 또는 `PLAN_LIMIT_ROOMS` · `PLAN_LIMIT_SEGMENTS` · `INVALID_INPUT` |
| `updateRoom(id, input)` | 입력·한도 검사 → `active_session_id is null` 조건으로 저장. 룸 또는 `PLAN_LIMIT_SEGMENTS` · `ROOM_LOCKED` · `INVALID_INPUT` |
| `deleteRoom(id)` | `active_session_id is null` 조건으로 삭제(기록 포함). 진행 중이면 `ROOM_LOCKED` |
| `rotateShareToken(roomId)` | 새 토큰 저장 후 옛 채널에 `link_rotated` 전송 |
| `startSession(roomId, startEvent: EventInput)` | type=start만. 세션 행 생성(부분 유니크 인덱스로 룸당 하나) → `rooms.active_session_id` 설정 → `changed` 전송. 같은 eventId 재전송이면 종료된 세션이라도 기존 결과 반환. 다른 startEvent인데 진행 중 세션이 있으면 그 세션과 `alreadyRunning: true` 반환 |
| `appendEvent(sessionId, expectedSeq, event: EventInput, peakGuests?)` | eventId 중복 검사 → `applyEvent` 검사 → `last_seq = expectedSeq` 조건부 업데이트. `end`면 `ended_at`·`ended_reason`·`peak_guests`(0~seatCap−1)를 함께 저장하고 `rooms.active_session_id`를 비운다. `{ eventId, seq }` 또는 `SESSION_CONFLICT`(최신 상태 포함) · `INVALID_EVENT`. 저장 후 `changed` 전송 |
| `deleteSession(sessionId)` | 종료된 기록만 삭제. 진행 중이면 `ROOM_LOCKED` |

### 재전송·충돌 처리
- 소유권 확인 → eventId 조회 순서다. 이미 저장된 eventId이면 seq·현재 시각·종료 상태 검사보다 먼저 내용(type·at·reason)을 비교한다. 같으면 기존 성공, 다르면 `INVALID_EVENT`. 한 요청의 expectedSeq는 재시도 중 바꾸지 않는다.
- `startSession` 응답 전의 후속 조작도 메모리 큐에 보관하고, 세션 ID를 받은 뒤 순서대로 보낸다. 다른 시작이 먼저 반영됐다면(`alreadyRunning`) 큐를 비우고 그 세션으로 맞춘다.
- 성공 응답을 받은 eventId만 큐에서 뺀다. 서버 상태를 다시 읽었을 때 큐의 선두 이벤트가 이미 저장돼 있으면 빼고, 남은 이벤트를 화면에 적용한다. seq 비교는 반드시 sessionId와 함께 한다.
- 다른 기기와 실제로 충돌하면(`SESSION_CONFLICT`이고 큐의 이벤트가 서버에 없음) 큐를 비우고 서버 상태로 화면을 맞춘 뒤 "다른 기기의 기록으로 맞췄어요"를 띄운다. 새로고침·탭 닫기로 큐가 사라지는 한계는 감수한다.
- Broadcast는 저장 뒤에 보낸다. 실패해도 저장을 되돌리지 않는다. 최종 복구 수단은 재조회다.

### API 라우트

| 경로 | 내용 |
|---|---|
| `GET /api/time` | `{ now }` — 서버 시각 보정용. `Cache-Control: no-store` |
| `GET /api/j/[token]?observedSessionId=...` | 참여자용: `{ title, plan, activeSession, observedSession, seatCap }`. 각 세션은 `{ id, planSnapshot, events, lastSeq, seatCap, endedAt, endedReason }`. activeSession은 진행 중/일시정지 세션 또는 null, observedSession은 요청한 ID의 해당 룸 세션(종료 포함) 또는 null. ID를 생략하면 지난 세션은 주지 않음. 토큰을 먼저 검사하고 다른 룸의 세션은 반환하지 않음. 없는 토큰은 404. 방장 이메일·사용자 ID 제외. `Cache-Control: no-store` |
| `POST /api/billing/checkout` | 로그인 필수. `{ returnTo, purchaseSource }` → `{ url }`. returnTo는 복귀용으로만 사용. purchaseSource는 열거형 검사 후 Polar Checkout metadata의 `purchase_source`로 넣어 주문까지 전달. 누락·식별 불가는 unknown. 상품은 서버의 30일권 ID만, `external_customer_id` = 로그인 사용자 ID |
| `POST /api/billing/webhook` | 원본 본문 서명 검증 → 대상 상품·계정 검사 → 주문 병합 저장 → 전체 이용권으로 `pro_until` 재계산·저장 → 200. 실패는 500(Polar 재시도). 대상 외 정상 이벤트는 200으로 무시 |
| `GET /auth/callback` | Google 로그인 코드 교환. `next`는 사이트 안 경로만 |

### Realtime 계약
- 채널: `room:{shareToken}` (공개)
- 서버 → 모두: `changed { sessionId: string | null, seq: number | null }`, `link_rotated`. 룸 편집 등 세션 외 변경은 sessionId·seq가 null이다.
- Presence: 키 = 기기별 무작위 clientId, 내용 = `{ nickname, role: 'host' | 'guest', joinedAt }`. 표시와 인원 계산용이며 권한 판단에는 쓰지 않는다.
- 메시지 내용은 믿지 않고 재조회 계기로만 쓴다. 1초 안에 온 여러 신호는 묶어 한 번 조회한다. 조회는 한 번에 하나만 보내고, 조회 중에 새 신호가 오면 끝난 뒤 한 번 더 조회한다.
- 대기·진행·리포트 화면이 보이는 동안 10초 간격으로 최신 상태를 읽는다. 화면이 숨겨진 동안 멈추고, 다시 보이면 즉시 조회한다. API 실패는 간격을 늘려 재시도하며 연결 상태를 표시한다. 이 재조회 때 `/api/time` 시각 보정도 갱신한다.
- 최대 참여자 수: 방장은 진행 중 Presence로 본 참여자 수(방장 제외)의 최댓값을 메모리에 두었다가 `end` 이벤트와 함께 보낸다. 다른 기기에서 종료하면 그 기기가 본 값만 남고, 방장 화면이 모두 닫혀 있던 동안의 인원은 기록되지 않는다.

### 결제 웹훅 처리 규칙
- 주문 키는 `polar_order_id`다. `order.paid`와 `order.refunded`는 같은 행에 병합한다. 기존 행을 읽어 TypeScript에서 병합한 뒤 upsert한다.
  - `paid_at`: 처음 기록된(더 이른) 값을 유지한다.
  - `refunded_at`: 한 번 기록되면 지우지 않는다. 부분 환불도 같다.
  - `purchase_source`: 서버가 넣은 주문 metadata에서 읽고, unknown이 아닌 기존 값을 덮어쓰지 않는다.
- 병합 후 그 계정의 전체 이용권을 읽어 `computeProUntil`로 다시 계산하고 `profiles.pro_until`에 저장한다. 같은 웹훅이 다시 와도 결과는 같다.
- 트랜잭션은 쓰지 않는다. 두 웹훅이 동시에 와서 오래된 계산이 저장되는 드문 경우는 결제 완료·계정 화면에서 다시 계산할 때 바로잡힌다. 같은 주문의 첫 행 생성이 겹쳐 유니크 제약에 걸리면 500을 돌려 Polar 재시도 때 병합한다.
- 사용자를 찾지 못하면 성공 처리하지 않고 식별자만 로그에 남긴 뒤 500을 돌려준다.
- 환불은 `order.refunded`가 와야 반영한다. 참고: [Polar order.refunded](https://polar.sh/docs/api-reference/webhooks/order.refunded).

### 에러 코드
화면 문구와 1:1로 연결한다 (`src/lib/messages.ts`).

`UNAUTHENTICATED` · `NOT_OWNER` · `ROOM_NOT_FOUND` · `ROOM_FULL` · `ROOM_LOCKED` · `PLAN_LIMIT_ROOMS` · `PLAN_LIMIT_SEGMENTS` · `SESSION_CONFLICT` · `INVALID_EVENT` · `INVALID_INPUT`

## 보안 규칙
- 모든 테이블 RLS를 켜고 기본 거부. 브라우저는 자기 행 읽기만.
- 비밀 키(Supabase secret key, Polar access token, webhook secret)는 서버 코드에서만 쓴다. `NEXT_PUBLIC_` 환경변수에 넣지 않는다. 코드에 키를 직접 쓰지 않는다. 비밀 키는 RLS를 우회하므로 서버 코드에서 사용자·소유권을 명시적으로 검사한다.
- 공유 토큰은 128비트 무작위 값이며 룸 ID와 별개다.
- 웹훅은 원본 본문으로 서명을 검증하고 (Standard Webhooks), 5분 넘은 요청은 거부한다.
- 결제 상품은 서버에 정해 둔 ID만 쓴다. 브라우저가 보낸 상품·가격은 무시한다. 사용자 구분은 `external_customer_id`로 하고 이메일로 찾지 않는다.
- `returnTo`(결제 후)와 `next`(로그인 후)는 `/`로 시작하는 사이트 안 경로만 허용한다 (`//`, 외부 URL 거부).
- Supabase Auth의 리다이렉트 허용 목록에 `https://*.vercel.app/**` 같은 넓은 와일드카드를 넣지 않는다. 운영 주소, 팀 이름이 들어간 미리보기 패턴, localhost만.
- 사용자 입력은 React 기본 렌더링으로만 표시한다 (`dangerouslySetInnerHTML` 금지). `frame-ancestors 'none'` 헤더를 보낸다.
- QR은 브라우저에서 생성한다. 로그에 토큰·이메일을 남기지 않는다.

## 에러 처리 규칙
- 서버 액션과 API는 위 에러 코드로만 실패를 알린다. 화면은 코드별 한국어 문구를 보여준다.
- 연결 상태 표시: 연결됨 / 다시 연결 중 / 연결 안 됨. Realtime이 끊기면 간격을 늘려가며 재접속하고, 다시 연결되면 상태를 새로 읽는다.
- 방장 전송 실패는 같은 eventId로 직렬 재시도하고, 계속 실패하면 "연결 안 됨 · 다시 시도" 버튼을 보인다. 다른 기기와 충돌하면 서버 상태로 맞추고 큐를 비운 뒤 안내한다. `INVALID_EVENT`는 재시도하지 않는다.
- 웹훅 처리 실패는 500을 돌려 Polar가 재시도하게 한다. 같은 주문의 재처리는 기간을 중복으로 만들지 않는다.
- 결제 완료 화면은 서버에서 `pro_until`을 다시 계산하며 몇 초 확인하고, 안 되면 "반영이 늦어지고 있어요" 후 계정 화면으로 보낸다. 계정 화면도 열 때 다시 계산한다.
- `error.tsx`, `not-found.tsx`를 둔다. 참여자 페이지는 동적 렌더링한다.
- 환경변수는 실행할 때 검사한다 (`next build`가 키 없이도 성공해야 함).

## mock 모드
외부 계정 없이 앱 전체가 돌아가는 모드. 첫 배포, 화면 개발, 컴포넌트 테스트에 쓴다.

| 기능 | mock | live |
|---|---|---|
| 로그인 | "체험 계정으로 로그인" (가짜 사용자) | Google |
| 룸·세션·30일권 저장 | 브라우저 localStorage | Supabase |
| 실시간 공유·접속 인원 | 같은 브라우저의 다른 탭끼리 (BroadcastChannel) | Supabase Realtime |
| 결제 | "가짜 결제" 버튼 → 30일권 기록 추가 | Polar sandbox |
| 서버 시각 보정 | 기기 시계 그대로 | `/api/time` |

- 선택: `NEXT_PUBLIC_DATA_MODE=mock|live`. 값이 없으면 mock이라 키 없이도 빌드와 배포가 된다.
- mock일 때는 화면 위에 "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요" 배지를 띄운다. 배지는 루트 레이아웃(서버 컴포넌트)에서 그려서 서버가 내려주는 HTML에 들어가게 한다.
- 페이스 엔진, 이벤트 규칙, 입력 검사, 한도 계산, `computeProUntil`은 mock과 live가 같은 코드를 쓴다. 다른 것은 저장과 전송뿐이다.
- mock은 서버의 조건부 업데이트·웹훅을 흉내 내지 않는다. 그 동작은 live 연동 단계에서 확인한다.

## 배포와 DB 반영
- 배포: `npm run deploy` = `vercel deploy --prod --yes`. `vercel`은 devDependency로 버전을 고정한다. 처음 실행하면 Vercel 프로젝트를 만들고 연결한다 (`.vercel/`은 커밋하지 않음). 인증은 사용자가 미리 `vercel login`을 하거나 `VERCEL_TOKEN`을 넣는다.
- DB 반영: `npm run db:push` = `supabase db push --dry-run`으로 적용될 마이그레이션을 먼저 출력한 뒤 `supabase db push`. `supabase`는 devDependency로 버전을 고정한다. 처음에는 `supabase link --project-ref $SUPABASE_PROJECT_REF`로 연결하고, 인증은 `SUPABASE_ACCESS_TOKEN`·`SUPABASE_DB_PASSWORD` 환경변수로 한다.
  - 마이그레이션은 추가만 한다. 이미 원격에 적용된 마이그레이션 파일을 고치지 않는다.
  - 원격 DB에 `supabase db reset`을 실행하지 않는다.
- **mock 단계부터 배포한다.** 순서:
  1. 화면 + 페이스 엔진 + mock 데이터 → **1차 배포** (외부 계정 없이 동작)
  2. 1차 배포로 확정된 운영 주소를 `.env.local`의 `NEXT_PUBLIC_SITE_URL`에 기록한다. 이름이 겹치면 `podiumtimer.vercel.app`이 아닐 수 있으므로 CLI 출력에서 확인한 실제 주소를 쓴다.
     - 이 주소는 Supabase Auth의 Site URL·리다이렉트 허용 목록과 Polar 웹훅 주소(`<주소>/api/billing/webhook`)에 쓴다.
     - Google Cloud 콘솔의 OAuth 리다이렉트 URI에는 Vercel 주소가 아니라 Supabase 콜백 주소(`https://<project-ref>.supabase.co/auth/v1/callback`)를 넣는다.
  3. Supabase(로그인·DB·실시간) 연동 → `sync-env` → `npm run db:push` → **2차 배포** (`NEXT_PUBLIC_DATA_MODE=live`)
  4. Polar sandbox 결제 연동 → `sync-env` → 새 마이그레이션이 있으면 `npm run db:push` → **3차 배포**
- live 키는 `.env.local`에 두고 `scripts/sync-env.sh`가 Vercel 운영 환경변수로 등록한다. 키 값을 파일에서 바로 넘겨서 대화나 로그에 남지 않게 한다. `NEXT_PUBLIC_DATA_MODE`는 빌드할 때 코드에 박히므로 반드시 배포 전에 등록한다.
- 배포 확인: `NEXT_PUBLIC_SITE_URL`의 운영 주소가 200을 돌려준다. 2·3차 배포는 운영 페이지 HTML에 "MOCK 모드" 문구가 없어야 한다. 배포마다 생기는 고유 주소는 Vercel 기본 보호 설정 때문에 401이 날 수 있으므로 운영 주소로 확인한다.
- DB 반영 확인: `npx supabase migration list`에서 로컬과 원격 목록이 일치한다.
- `.env.example` 키: `NEXT_PUBLIC_DATA_MODE`(mock|live), `NEXT_PUBLIC_SITE_URL`, Supabase URL·공개 키·비밀 키, Polar access token·webhook secret·30일권 상품 ID·환경(sandbox), 문의 이메일, `SUPABASE_ACCESS_TOKEN`·`SUPABASE_PROJECT_REF`·`SUPABASE_DB_PASSWORD`, (선택) `VERCEL_TOKEN`.

## 테스트 전략
- `npm test`(Vitest)는 외부 서비스·네트워크·Docker 없이 통과해야 한다 (작업 종료 훅이 매번 실행).
- 집중 대상: `lib/pace`(이벤트 규칙, 누적 차이, 발언자별, 일시정지, 취소, 중도 종료, 리포트), `lib/billing`(연장, 환불), `lib/validation`, 서버 액션과 웹훅(Supabase·Polar는 목으로).
- 자동 검증 사례: 응답 유실 후 같은 eventId 재전송과 후속 큐 유지, 같은 eventId의 다른 내용 거부, 다른 기기 충돌 시 큐 비우고 서버 상태로 맞추기, 신규 세션의 seq 초기화, 정상·중도 종료의 최종 차이와 중단·미진행 구간 표시, 5초 구간 기본값 상속, 알림 0초 중복 방지.
- 결제 검증 사례: 연장 이어 붙이기, 환불된 이용권 제외(부분 환불 포함)와 뒤 이용권 앞당기기, 환불 웹훅 선도착, 같은 웹훅 재전송, 구매 계기 metadata 보존, 결제 완료·계정 화면 재계산.
- 화면 컴포넌트 테스트는 mock 어댑터로 돌린다.
- 손으로 확인하는 체크리스트: Google 로그인, 실시간 동기화(기기 2~3대), 인원 가득, 링크 다시 만들기, Polar sandbox 결제 → 반영 → 원래 화면 복귀, 환불과 만료, 화면 꺼짐 방지, 키보드·리모컨, 모바일 화면 탭.
- 실패 경로 수동 검증: Broadcast만 의도적으로 실패시켜 10초 재조회로 복구하는지, 링크 재발급 신호 누락 시 옛 링크가 거부되는지, 기존 참여자만 관찰한 세션 리포트로 전환하는지, 진행 중 편집이 거부되는지, 종료 시 peak_guests가 기록되는지.
