# 아키텍처

## 디렉토리 구조
```
src/
├── app/                          # 페이지(얇은 껍데기) + Route Handler
│   ├── layout.tsx                # mock 모드면 "MOCK 모드" 배지 (서버에서 렌더)
│   ├── page.tsx                  # / 시작(로그인)
│   ├── error.tsx, not-found.tsx
│   ├── auth/callback/route.ts    # Google 로그인 콜백 (code → 세션 쿠키)
│   ├── timers/page.tsx           # 내 타이머 목록
│   ├── timers/new/page.tsx
│   ├── timers/[id]/edit/page.tsx
│   ├── timers/[id]/run/page.tsx
│   ├── timers/[id]/records/page.tsx
│   ├── pass/page.tsx
│   ├── s/[code]/page.tsx         # 공유 시청 (공개)
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── api/time/route.ts         # 서버 시각 (GET → { now })
│   ├── api/share/[code]/route.ts # 공유 상태 조회 (공개, GET)
│   └── api/polar/webhook/route.ts
├── actions/                      # Server Actions (live 구현이 부름. DB 쓰기는 전부 여기)
│   ├── auth.ts                   # signInWithGoogle, signOut
│   ├── timers.ts                 # listTimers, getTimer, createTimer, updateTimer, deleteTimer
│   ├── records.ts                # listRecords, saveRecord, deleteRecord
│   ├── shares.ts                 # createShare, updateShareState
│   ├── plan.ts                   # getPlanStatus
│   └── checkout.ts               # createCheckout
├── components/                   # UI 컴포넌트 (데이터 화면은 Client Component)
├── types/                        # 공용 타입 (Segment, RunState, Timer, Record, Share, ApiError)
├── lib/
│   ├── run.ts                    # RunState 리듀서 (start, next, undo, abort) — 순수 함수
│   ├── timer.ts                  # 남은 시간·진행 위치·구간 결과·정시 판정 — 순수 함수
│   ├── format.ts                 # 시간 표시 문자열 ("1:42", "-0:05", "0:12 늦음"). 판정은 timer.ts를 부름
│   ├── stats.ts                  # 기록 평균 (구간 차이는 timer.ts를 부름) — 순수 함수
│   ├── plan.ts                   # 한도·이용권 판정 — 순수 함수
│   ├── seats.ts                  # Presence 목록 + seatCap → 입장 가능 여부 — 순수 함수
│   ├── validation.ts             # zod 스키마 (타이머·구간·닉네임). 화면과 서버가 같이 씀
│   ├── messages.ts               # 화면 문구·에러 문구 (한국어)
│   ├── clock.ts                  # 서버 시각 보정
│   └── supabase/
│       ├── server.ts             # 쿠키 세션 클라이언트 (Server Action, Route Handler)
│       ├── admin.ts              # SUPABASE_SECRET_KEY 클라이언트 (webhook, 공유 상태 조회 전용)
│       └── browser.ts            # 브라우저 클라이언트 (Realtime 전용)
├── services/
│   ├── api/                      # 화면이 부르는 유일한 데이터 창구
│   │   ├── index.ts              # 인터페이스 + NEXT_PUBLIC_DATA_MODE로 구현 선택
│   │   ├── live.ts               # Server Action·Route Handler 호출
│   │   └── mock.ts               # localStorage
│   ├── realtime.ts               # live: Supabase Broadcast·Presence / mock: BroadcastChannel
│   └── polar.ts                  # Polar SDK 래퍼 (체크아웃 생성, webhook 검증)
└── proxy.ts                      # live 모드: 세션 갱신 + 보호 경로 리다이렉트 (Next.js 미들웨어)
supabase/
└── migrations/                   # 테이블·RLS SQL
scripts/
└── sync-env.sh                   # .env의 live 키를 Vercel 운영 환경 변수로 등록
```

