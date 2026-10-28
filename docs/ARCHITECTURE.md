# 아키텍처

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router, 최신 안정 버전) + TypeScript strict | |
| 스타일 | Tailwind CSS | |
| 인증 | Supabase Auth — Google만 | 시청자는 인증 없음 |
| DB | Supabase Postgres (서울 리전) | 테이블 4개 |
| 서버 DB 쓰기 | supabase-js (서버, 비밀 키) | 트랜잭션·DB 함수 없음 |
| 실시간 | Supabase Realtime — 공개 Broadcast 채널 + Presence | "바뀌었음" 신호와 접속자만 |
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
│   ├── pricing/, billing/success/, terms/, privacy/
│   ├── auth/callback/route.ts          Google 로그인 콜백
│   └── api/
│       ├── time/route.ts               서버 시각
│       ├── share/[code]/route.ts       시청자용 공유 상태 조회
│       ├── billing/checkout/route.ts   Polar 결제창 생성
│       └── billing/webhook/route.ts    Polar 웹훅
├── components/                         타이머 화면, 타임라인 바, 구간 편집기, 결과 표, 평균 그래프
├── types/                              timer.ts, run.ts, share.ts
├── lib/
│   ├── timer.ts                        reduceRun, computeTimer, buildResult, verdictOf
│   ├── stats.ts                        averageRecords
│   ├── billing.ts                      computeExpiry, planOf, LIMITS
│   ├── seats.ts                        admit (Presence 입장 판정)
│   ├── validation.ts                   zod 스키마 (타이머·구간·닉네임·공유 상태)
│   ├── time.ts                         서버 시각 보정
│   └── messages.ts                     한국어 문구 모음
├── services/
│   ├── api/                            화면이 부르는 유일한 데이터 창구: index.ts · live.ts · mock.ts · device.ts(실행 상태·닉네임·clientId 기기 저장)
│   ├── supabase/                       server(쿠키 세션, 읽기) · admin(비밀 키) · browser(Realtime 전용)
│   ├── polar.ts
│   └── realtime.ts                     live: Supabase Broadcast·Presence · mock: BroadcastChannel
└── proxy.ts                            live: 세션 갱신 + 보호 경로 리다이렉트
supabase/migrations/                    테이블, 제약, RLS
scripts/sync-env.sh                     .env의 live 키를 Vercel 환경변수로 등록
```

테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다. `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `types/`는 TDD 가드 대상이 아니다.

## 핵심 규칙

| # | 규칙 | 이유 |
|---|---|---|
| R1 | **화면 코드는 `src/services/api`·`src/services/realtime`만 부른다.** 구현은 mock과 live 두 개이고 `NEXT_PUBLIC_DATA_MODE`(기본 mock)로 고른다 | live로 바꿀 때 화면 코드를 고치지 않음 |
| R2 | **페이지는 얇은 Server Component, 데이터 화면은 Client Component가 `services/api`로 읽는다** | mock 데이터가 브라우저에 있어서 서버에서 읽을 수 없음 |
| R3 | **규칙 계산은 `src/lib`의 순수 함수 하나로만 한다.** 화면·서버·mock이 같은 함수를 쓴다 | 규칙이 두 군데 있으면 어긋남 |
| R4 | **live 쓰기는 서버 액션·API 라우트에서 로그인 사용자와 소유권을 확인한 뒤 비밀 키로 한다.** RLS는 자기 행 읽기만 허용한다 | 브라우저 세션으로 DB에 직접 써서 한도를 우회할 수 없음 |
| R5 | **DB 접근은 supabase-js 하나.** RPC·트랜잭션·직접 DB 연결은 쓰지 않는다. 동시성은 조건부 업데이트와 기본 키로 막는다 | 한 언어, 한 가지 접근 방식 |
| R6 | **실행 상태는 발표자 기기의 localStorage에 둔다.** 서버에는 완주한 기록과 공유 중인 상태만 저장한다. 매초 보내지 않고 각 화면이 `computeTimer`로 계산한다 | 서버 이벤트 기록·충돌 처리가 필요 없음 |
| R7 | **[시작]할 때 구간을 실행 상태에 복사한다.** 실행 화면·공유·기록은 이 복사본만 쓴다 | 진행 중에 타이머를 고쳐도 그 발표가 어긋나지 않음 |
| R8 | **공유 상태는 `rev`가 지금보다 클 때만 저장한다** (조건부 업데이트) | 재전송·늦게 도착한 옛 요청을 따로 처리할 필요 없음 |
| R9 | **Realtime 메시지는 "바뀌었음" 신호뿐이다.** 받으면 서버에서 다시 읽는다 | 공개 채널의 가짜 신호는 재조회만 일으킴 |
| R10 | **접속 인원 한도는 Presence 인원 수로 화면에서 검사한다** | 서버 강제는 하지 않음 (프로토타입에서 우회 가능성 감수) |

