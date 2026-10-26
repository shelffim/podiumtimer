# 프로젝트: Podium Timer

발표·토론을 구간으로 나눠, 구간을 넘길 때마다 계획보다 빨랐는지 늦었는지 보여주는 모바일 웹 페이스 타이머. MVP는 프로토타입이다. 동작하는 가장 단순한 구현을 고른다. 범위는 docs/PRD.md를 따르고, "MVP 제외 사항"에 있는 기능은 만들지 않는다.

## 기술 스택
- Next.js (App Router)
- TypeScript strict mode
- Tailwind CSS
- Supabase (Auth: Google, Postgres, Realtime Broadcast·Presence)
- Polar (sandbox, 1회 결제 상품 "30일권")
- Vitest + Testing Library
- 배포: Vercel

## 아키텍처 규칙
- CRITICAL: DB 쓰기는 서버(`src/actions/`의 Server Action, `src/app/api/`의 Route Handler)에서만 한다. 브라우저 Supabase 클라이언트(`lib/supabase/browser.ts`)는 Realtime(Broadcast·Presence)에만 쓴다.
- CRITICAL: 무료/30일권 한도와 이용권 판정은 `src/lib/plan.ts`에만 둔다. 한도 확인은 Server Action에서 한다(화면 표시용으로 클라이언트에서 같은 함수를 쓰는 것은 괜찮다).
- CRITICAL: 30일권은 서명 검증을 통과한 Polar webhook(`order.paid`)에서만 부여한다. 결제 후 돌아오는 `successUrl`로는 아무것도 부여하지 않는다.
- CRITICAL: `SUPABASE_SECRET_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`은 서버 코드에서만 읽는다. `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 컴포넌트에서 import하지 않는다. admin 클라이언트(`lib/supabase/admin.ts`)는 webhook과 공유 시청 초기 조회에만 쓴다.
- CRITICAL: Supabase 테이블에 비로그인 사용자용 공개 RLS 정책을 만들지 않는다.
- 시간 계산(남은 시간, 구간 차이, 정시 판정)은 `src/lib/timer.ts`의 순수 함수로만 한다. 컴포넌트에 계산식을 직접 쓰지 않는다. 타임스탬프는 `lib/clock.ts`의 서버 보정 시각을 쓴다.
- 컴포넌트는 `src/components/`, 타입은 `src/types/`에 둔다.
- 화면 문구는 한국어로 쓴다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다 (TDD 가드 훅이 이 위치를 확인한다).
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