테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다. `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `types/`는 TDD 가드 대상이 아니다.

## 패턴
- 화면 코드(컴포넌트, 페이지)는 `services/api`와 `services/realtime`만 부른다. Supabase·Polar SDK나 Server Action을 직접 부르지 않는다. 그래서 mock과 live를 바꿔도 화면 코드를 고치지 않는다.
- 페이지(`page.tsx`)는 얇은 껍데기다. 데이터를 읽고 쓰는 화면(목록, 구간 설정, 실행, 기록, 공유 시청, 이용권)은 Client Component로 만들고 `services/api`로 읽는다. mock 데이터가 브라우저에 있어서 Server Component에서 데이터를 읽지 않는다.
- live 구현은 읽기·쓰기 모두 Server Action(`src/actions/`)이나 Route Handler를 부른다. Server Action은 로그인 사용자를 확인하고 쿠키 세션 클라이언트로 본인 행만 다룬다.
- 계산 로직(시간·판정·평균·한도·입장 판정·입력 검사)은 `lib/`의 순수 함수로 두고, 화면·Server Action·mock 구현이 같은 함수를 쓴다. 단위 테스트는 주로 여기에 쓴다.
- Route Handler는 외부에서 부르는 곳과 공개 조회에만 쓴다: OAuth 콜백, Polar webhook, 서버 시각, 공유 상태 조회.

## 데이터 모델 (Supabase Postgres)
모든 테이블에 RLS를 켠다. 정책은 "본인 행만"(`auth.uid() = user_id`)이다. 공개 정책은 만들지 않는다.

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| `timers` | `id` uuid pk, `user_id` uuid, `name` text, `segments` jsonb, `created_at`, `updated_at` | `segments`: `[{ name, durationSec }]` (순서 = 배열 순서) |
| `records` | `id` uuid pk, `user_id` uuid, `timer_id` uuid (fk, on delete cascade), `started_at` timestamptz, `segments` jsonb, `created_at` | `segments`: `[{ name, plannedMs, actualMs }]` — 발표 당시 설정 복사본 |
| `shares` | `code` text pk, `user_id` uuid, `timer_id` uuid (fk, on delete cascade), `timer_name` text, `segments` jsonb, `seat_cap` int, `state` jsonb, `created_at`, `updated_at` | 공유 1회 = 1행. `segments`는 생성 때 대기 화면용으로 넣고 "시작" 때 덮어쓴다. `seat_cap`은 생성 때의 이용권으로 정한다 |
| `orders` | `id` text pk (Polar order id), `user_id` uuid, `paid_at` timestamptz | 쓰기는 webhook(admin)만. 사용자는 본인 행 읽기만 |

- 이용권 만료일은 저장하지 않고 `orders`에서 계산한다: `paid_at` 오름차순으로 `만료 = max(만료, paid_at) + 30일`. (`lib/plan.ts`)
- 공유 상태는 RLS로 공개하지 않는다. `/api/share/[code]`가 admin 클라이언트로 `code`에 해당하는 행 하나만 읽어 돌려준다.
- 시청자 닉네임은 DB에 저장하지 않는다. Presence에만 있다.

## 실행 상태 (RunState)
```ts
type RunState = {
  status: 'idle' | 'running' | 'finished' | 'aborted';
  startedAt: number | null;  // 서버 보정 epoch ms
  transitions: number[];     // i번째 값 = i번째 구간에서 "다음"을 누른 시각
  rev: number;               // 상태가 바뀔 때마다 +1
};
```
- 현재 구간 index = `transitions.length`. `transitions.length === segments.length`면 `finished`.
- 구간 i 실제 시간 = `transitions[i] - (i === 0 ? startedAt : transitions[i - 1])`.
- 되돌리기 = `transitions`의 마지막 값을 뺀다(`finished`·`aborted` 상태에서는 불가).
- 마지막 구간의 "한 번 더 누르면 종료" 확인(3초)은 화면 상태다. RunState에 넣지 않고, 확인되면 그때 `next`로 `finished`가 된다.
- 화면 값(남은 시간, 진행 위치, 직전 결과)은 저장하지 않고 `RunState + segments + 지금 시각`으로 매번 계산한다. 그래서 연결이 끊겨도 시간은 계속 흐른다.
- 정시 판정: `|actualMs - plannedMs| <= 1000`.
- 진행 위치 = 현재 구간의 계획상 시작 지점 + `min(현재 구간 경과, 현재 구간 계획)`. 타임라인 바의 마커 위치다.
- 남은 시간은 초 단위 올림으로 표시해서 "0:00"이 되는 순간이 계획 시간과 맞게 한다. 0을 지나면 경과 초를 "-0:05"처럼 표시한다.

## 인터페이스 (형태만)
```ts
// src/services/api — 화면이 부르는 유일한 데이터 창구
type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError }
type ApiError = 'UNAUTHENTICATED' | 'NOT_FOUND' | 'PLAN_LIMIT_TIMERS' | 'PLAN_LIMIT_SEGMENTS' | 'INVALID_INPUT'