## 데이터 흐름

```
발표자: 조작 → lib/timer 리듀서 → 화면 즉시 반영 → localStorage
        ├─(공유 중) updateShareState → shares (rev 조건부) → 성공하면 Broadcast changed
        └─(완주) saveRecord → records
시청자: 채널 구독 → GET /api/share/{code} → computeTimer로 매 프레임 계산
        ↑ changed 신호 · 10초마다 · 화면 복귀 때 다시 조회
Polar ──(order.paid)──→ /api/billing/webhook → orders
```

## DB 스키마

```
timers   id · user_id · name · segments jsonb · created_at · updated_at
records  id · user_id · timer_id (fk, on delete cascade) · started_at · segments jsonb · created_at
shares   code (pk) · user_id · timer_id (fk, on delete cascade) · timer_name · segments jsonb
         seat_cap · state jsonb · rev int (default 0) · created_at · updated_at
orders   id (pk = Polar order id) · user_id · paid_at
```

- `timers.segments`: `[{ id, name, durationSec }]` (순서 = 배열 순서). `records.segments`: `[{ name, plannedMs, actualMs }]`.
- RLS: 네 테이블 모두 켜고 **자기 행 읽기(select)만** 허용한다. insert/update/delete 정책과 비로그인용 공개 정책은 두지 않는다.
- 타이머를 지우면 기록과 공유도 함께 지운다 (삭제 전 화면에서 확인).
- 시청자 닉네임은 DB에 저장하지 않는다. Presence에만 있다.

## 실행 상태

```ts
type RunState = {
  status: 'idle' | 'running' | 'finished' | 'aborted'
  startedAt: number | null       // 서버 보정 epoch ms
  transitions: number[]          // i번째 값 = i번째 구간에서 '다음'을 누른 시각
  rev: number                    // 바뀔 때마다 +1
}
type LocalRun = { segments: Segment[]; run: RunState; shareCode: string | null }  // localStorage run:{timerId}
```

- `start`는 `idle`에서만, `next`·`undo`·`abort`는 `running`에서만. 마지막 구간의 `next`는 화면이 "한 번 더 누르기"를 확인한 뒤에만 보내고, 그러면 `finished`. `undo`는 `transitions`의 마지막 값을 뺀다(연달아 가능).
- 구간 i 실제 시간 = `transitions[i] − (i === 0 ? startedAt : transitions[i − 1])`. 정시 = `|실제 − 계획| <= 1000`.
- 남은 시간은 초 단위 올림으로 표시해서 "0:00"이 되는 순간이 계획 시간과 맞게 한다. 0을 지나면 "-0:05"처럼 표시한다.
- 진행 위치 = 현재 구간의 계획상 시작 지점 + `min(현재 구간 경과, 현재 구간 계획)`.
- 실행 화면이 열리면 localStorage의 실행 상태로 그대로 이어간다. 단 `running`인데 시작한 지 12시간이 지났으면 버리고 `idle`로 시작한다.
- `finished`면 결과 표를 보여준다. [다시 하기]는 `idle`로 되돌리고 `shareCode`를 지운다.

## 인터페이스 (형태만)

```ts
// src/types
type Segment = { id: string; name: string; durationSec: number }
type Timer = { id: string; name: string; segments: Segment[] }
type SegmentResult = { name: string; plannedMs: number; actualMs: number; diffMs: number; verdict: 'late' | 'early' | 'on_time' }
type TimerView = { segmentIndex: number; segmentRemainingMs: number; totalRemainingMs: number; progressMs: number; lastResult: SegmentResult | null }

// src/lib/timer.ts — 발표자·시청자·서버·mock이 공유
reduceRun(run, action: { type: 'start' | 'next' | 'undo' | 'abort'; at: number }, segmentCount): RunState | null
computeTimer(segments, run, nowMs): TimerView
buildResult(segments, run): SegmentResult[]

// src/lib/stats.ts
averageRecords(timer, records): AverageRow[] | null   // 구성이 같은 기록이 2개 이상일 때

// src/lib/billing.ts
computeExpiry(orders: { paidAt: number }[]): number | null   // paidAt 순으로 만료 = max(만료, paidAt) + 30일
planOf(expiry, nowMs): 'free' | 'pass'
LIMITS = { free: { timers: 3, segments: 10, seats: 3 }, pass: { timers: Infinity, segments: 30, seats: 10 } }

// src/lib/seats.ts
admit(presence, clientId, seatCap): boolean   // 발표자 1자리를 빼고 시청자를 joinedAt 순으로 seatCap − 1명까지
```

