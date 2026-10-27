# Step 5: app-shell

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("화면", "흐름 A", "로그인과 공유", "결제", "디자인")
- `/docs/ARCHITECTURE.md` (핵심 규칙 R1·R2, 디렉토리 구조, "보안 규칙", "에러 처리", "mock 모드", 환경 변수 `CONTACT_EMAIL`)
- `/docs/ADR.md` (ADR-003, ADR-012, ADR-014, ADR-016)
- `/docs/UI_GUIDE.md` (전체)
- `/src/app/layout.tsx`, `/src/app/page.tsx`, `/src/app/globals.css`
- `/src/services/api/index.ts`, `/src/services/api/mock.ts`
- `/src/lib/messages.ts`, `/src/lib/validation.ts` (`safeReturnTo`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

모든 화면이 쓰는 틀(레이아웃·MOCK 배지·관리 화면 틀·푸터·로그인 확인)과 랜딩·약관·에러 화면을 만든다.

TDD: `src/components/`의 컴포넌트마다 옆에 `*.test.tsx`를 먼저 만든다(TDD 가드). `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`는 예외다. 화면 테스트는 실제 `mockApi`(localStorage를 테스트마다 비움)나 `vi.mock('@/services/api')`로 하고, `next/navigation`은 목으로 바꾼다.

### 1. 루트 레이아웃 `src/app/layout.tsx`
- `<html lang="ko">`, `body`에 페이지 배경 `#0a0a0a`, metadata title `Podium Timer`, viewport `width=device-width, initial-scale=1`, theme color `#0a0a0a`.
- `dataMode === 'mock'`이면 서버에서 `MockBadge`를 그린다: "MOCK 모드 · 데이터는 이 브라우저에만 저장돼요", 클래스 `bg-amber-500/15 text-amber-300 border border-amber-500/40`, `text-xs`. 화면 아래쪽에 고정하고 `pointer-events-none`으로 타이머 화면 탭을 가리지 않게 한다.

### 2. 공통 컴포넌트 (`src/components/`)
- `MockBadge.tsx`: props `{ mode: DataMode }`. mock일 때만 그린다.
- `PageShell.tsx` (Server Component, `'use client'` 없음): 관리 화면 틀. `max-w-xl mx-auto px-4`, 좌측 정렬, 섹션 사이 `space-y-8`, 맨 아래 `Footer`. 문의 이메일은 여기서 `process.env.CONTACT_EMAIL`을 읽어 `Footer`에 넘긴다.
- `Footer.tsx`: props `{ contactEmail?: string }`. `개인정보처리방침 · 이용약관 · 문의 이메일`, `text-xs text-neutral-500`. 이메일이 비어 있으면 이메일만 뺀다(`mailto:` 링크).
- `RequireAuth.tsx` (Client): `api.getUser()`로 확인한다. 확인 중에는 아무것도 그리지 않는다. 사용자가 없으면 `router.replace('/?next=' + encodeURIComponent(지금 경로 + 쿼리))`. 있으면 children을 그린다.
- `Landing.tsx` (Client): props `{ next?: string }`.
  - 서비스 이름 `Podium Timer`(로고 없음, `text-neutral-50`), 한 줄 소개("구간마다 계획보다 빨랐는지 늦었는지 알려주는 발표 타이머" 정도), 로그인 버튼(Primary).
  - 버튼 문구: mock이면 "체험 계정으로 로그인", live면 "Google로 로그인". 누르면 `api.signIn(next)` 뒤 `router.push(safeReturnTo(next, '/timers'))`.
  - 버튼 아래 "만 14세 이상 이용할 수 있어요"와 이용약관·개인정보처리방침 링크.
  - 이미 로그인했으면 `router.replace(safeReturnTo(next, '/timers'))`.
  - 마케팅 장식, 미리보기, 그라데이션을 넣지 않는다(UI_GUIDE 원칙 3, PRD MVP 제외 "랜딩 화면 미리보기").

### 3. 페이지
- `src/app/page.tsx`: `PageShell` + `Landing`. `searchParams`의 `next`를 prop으로 넘긴다(클라이언트에서 `useSearchParams`를 쓰지 마라 — 빌드 때 Suspense 경계 에러가 난다). 설치된 Next 버전이 `searchParams`를 Promise로 주면 `await`한다.
- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`: `PageShell` 안에 제목과 섹션들. 내용은 `MESSAGES.terms`, `MESSAGES.privacy`(섹션 제목 + 문단 배열)에서 가져온다.
- `src/app/error.tsx` (Client): "문제가 생겼어요" + [다시 시도](`reset`). `src/app/not-found.tsx`: "페이지를 찾을 수 없어요" + [처음으로].

### 4. 약관·개인정보처리방침 초안 (`src/lib/messages.ts`에 추가)
프로토타입 초안이다. 실서비스 전 최종 검토는 PRD 체크리스트에 있다. 짧은 존댓말로 쓴다.
- 이용약관: 서비스 내용, 계정(만 14세 이상, Google 로그인), 30일권($3.99, 자동 갱신 없음, 결제한 때부터 30일, 이용권이 남아 있을 때 다시 사면 만료일에 30일 연장, Polar가 판매 대행), **지금은 테스트 결제 단계라 실제로 청구되지 않음**, 환불(아래 문의 이메일로 요청하면 Polar를 통해 수동 처리), 회원 탈퇴(문의 이메일로 요청), 프로토타입이라 데이터가 사라질 수 있음, 약관 변경.
- 개인정보처리방침: 수집 항목(발표자의 Google 계정 이메일·이름·식별자, 타이머·기록, 결제는 Polar가 처리하고 앱은 주문 ID와 결제 시각만 저장), 시청자 닉네임은 저장하지 않고 접속 표시에만 씀, 기기에 저장하는 값(실행 상태·닉네임·기기 식별값), 처리 위탁(Supabase, Vercel, Polar), 보관과 삭제(탈퇴 요청 시 삭제), 문의(하단 문의 이메일).
- 본문에 이메일 주소를 직접 쓰지 말고 "하단 문의 이메일"이라고 쓴다. 이유: 주소는 환경변수로만 넣는다.

### 5. 스타일
UI_GUIDE의 버튼·패널·포커스 클래스를 그대로 쓴다. 모서리는 `rounded-md`. 터치 대상 최소 44×44px.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: `MockBadge`가 mock에서만 보임, `Footer`가 이메일 없을 때 이메일만 뺌, `RequireAuth`가 비로그인 시 `next`를 붙여 `/`로 보냄, `Landing` 로그인 후 `safeReturnTo` 경로로 이동(외부 URL이면 `/timers`).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (화면은 `services/api`만 부름, 문구는 messages)
   - UI_GUIDE.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 공통 컴포넌트와 props)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 컴포넌트에 문구를 직접 쓰지 마라. 이유: 모든 문구는 `src/lib/messages.ts`에 모은다(서비스 이름 `Podium Timer`도 messages에 둔다).
- 문의 이메일이나 다른 개인 정보를 코드·문구에 직접 쓰지 마라. 이유: `CONTACT_EMAIL` 환경변수로만 넣는다.
- `proxy.ts`(또는 middleware)를 만들지 마라. 이유: live 보호 경로는 다음 phase에서 만든다. mock은 `RequireAuth`가 처리한다.
- `backdrop-blur`, 그라데이션 텍스트, 글로우, 보라/인디고, 라이트 모드 버튼을 쓰지 마라. 이유: UI_GUIDE 안티패턴이다.
- 계정 화면, 로그인 전 데모, 영어 전환을 만들지 마라. 이유: PRD MVP 제외 사항이다.
- `dangerouslySetInnerHTML`을 쓰지 마라. 이유: ARCHITECTURE 보안 규칙이다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