getUser(): Promise<User | null>
signIn(): Promise<void>                 // live: Google, mock: 체험 계정
signOut(): Promise<void>
listTimers() / getTimer(id) / createTimer(input) / updateTimer(id, input) / deleteTimer(id)
listRecords(timerId) / saveRecord(input) / deleteRecord(id)
createShare(timerId): Promise<Result<{ code: string; seatCap: number }>>
updateShareState(code, state: RunState, segments?: Segment[]): Promise<Result<void>>  // segments는 시작 때만
getShare(code): Promise<ShareView | null>   // { timerName, segments, seatCap, state }
getPlanStatus(): Promise<PlanStatus>        // { kind: 'free' | 'pass', expiresAt, timerCount }
startCheckout(): Promise<{ url: string }>   // mock: 가짜 결제 후 /timers?checkout=success

// src/services/realtime
joinShare(code, me: { nickname: string; role: 'host' | 'viewer' }, on: {
  changed(): void; presence(list: PresenceEntry[]): void; status(s: 'connected' | 'reconnecting' | 'disconnected'): void
}): { sendChanged(rev: number): void; leave(): void }
```
에러 코드는 `lib/messages.ts`의 화면 문구와 1:1로 연결한다.

## 데이터 흐름

### 로그인
```
live: / "Google로 시작하기" → signInWithGoogle (Server Action) → Supabase OAuth URL로 redirect
      → Google → /auth/callback (code를 세션 쿠키로 교환) → /timers
      proxy.ts: 매 요청 세션 갱신, 비로그인으로 /timers·/pass 접근 시 / 로 이동
mock: / "체험 계정으로 시작하기" → localStorage에 가짜 사용자 → /timers
      proxy.ts는 아무것도 하지 않고, 화면이 mock 로그인 여부를 보고 / 로 보낸다
```

### 타이머 실행 (혼자)
```
탭/스페이스바 → lib/run 리듀서로 RunState 갱신 → localStorage `run:{timerId}`에 저장
→ 200ms마다 lib/timer로 화면 값 계산
→ finished → api.saveRecord → records insert
```
- 페이지가 다시 열리면 localStorage의 RunState로 이어서 진행한다.
- `saveRecord`가 실패하면 결과 화면에 "다시 저장" 버튼을 보여준다.
- Wake Lock API로 화면 꺼짐을 막고, 탭이 다시 보일 때(`visibilitychange`) 다시 요청한다. 지원하지 않는 브라우저에서는 조용히 넘어간다.

### 공유
```
시작 전 "공유 링크 만들기" → api.createShare
  → (live) createShare: 로그인 확인 → lib/plan으로 seatCap 결정
     → shares insert (code, 타이머 이름·구간, seat_cap, state=idle) → { code, seatCap }
발표자: realtime.joinShare(code, role='host') → Presence로 접속자 닉네임·"접속 n/seatCap"
"시작" → api.updateShareState(code, state, segments)   ← 구간은 시작 때만 덮어씀
이후 상태 변경마다 → api.updateShareState(code, state) → 성공하면 sendChanged(rev)
시청자 /s/[code]
  → 닉네임 입력 → realtime.joinShare(code, role='viewer')
  → 구독이 연결되면 api.getShare(code) (live: GET /api/share/[code]) → rev가 더 클 때만 반영
  → lib/seats로 입장 판정: 한도를 넘으면 "인원이 가득 찼어요" 화면, 채널을 떠남
  → changed 수신 · 10초마다(화면이 보일 때) · 화면 복귀 · 재연결 때 다시 getShare