## 서버 액션 (`src/app/**/actions.ts`, 모두 로그인 사용자 확인. 쓰기는 소유권 확인 후 비밀 키)

| 함수 | 결과 |
|---|---|
| `listTimers()` · `getTimer(id)` · `listRecords(timerId)` | 자기 행 (쿠키 세션 읽기) |
| `createTimer(input)` | 입력 검사 → 타이머 개수를 센 뒤 한도(구간 수 포함) 검사 → 생성 |
| `updateTimer(id, input)` | 입력·한도 검사 → 저장 |
| `deleteTimer(id)` · `deleteRecord(id)` | 삭제 |
| `saveRecord(timerId, startedAt, results)` | 입력 검사 → 저장 |
| `createShare(timerId)` | 128비트 무작위 코드 → `shares` 생성(이름·구간, `seat_cap` = 지금 플랜, `state` = idle) → `{ code, seatCap }` |
| `updateShareState(code, run, start?: { segments })` | 입력 검사 → `rev < 새 rev`일 때만 업데이트(아니면 그냥 성공). `start`가 있으면 `segments`와 `seat_cap`(지금 플랜)도 덮어씀 |
| `getPlanStatus()` | `orders`로 만료일 계산 → `{ plan, expiresAt, timerCount }` |

실패는 에러 코드로만 알린다: `UNAUTHENTICATED` · `NOT_FOUND` · `PLAN_LIMIT_TIMERS` · `PLAN_LIMIT_SEGMENTS` · `INVALID_INPUT`. 남의 행은 `NOT_FOUND`로 응답한다. 화면 문구는 `src/lib/messages.ts`에서 코드별로 가져온다.

## API 라우트

| 경로 | 내용 |
|---|---|
| `GET /api/time` | `{ now }` — 서버 시각 보정용. `Cache-Control: no-store` |
| `GET /api/share/[code]` | `{ timerName, segments, seatCap, state, rev }`. admin 클라이언트로 그 코드의 행 하나만 읽는다. 없으면 404. 사용자 ID·이메일 제외. `no-store` |
| `POST /api/billing/checkout` | 로그인 필수. `{ returnTo }` → `{ url }`. 상품은 서버의 30일권 ID만, `external_customer_id` = 로그인 사용자 ID. successUrl = `/billing/success?returnTo=…` |
| `POST /api/billing/webhook` | 원본 본문 서명 검증 → `order.paid`만, 대상 상품만 → `external_customer_id`로 사용자 확인(없으면 500) → `orders` insert(같은 주문 ID면 이미 처리됨) → 200 |
| `GET /auth/callback` | Google 로그인 코드 교환 |

## 공유 동기화
- 채널 `share:{code}` (공개). 메시지는 `changed { rev }` 하나. 발표자가 저장에 성공하면 보낸다.
- Presence: 키 = 탭별 무작위 clientId(sessionStorage라 새로고침해도 유지, 같은 브라우저의 다른 탭은 다른 값), 내용 = `{ nickname, role: 'host' | 'viewer', joinedAt }`(`joinedAt`은 서버 보정 시각). 표시와 인원 계산에만 쓴다.
- **발표자**: 상태가 바뀔 때마다 저장한다. 실패하면 최신 상태로 간격을 늘려 재시도하고, 그동안 "공유 연결 끊김"을 작게 표시한다. 화면 복귀·재접속 때 최신 상태를 한 번 더 저장한다.
- **시청자**: 채널을 먼저 구독하고 그다음 상태를 읽는다. `changed`를 받으면(첫 신호는 바로, 1초 안에 더 온 신호는 1초 뒤 한 번), 화면이 보이는 동안 10초마다, 화면 복귀 때 다시 읽는다. 응답의 `rev`가 지금보다 클 때만 반영한다. 조회가 실패하면 간격을 늘려 재시도하고 "연결 끊김"을 표시한다.
- **입장 판정**: 시청자는 Presence가 바뀔 때마다 `admit`으로 자기 자리를 확인하고, 자리가 없으면 "인원이 가득 찼어요" 화면으로 바꾼 뒤 채널을 떠난다. 발표자는 시청자 수가 `seatCap − 1`에 닿으면 "자리가 가득 찼어요"를 보여준다(무료면 "30일권은 10명까지" + [30일권 보기]).
- 시각 보정: 페이지에 들어올 때 `/api/time`으로 한 번 구한다(`offset = serverNow + 왕복시간/2 − Date.now()`). mock은 기기 시계 그대로.

