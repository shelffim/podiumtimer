# 아키텍처

## 디렉토리 구조
```
src/
├── app/                          # 페이지 + Route Handler
│   ├── page.tsx                  # / 시작(로그인)
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
│   └── api/polar/webhook/route.ts
├── actions/                      # Server Actions (DB 쓰기는 전부 여기)
│   ├── auth.ts                   # signInWithGoogle, signOut
│   ├── timers.ts                 # createTimer, updateTimer, deleteTimer
│   ├── records.ts                # saveRecord, deleteRecord
│   ├── shares.ts                 # createShare, updateShareState
│   └── checkout.ts               # createCheckout
├── components/                   # UI 컴포넌트
├── types/                        # 공용 타입 (Segment, RunState, Timer, Record, Share)
├── lib/
│   ├── run.ts                    # RunState 리듀서 (start, next, undo, abort) — 순수 함수
│   ├── timer.ts                  # 남은 시간·구간 결과·정시 판정 — 순수 함수
│   ├── format.ts                 # 시간 표시 문자열 ("1:42", "-0:05", "0:12 늦음")
│   ├── stats.ts                  # 기록 평균 — 순수 함수
│   ├── plan.ts                   # 한도·이용권 판정 — 순수 함수
│   ├── clock.ts                  # 서버 시각 보정
│   └── supabase/
│       ├── server.ts             # 쿠키 세션 클라이언트 (Server Component, Server Action)
│       ├── admin.ts              # SUPABASE_SECRET_KEY 클라이언트 (webhook, 공유 시청 초기 조회 전용)
│       └── browser.ts            # 브라우저 클라이언트 (Realtime 전용)
├── services/
│   └── polar.ts                  # Polar SDK 래퍼 (체크아웃 생성, webhook 검증)
└── proxy.ts                      # 세션 갱신 + 보호 경로 리다이렉트 (Next.js 미들웨어)
supabase/
└── migrations/                   # 테이블·RLS SQL
```

테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다. `page.tsx`, `layout.tsx`, `types/`는 TDD 가드 대상이 아니다.

## 패턴
- 기본은 Server Component. 페이지는 서버에서 Supabase(쿠키 세션)로 데이터를 읽어 렌더한다.
- 상호작용이 필요한 곳만 Client Component: 구간 설정 폼, 타이머 실행, 공유 시청, 기록 펼침, "결제 확인 중" 표시.
- DB 쓰기는 Server Action에서만 한다. 쓰기 후 `revalidatePath`로 화면을 갱신한다.
- 계산 로직(시간·판정·평균·한도)은 `lib/`의 순수 함수로 두고, 컴포넌트와 Server Action은 그 함수를 불러 쓴다. 단위 테스트는 주로 여기에 쓴다.
- Route Handler는 외부에서 부르는 곳에만 쓴다: OAuth 콜백, Polar webhook, 서버 시각.

## 데이터 모델 (Supabase Postgres)
모든 테이블에 RLS를 켠다. 정책은 "본인 행만"(`auth.uid() = user_id`)이다. 공개 정책은 만들지 않는다.

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| `timers` | `id` uuid pk, `user_id` uuid, `name` text, `segments` jsonb, `created_at`, `updated_at` | `segments`: `[{ name, durationSec }]` (순서 = 배열 순서) |
| `records` | `id` uuid pk, `user_id` uuid, `timer_id` uuid (fk, on delete cascade), `started_at` timestamptz, `segments` jsonb, `created_at` | `segments`: `[{ name, plannedMs, actualMs }]` — 발표 당시 설정 복사본 |
| `shares` | `code` text pk, `user_id` uuid, `timer_id` uuid (fk, on delete set null), `timer_name` text, `segments` jsonb, `state` jsonb, `created_at`, `updated_at` | 공유 1회 = 1행. 타이머를 지워도 행이 남아 공유 횟수가 유지된다 |
| `orders` | `id` text pk (Polar order id), `user_id` uuid, `paid_at` timestamptz | 쓰기는 webhook(admin)만. 사용자는 본인 행 읽기만 |

- 이용권 만료일은 저장하지 않고 `orders`에서 계산한다: `paid_at` 오름차순으로 `만료 = max(만료, paid_at) + 30일`. (`lib/plan.ts`)
- 공유 시청 페이지는 RLS로 공개하지 않는다. 서버가 admin 클라이언트로 `code`에 해당하는 행 하나만 읽어 초기 상태로 넘긴다.

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
- 화면 값(남은 시간, 직전 결과)은 저장하지 않고 `RunState + segments + 지금 시각`으로 매번 계산한다. 그래서 연결이 끊겨도 시간은 계속 흐른다.
- 정시 판정: `|actualMs - plannedMs| <= 1000`.
- 남은 시간은 초 단위 올림으로 표시해서 "0:00"이 되는 순간이 계획 시간과 맞게 한다. 0을 지나면 경과 초를 "-0:05"처럼 표시한다.

## 데이터 흐름

### 로그인
```
/ "Google로 시작하기" → signInWithGoogle (Server Action) → Supabase OAuth URL로 redirect
→ Google → /auth/callback (code를 세션 쿠키로 교환) → /timers
proxy.ts: 매 요청 세션 갱신, 비로그인으로 /timers·/pass 접근 시 / 로 이동
```