```
- Realtime 메시지는 "바뀌었음" 신호일 뿐이다. 메시지 내용으로 화면을 바꾸지 않고 서버에서 다시 읽는다. 공개 채널이라 누가 가짜 신호를 보내도 다시 읽기만 일어난다.
- 시청자는 채널을 먼저 구독하고 그다음 상태를 읽는다. 그사이 지나간 신호를 놓치지 않는다.
- 조회는 한 번에 하나만 보낸다. 조회 중에 새 신호가 오면 끝난 뒤 한 번 더 조회한다. 조회가 실패하면 간격을 늘려 다시 시도하고 "연결 끊김"을 표시한다.
- 발표자는 저장이 성공해야 신호를 보낸다. 저장이 실패하면 그 시점의 최신 상태로 다시 저장한다(실패한 옛 상태는 버림). 화면 복귀·재연결 때도 최신 상태를 한 번 저장한다.
- 공유 중인 발표는 localStorage에 `shareCode`도 저장해서, 새로고침 후에도 같은 채널로 계속 보낸다.
- Presence: 키 = 기기별 무작위 clientId, 내용 = `{ nickname, role, joinedAt }`. 화면 표시와 입장 판정에만 쓰고 권한 판단에는 쓰지 않는다.
- 입장 판정(`lib/seats.ts`): 발표자 1자리를 비워 두고, 시청자를 `joinedAt` 순으로 세어 `seatCap - 1`명까지 입장. 발표자는 기기 수와 상관없이 1명. 서버에서 강제하지 않는다.
- 발표자 화면은 한도를 넘어 들어왔다 나간 시청자 수를 세어 "n명이 인원 초과로 못 들어왔어요"를 보여준다.

### 시각 보정
```
페이지 진입 시 /api/time 호출 → offset = serverNow + 왕복시간/2 − Date.now()
clock.now() = Date.now() + offset        (mock: offset = 0)
```
모든 타임스탬프(`startedAt`, `transitions`)와 화면 계산은 `clock.now()`로 한다. 발표자와 시청자의 기기 시계가 달라도 같은 시간을 보여준다.

### 결제
```
/pass "구매" → api.startCheckout
  → (live) createCheckout: Polar 체크아웃 생성 (product=POLAR_PRODUCT_ID, metadata.userId, successUrl=/timers?checkout=success)
  → Polar 결제 페이지로 redirect
결제 완료 → /timers?checkout=success → "결제 확인 중…" → 2초 간격으로 최대 10회 이용권 재조회
Polar → /api/polar/webhook (order.paid)
  → 서명 검증 (실패·5분 넘은 요청은 403) → metadata.userId로 orders insert
  → 같은 order id면 무시 (재전송돼도 한 번만 반영)