## 결제
- 30일권 활성 = `computeExpiry(orders)` > 지금. 만료일은 저장하지 않고 필요할 때 계산한다.
- `/billing/success`는 2초 간격으로 최대 10회 `getPlanStatus`를 확인한다. 반영되면 returnTo로, 안 되면 "결제는 완료됐어요, 반영이 늦어지고 있어요" 후 `/timers`로 보낸다.
- 환불은 Polar 대시보드에서 수동으로 한다. `order.refunded`는 처리하지 않는다.

## 보안 규칙
- 비밀 키(`SUPABASE_SECRET_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`)는 서버 코드에서만 쓰고 `NEXT_PUBLIC_` 환경변수에 넣지 않는다. admin 클라이언트는 서버 액션의 쓰기, `/api/share/[code]`, 결제 웹훅에서만 쓰고, 쓸 때마다 사용자·소유권을 직접 검사한다.
- 공유 코드는 128비트 무작위 값이며 타이머 ID와 별개다.
- 웹훅은 원본 본문으로 서명을 검증하고(Standard Webhooks), 5분 넘은 요청은 거부한다. 결제 상품은 서버에 정해 둔 ID만 쓰고, 사용자는 `external_customer_id`로 찾는다(이메일로 찾지 않음).
- `returnTo`와 로그인 후 `next`는 `/`로 시작하는 사이트 안 경로만 허용한다(`//`, 외부 URL 거부).
- Supabase Auth 리다이렉트 허용 목록에 `https://*.vercel.app/**` 같은 넓은 와일드카드를 넣지 않는다. 운영 주소와 localhost만.
- 사용자 입력은 React 기본 렌더링으로만 표시한다(`dangerouslySetInnerHTML` 금지). `frame-ancestors 'none'` 헤더를 보낸다.
- 로그에 공유 코드·이메일을 남기지 않는다.

## 에러 처리
- `saveRecord`가 실패하면 결과 화면에 [다시 저장]을 보여준다.
- 웹훅 처리 실패는 500을 돌려 Polar가 재시도하게 한다. 같은 주문은 기본 키로 한 번만 저장된다.
- `error.tsx`, `not-found.tsx`를 둔다. 시청자 페이지는 동적 렌더링한다.
- 환경변수는 실행할 때 검사한다(`next build`가 키 없이도 성공해야 함).

## mock 모드
외부 계정 없이 앱 전체가 돌아가는 모드. 첫 배포, 화면 개발, 컴포넌트 테스트에 쓴다.

| 기능 | mock | live |
|---|---|---|
| 로그인 | "체험 계정으로 로그인" (가짜 사용자) | Google |
| 타이머·기록·공유·주문 저장 | 브라우저 localStorage | Supabase |
| 실시간 신호·접속자 | 같은 브라우저의 다른 탭끼리 (BroadcastChannel) | Supabase Realtime |
| 결제 | "가짜 결제" 버튼 → 주문 추가 | Polar sandbox |
| 서버 시각 보정 | 기기 시계 그대로 | `/api/time` |
| 보호 경로 | 화면이 mock 로그인 여부를 보고 랜딩으로 보냄 | `proxy.ts` |

- mock일 때는 루트 레이아웃(서버)에서 "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요" 배지를 그린다.
- `src/lib`의 함수는 mock과 live가 같은 코드를 쓴다. 다른 것은 저장과 전송뿐이다. mock은 RLS·조건부 업데이트·웹훅을 흉내 내지 않는다.

