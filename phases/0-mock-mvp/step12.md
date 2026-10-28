# Step 12: billing-screens

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("플랜", "결제", "화면", "흐름 E. 결제와 플랜")
- `/docs/ARCHITECTURE.md` ("결제", "API 라우트"의 checkout, "보안 규칙"의 returnTo, "mock 모드")
- `/docs/ADR.md` (ADR-009, ADR-010, ADR-011)
- `/docs/DESIGN.md` (레이아웃, 버튼, 안내, 문구)
- `/src/types/api.ts`
- `/src/lib/billing.ts`, `/src/lib/validation.ts` (`safeReturnTo`), `/src/lib/messages.ts`
- `/src/services/api/index.ts`, `/src/services/api/mock.ts` (`startCheckout`, `getPlanStatus`)
- `/src/components/PageShell.tsx`, `/src/components/RequireAuth.tsx`, `/src/components/TimerList.tsx` (플랜 표기)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

요금제 화면과 결제 완료 화면을 만든다. 이번 phase는 mock "가짜 결제"로 전체 흐름(결제 → 30일권 반영 → 원래 화면 복귀)이 동작하게 한다.

TDD: 컴포넌트마다 옆에 `*.test.tsx`를 먼저 만든다(TDD 가드). 테스트는 `vi.useFakeTimers()`, `vi.mock('@/services/api')` 또는 실제 `mockApi`, `next/navigation` 목을 쓴다. `window.location.assign`도 목으로 바꾼다.

### 1. 페이지
- `src/app/pricing/page.tsx`: `PageShell` > `RequireAuth` > `PricingView returnTo={safeReturnTo(searchParams.returnTo, '/timers')}`
- `src/app/billing/success/page.tsx`: `PageShell` > `RequireAuth` > `BillingSuccess returnTo={safeReturnTo(searchParams.returnTo, '/timers')}`
- `searchParams`는 page에서 읽어 prop으로 넘긴다(클라이언트 `useSearchParams` 금지 — 빌드 때 Suspense 경계 에러). 설치된 Next 버전이 Promise로 주면 `await`한다.

### 2. `src/components/PricingView.tsx`
props `{ returnTo: string }`.
- 비교 표(항목 · 무료 · 30일권): 타이머 수(3개 / 무제한), 타이머 1개당 구간 수(10개 / 30개), 공유 동시 접속·발표자 포함(3명 / 10명), 공유 링크 만들기(제한 없음 / 제한 없음), 기록·평균(제한 없음 / 제한 없음). 숫자는 `LIMITS`에서 가져온다.
- 가격: `$3.99` · 30일 · 자동 갱신 없음 (`PASS_PRICE_USD`). 원화 환산은 표시하지 않는다.
- `api.getPlanStatus()`로 지금 플랜을 보여준다. 30일권이면 "30일권 · 11월 25일까지"와 "지금 사면 만료일에 30일이 더해져요".
- 구매 버튼(Primary): mock이면 "가짜 결제 ($3.99)", live면 "30일권 구매 $3.99" (`dataMode`로 고른다). 누르면 `api.startCheckout(returnTo)` → 성공하면 `window.location.assign(url)`, 실패하면 `errorMessage`.
- [돌아가기] → `returnTo`.

### 3. `src/components/BillingSuccess.tsx`
props `{ returnTo: string }`.
- "30일권 반영 중"을 보여주고 `api.getPlanStatus()`를 바로 한 번, 그 뒤 2초 간격으로 확인한다. 최대 10회.
- `plan === 'pass'`면 반영된 것으로 보고 `router.replace(returnTo)`. (이미 30일권이 있던 연장 결제는 웹훅보다 먼저 돌아갈 수 있다. 프로토타입이라 허용한다.)
- 10회 안에 반영되지 않으면 "결제는 완료됐어요, 반영이 늦어지고 있어요"를 보여주고 3초 뒤 `/timers`로 보낸다. [타이머 목록으로] 링크도 둔다.
- 이 화면은 아무것도 부여하지 않는다. 읽기만 한다.
- 언마운트 때 타이머를 정리한다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 비교 표 숫자가 `LIMITS`와 일치, mock 버튼 문구 "가짜 결제", `startCheckout`에 받은 `returnTo` 전달 후 `location.assign`, 30일권 사용자에게 연장 안내, 결제 완료 화면이 반영되면 `returnTo`로 이동, 10회 확인 실패 → 지연 문구 후 `/timers`, 결제 완료 화면이 `startCheckout`이나 쓰기 메서드를 부르지 않음.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/app/pricing/`, `src/app/billing/success/`)
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (결제 후 돌아오는 주소로 아무것도 부여하지 않음, mock 가짜 결제만 예외)
   - DESIGN.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `/billing/success`에서 주문을 만들거나 플랜을 바꾸지 마라. 이유: AGENTS.md CRITICAL, live에서 30일권은 서명 검증된 웹훅에서만 생긴다.
- Polar SDK를 설치하거나 `/api/billing/*` 라우트를 만들지 마라. 이유: 다음 phase(2-polar) 범위다.
- 연간 구독, 결제 내역 화면, 원화 가격을 만들지 마라. 이유: PRD MVP 제외 사항이다.
- `returnTo`를 검사 없이 쓰지 마라. 이유: 외부 URL로 보내는 오픈 리다이렉트가 된다. `safeReturnTo`만 쓴다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