mock: "가짜 결제" 버튼 → localStorage orders에 추가 → /timers?checkout=success
```
- live에서 이용권은 webhook에서만 생긴다. `successUrl`로 돌아온 것만으로는 아무것도 부여하지 않는다.
- 결제 상품은 서버의 `POLAR_PRODUCT_ID`만 쓴다. 브라우저가 보낸 상품·가격은 받지 않는다.

### 한도 확인 (`lib/plan.ts`, Server Action에서 호출)
| 동작 | 무료일 때 통과 조건 | 30일권일 때 |
|---|---|---|
| createTimer | 내 timers 수 < 3 이고 구간 수 ≤ 10 | 구간 수 ≤ 30 |
| updateTimer | 새 구간 수 ≤ max(10, 기존 구간 수) | 새 구간 수 ≤ max(30, 기존 구간 수) |
| createShare | 항상 통과, seatCap = 3 | 항상 통과, seatCap = 10 |

- 30일권 활성 = 계산한 만료일 > 지금.
- 막히면 Server Action이 `{ ok: false, error: 'PLAN_LIMIT_TIMERS' | 'PLAN_LIMIT_SEGMENTS' }`를 돌려주고, 화면은 안내와 "30일권 보기" 버튼을 보여준다.
- 동시 접속 한도는 Server Action이 아니라 시청자 화면에서 `lib/seats`로 확인한다.

## 상태 관리
- **서버 상태**(타이머, 기록, 이용권): Client Component가 `services/api`로 읽고, 변경 후 다시 읽는다. 클라이언트 캐시 라이브러리는 쓰지 않는다.
- **실행 상태**: 실행 화면의 `useReducer`(lib/run 리듀서) + localStorage 복원.
- **구간 설정 폼**: 폼 컴포넌트 안의 `useState`. 저장할 때 `lib/validation`으로 검사하고 `services/api`로 보낸다.
- **공유 시청 상태**: `getShare`로 받은 최신 상태(`rev` 비교), 닉네임·clientId(`localStorage`).

## mock 모드
외부 계정 없이 앱 전체가 돌아가는 모드. 첫 배포, 화면 개발, 컴포넌트 테스트에 쓴다.

| 기능 | mock | live |
|---|---|---|
| 로그인 | "체험 계정으로 시작하기" (가짜 사용자) | Google |
| 타이머·기록·공유·주문 저장 | 브라우저 localStorage | Supabase |
| 실시간 신호·접속자 | 같은 브라우저의 다른 탭끼리 (BroadcastChannel) | Supabase Realtime |
| 결제 | "가짜 결제" 버튼 → 주문 기록 추가 | Polar sandbox |
| 서버 시각 보정 | 기기 시계 그대로 | `/api/time` |

- 선택: `NEXT_PUBLIC_DATA_MODE=mock|live`. 값이 없으면 mock이라 키 없이도 빌드와 배포가 된다.
- mock일 때는 화면 위에 "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요" 배지를 띄운다. 루트 레이아웃(서버)에서 그려서 서버가 내려주는 HTML에 들어가게 한다.
- `lib/`의 계산·판정·검사 함수는 mock과 live가 같은 코드를 쓴다. 다른 것은 저장과 전송뿐이다.
- mock은 webhook 서명 검증·RLS를 흉내 내지 않는다. 그 동작은 live 연동 단계에서 확인한다.

## 보안 규칙
- 모든 테이블 RLS를 켜고 본인 행만. 공개 정책은 없다.
- 비밀 키(`SUPABASE_SECRET_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`)는 서버 코드에서만 읽는다. `NEXT_PUBLIC_` 환경 변수에 넣지 않고 코드에 키 값을 쓰지 않는다. admin 클라이언트는 RLS를 우회하므로 webhook과 `/api/share/[code]`에서만 쓴다.
- `/api/share/[code]`는 `timerName, segments, seatCap, state`만 돌려준다. `user_id`·이메일은 내보내지 않는다. 없는 코드는 404. `Cache-Control: no-store`.
- 공유 코드는 128비트 무작위 값이며 타이머 ID와 별개다.
- webhook은 원본 본문으로 서명을 검증하고(Standard Webhooks), 5분 넘은 요청은 거부한다.
- 로그인 후 이동 경로를 받는 곳은 `/`로 시작하는 사이트 안 경로만 허용한다(`//`, 외부 URL 거부).
- Supabase Auth 리다이렉트 허용 목록에 `https://*.vercel.app/**` 같은 넓은 와일드카드를 넣지 않는다. 운영 주소와 localhost만.
- 사용자 입력(타이머 이름, 구간 이름, 닉네임)은 React 기본 렌더링으로만 표시한다(`dangerouslySetInnerHTML` 금지). `frame-ancestors 'none'` 헤더를 보낸다.

## 환경 변수
| 이름 | 용도 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `mock` \| `live`. 없으면 mock. 빌드할 때 코드에 박힌다 | 공개 |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirect, Polar successUrl | 공개 |
| `CONTACT_EMAIL` | 하단 문의 이메일 | 서버 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 주소 | 공개 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저·쿠키 세션 클라이언트 | 공개 |
| `SUPABASE_SECRET_KEY` | admin 클라이언트 (webhook, 공유 상태 조회) | 서버 전용 |
| `DATABASE_URL` | `npm run db:push` 마이그레이션 적용용. 앱 코드에서 쓰지 않는다 | 서버 전용 |
| `POLAR_ENVIRONMENT` | `sandbox` | 서버 전용 |
| `POLAR_ACCESS_TOKEN` | 체크아웃 생성 | 서버 전용 |
| `POLAR_WEBHOOK_SECRET` | webhook 서명 검증 | 서버 전용 |
| `POLAR_PRODUCT_ID` | 30일권 상품 ($3.99, 1회 결제) | 서버 전용 |
| `VERCEL_TOKEN` | (선택) `vercel login` 대신 배포 인증 | 서버 전용 |

- 환경 변수는 실행할 때 검사한다. `npm run build`는 키 없이도 성공해야 한다.
- 로컬 키는 `.env`(gitignore됨)에 둔다. `.env.example`에 키 이름만 적는다.