## 배포와 DB 반영
- 배포: `npm run deploy` = `vercel deploy --prod --yes`. `vercel`은 devDependency로 버전을 고정한다. 처음 실행하면 프로젝트를 만들고 연결한다(`.vercel/`은 커밋하지 않음). 인증은 미리 `vercel login` 또는 `VERCEL_TOKEN`.
- DB 반영: `npm run db:push` = `supabase db push --db-url "$DATABASE_URL" --dry-run`으로 적용될 마이그레이션을 출력한 뒤 `supabase db push --db-url "$DATABASE_URL"`. `supabase`는 devDependency로 버전을 고정한다. 마이그레이션은 추가만 하고, 원격 DB에 `supabase db reset`을 실행하지 않는다.
- live 키는 `.env`(gitignore됨)에 두고 `scripts/sync-env.sh`가 Vercel 운영 환경변수로 등록한다. 키 값이 대화나 로그에 남지 않게 파일에서 바로 넘긴다. `NEXT_PUBLIC_DATA_MODE`는 빌드할 때 코드에 박히므로 배포 전에 등록한다.
- **mock 단계부터 배포한다.**
  1. 화면 + `lib` + mock → **1차 배포**
  2. CLI 출력의 운영 주소를 `NEXT_PUBLIC_SITE_URL`에 기록하고, Supabase Auth Site URL·리다이렉트 허용 목록과 Polar 웹훅 주소(`<주소>/api/billing/webhook`)에 쓴다. Google OAuth 리다이렉트 URI에는 Supabase 콜백 주소(`https://<project-ref>.supabase.co/auth/v1/callback`)를 넣는다.
  3. Supabase 연동 → `sync-env` → `npm run db:push` → **2차 배포** (`NEXT_PUBLIC_DATA_MODE=live`)
  4. Polar sandbox 연동 → `sync-env` → **3차 배포**
- 확인: 운영 주소가 200을 돌려주고, 2·3차 배포 HTML에 "MOCK 모드" 문구가 없다. `npx supabase migration list --db-url "$DATABASE_URL"`에서 로컬과 원격이 일치한다.

### 환경 변수 (`.env.example`에 이름만)

| 이름 | 용도 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `mock` \| `live`. 없으면 mock | 공개 |
| `NEXT_PUBLIC_SITE_URL` | 운영 주소. OAuth redirect, Polar successUrl | 공개 |
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 쿠키 세션·브라우저 클라이언트 | 공개 |
| `SUPABASE_SECRET_KEY` | admin 클라이언트 | 서버 전용 |
| `POLAR_ENVIRONMENT` · `POLAR_ACCESS_TOKEN` · `POLAR_WEBHOOK_SECRET` · `POLAR_PRODUCT_ID` | 결제 (sandbox, 30일권 상품) | 서버 전용 |
| `CONTACT_EMAIL` | 하단 문의 이메일 | 서버 |
| `DATABASE_URL` | `npm run db:push` 전용. 앱 코드에서 쓰지 않음 | CLI 전용 |
| `VERCEL_TOKEN` | (선택) 배포 인증 | CLI 전용 |

## 테스트
- `npm test`(Vitest)는 외부 서비스·네트워크·Docker 없이 통과해야 한다 (작업 종료 훅이 매번 실행).
- `lib` 단위 테스트: 실행 상태 전이, 정시 ±1초 경계, 되돌리기, 마지막 구간 종료, 남은 시간 올림, 진행 위치(구간 초과 시 멈춤), 같은 구성만 평균, 만료일 연장, 한도 경계(새로 만들 때 구간 수 포함), 입장 판정, 입력 검사.
- 서버 액션·라우트(Supabase·Polar는 목): 한도 초과 거절, 남의 행 `NOT_FOUND`, 작은 `rev` 무시, 시작 때 구간·인원 한도 덮어쓰기, `/api/share/[code]` 404와 사용자 ID 미포함, 웹훅 서명 실패 거절과 같은 주문 중복 무시.
- 화면 컴포넌트(mock 어댑터): 0.5초 안 두 번째 '다음' 무시, 마지막 구간 3초 확인, 상단 바 탭은 '다음' 아님, 입력 칸에서 스페이스 꺼짐.
- 손으로 확인: Google 로그인, 기기 2~3대 실시간 동기화, 인원 가득, Polar sandbox 결제 → 원래 화면 복귀, 화면 꺼짐 방지, 모바일 탭, Broadcast를 막아도 10초 재조회로 따라오는지.