### 타이머 실행 (혼자)
```
탭/스페이스바 → lib/run 리듀서로 RunState 갱신 → localStorage `run:{timerId}`에 저장
→ 200ms마다 lib/timer로 화면 값 계산
→ finished → saveRecord (Server Action) → records insert
```
- 페이지가 다시 열리면 localStorage의 RunState로 이어서 진행한다.
- `saveRecord`가 실패하면 결과 화면에 "다시 저장" 버튼을 보여준다.
- Wake Lock API로 화면 꺼짐을 막고, 탭이 다시 보일 때(`visibilitychange`) 다시 요청한다. 지원하지 않는 브라우저에서는 조용히 넘어간다.

### 공유
```
시작 전 "공유 링크 만들기" → createShare (Server Action)
  → lib/plan으로 한도 확인 → shares insert (code, 타이머 이름·구간 복사, state=idle) → code 반환
발표자 상태 변경마다
  → (a) Realtime Broadcast `share:{code}` 채널로 RunState 전체 전송
  → (b) updateShareState (Server Action)로 shares.state 저장
시청자 /s/[code]
  → 서버: admin 클라이언트로 shares 행 읽기 → 초기 렌더 (없으면 404)
  → 브라우저: Broadcast 구독, 받은 rev가 현재보다 클 때만 반영
  → 브라우저: Presence에 role='viewer'로 참여
발표자: 같은 채널 Presence에서 role='viewer' 수를 세어 "N명 보는 중" 표시
```
- 매번 상태 전체를 보내므로 메시지 몇 개를 놓쳐도 다음 메시지에서 맞춰진다.
- 채널 구독이 끊기면 시청자 화면에 "연결 끊김"을 표시한다. 다시 연결되면 서버에서 shares 행을 다시 읽어 맞춘다.
- 공유 중인 발표는 localStorage에 `shareCode`도 저장해서, 새로고침 후에도 같은 채널로 계속 보낸다.

### 시각 보정
```
페이지 진입 시 /api/time 호출 → offset = serverNow + 왕복시간/2 − Date.now()
clock.now() = Date.now() + offset
```
모든 타임스탬프(`startedAt`, `transitions`)와 화면 계산은 `clock.now()`로 한다. 발표자와 시청자의 기기 시계가 달라도 같은 시간을 보여준다.

### 결제
```
/pass "구매" → createCheckout (Server Action)
  → Polar 체크아웃 생성 (product=POLAR_PRODUCT_ID, metadata.userId, successUrl=/timers?checkout=success)
  → Polar 결제 페이지로 redirect
결제 완료 → /timers?checkout=success → "결제 확인 중…" → 2초 간격으로 최대 10회 이용권 재조회
Polar → /api/polar/webhook (order.paid)
  → 서명 검증 (실패 시 403) → metadata.userId로 orders insert
  → 같은 order id면 무시 (재전송돼도 한 번만 반영)
```
- 이용권은 webhook에서만 생긴다. `successUrl`로 돌아온 것만으로는 아무것도 부여하지 않는다.

### 한도 확인 (`lib/plan.ts`, Server Action에서 호출)
| 동작 | 무료일 때 통과 조건 | 30일권일 때 |
|---|---|---|
| createTimer | 내 timers 수 < 3 | 항상 통과 |
| updateTimer | 새 구간 수 ≤ max(10, 기존 구간 수) | 새 구간 수 ≤ max(30, 기존 구간 수) |
| createShare | 내 shares 수(누적) < 3 | 항상 통과 |

- 30일권 활성 = 계산한 만료일 > 지금.
- 막히면 Server Action이 `{ error: 'LIMIT', kind }`를 돌려주고, 화면은 안내와 "30일권 보기" 버튼을 보여준다.

## 상태 관리
- **서버 상태**(타이머, 기록, 이용권): Server Component에서 읽고, 변경은 Server Action 후 `revalidatePath`. 클라이언트 캐시 라이브러리는 쓰지 않는다.
- **실행 상태**: 실행 화면의 `useReducer`(lib/run 리듀서) + localStorage 복원.
- **구간 설정 폼**: 폼 컴포넌트 안의 `useState`. 저장할 때 Server Action으로 보낸다.
- **공유 시청 상태**: 서버에서 받은 초기 RunState + Broadcast로 받은 최신 RunState(`rev` 비교).

## 환경 변수
| 이름 | 용도 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | OAuth redirect, Polar successUrl | 공개 |
| `CONTACT_EMAIL` | 하단 문의 이메일 | 서버 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 주소 | 공개 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저·쿠키 세션 클라이언트 | 공개 |
| `SUPABASE_SECRET_KEY` | admin 클라이언트 (webhook, 공유 시청 초기 조회) | 서버 전용 |
| `DATABASE_URL` | 마이그레이션 적용용. 앱 코드에서 쓰지 않는다 | 서버 전용 |
| `POLAR_ENVIRONMENT` | `sandbox` | 서버 전용 |
| `POLAR_ACCESS_TOKEN` | 체크아웃 생성 | 서버 전용 |
| `POLAR_WEBHOOK_SECRET` | webhook 서명 검증 | 서버 전용 |
| `POLAR_PRODUCT_ID` | 30일권 상품 ($3.99, 1회 결제) | 서버 전용 |

## 테스트
- Vitest + Testing Library.
- `lib/`의 순수 함수는 경계값까지 단위 테스트한다: 정시 ±1초 경계, 되돌리기, 마지막 구간 종료, 이용권 연장 계산, 한도 경계, 평균 대상 필터.
- Server Action은 Supabase·Polar 클라이언트를 mock해서 테스트한다: 한도 초과 거절, 본인 행만 처리.
- webhook은 서명 실패 거절과 같은 order id 중복 무시를 테스트한다.