## 배포와 DB 반영
- 배포: `npm run deploy` = `vercel deploy --prod --yes`. `vercel`은 devDependency로 버전을 고정한다. 처음 실행하면 Vercel 프로젝트를 만들고 연결한다(`.vercel/`은 커밋하지 않음). 인증은 사용자가 미리 `vercel login`을 하거나 `VERCEL_TOKEN`을 넣는다. 함수 리전은 서울(`icn1`).
- DB 반영: `npm run db:push` = `supabase db push --db-url "$DATABASE_URL" --dry-run`으로 적용될 마이그레이션을 먼저 출력한 뒤 `supabase db push --db-url "$DATABASE_URL"`. `supabase`는 devDependency로 버전을 고정한다.
  - 마이그레이션은 추가만 한다. 이미 원격에 적용된 마이그레이션 파일을 고치지 않는다.
  - 원격 DB에 `supabase db reset`을 실행하지 않는다.
- live 키는 `.env`에 두고 `scripts/sync-env.sh`가 Vercel 운영 환경 변수로 등록한다. 키 값을 파일에서 바로 넘겨서 대화나 로그에 남지 않게 한다. `NEXT_PUBLIC_DATA_MODE`는 빌드할 때 코드에 박히므로 반드시 배포 전에 등록한다.
- **mock 단계부터 배포한다.** 순서:
  1. 화면 + `lib/` + mock 구현 → **1차 배포** (외부 계정 없이 동작)
  2. 1차 배포 CLI 출력에서 확인한 운영 주소를 `.env`의 `NEXT_PUBLIC_SITE_URL`에 기록한다(`podiumtimer.vercel.app`이 아닐 수 있음).
     - 이 주소를 Supabase Auth의 Site URL·리다이렉트 허용 목록과 Polar webhook 주소(`<주소>/api/polar/webhook`)에 쓴다.
     - Google Cloud 콘솔의 OAuth 리다이렉트 URI에는 Supabase 콜백 주소(`https://<project-ref>.supabase.co/auth/v1/callback`)를 넣는다.
  3. Supabase(로그인·DB·실시간) 연동 → `sync-env` → `npm run db:push` → **2차 배포** (`NEXT_PUBLIC_DATA_MODE=live`)
  4. Polar sandbox 결제 연동 → `sync-env` → 새 마이그레이션이 있으면 `npm run db:push` → **3차 배포**
- 배포 확인: 운영 주소가 200을 돌려준다. 2·3차 배포는 운영 페이지 HTML에 "MOCK 모드" 문구가 없어야 한다. 배포마다 생기는 고유 주소는 Vercel 기본 보호 때문에 401이 날 수 있으므로 운영 주소로 확인한다.
- DB 반영 확인: `npx supabase migration list --db-url "$DATABASE_URL"`에서 로컬과 원격 목록이 일치한다.

## 테스트
- Vitest + Testing Library. `npm test`는 외부 서비스·네트워크·Docker 없이 통과해야 한다(작업 종료 훅이 매번 실행).
- `lib/`의 순수 함수는 경계값까지 단위 테스트한다: 정시 ±1초 경계, 되돌리기, 마지막 구간 종료, 진행 위치(구간 초과 시 블록 끝에서 멈춤), 이용권 연장 계산, 한도 경계(새로 만들 때 구간 수 포함), seatCap 결정과 입장 판정, 평균 대상 필터, 입력 검사(길이·제어 문자).
- Server Action은 Supabase·Polar 클라이언트를 mock해서 테스트한다: 한도 초과 거절, 본인 행만 처리, 시작 때 구간 덮어쓰기.
- Route Handler: webhook은 서명 실패·오래된 요청 거절과 같은 order id 중복 무시, `/api/share/[code]`는 404와 `user_id` 미포함을 테스트한다.
- 화면 컴포넌트 테스트는 mock 구현으로 돌린다: 0.5초 안 두 번째 "다음" 무시, 마지막 구간 3초 확인, 상단 바 탭은 "다음" 아님, 입력 칸에서 스페이스 단축키 꺼짐.
- 손으로 확인: Google 로그인, 기기 2~3대 실시간 동기화, 인원 가득, Polar sandbox 결제 → 반영, 화면 꺼짐 방지, 스페이스바, 모바일 화면 탭. 실패 경로: Broadcast를 막아도 10초 재조회로 따라오는지, 발표자 연결을 끊었다 붙였을 때 시청자가 따라오는지.
