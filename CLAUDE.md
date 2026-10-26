# 프로젝트: Podium Timer

발표·토론을 구간으로 나눠, 구간을 넘길 때마다 계획보다 빨랐는지 늦었는지 보여주는 모바일 웹 페이스 타이머. MVP는 프로토타입이다. 동작하는 가장 단순한 구현을 고른다. 범위는 docs/PRD.md를 따르고, "MVP 제외 사항"에 있는 기능은 만들지 않는다.

- 제품 요구·정책: `docs/PRD.md`
- 구조·인터페이스·DB·보안·배포: `docs/ARCHITECTURE.md`
- 결정 근거: `docs/ADR.md`
- 화면 규칙: `docs/UI_GUIDE.md`

## 기술 스택
- Next.js (App Router)
- TypeScript strict mode
- Tailwind CSS
- Supabase (Auth: Google, Postgres, Realtime Broadcast·Presence)
- Polar (sandbox, 1회 결제 상품 "30일권")
- zod (입력 검사)
- Vitest + Testing Library
- 배포: Vercel CLI, 마이그레이션: Supabase CLI

## 아키텍처 규칙
- CRITICAL: 화면 코드(`src/components/`, `src/app/`의 페이지)는 `src/services/api`와 `src/services/realtime`만 부른다. 컴포넌트에서 Supabase·Polar SDK나 Server Action을 직접 부르지 않는다. 이유: mock/live 전환 시 화면 코드를 고치지 않기 위해.
- CRITICAL: live 모드의 DB 쓰기는 서버(`src/actions/`의 Server Action, `src/app/api/`의 Route Handler)에서만 한다. 브라우저 Supabase 클라이언트(`lib/supabase/browser.ts`)는 Realtime(Broadcast·Presence)에만 쓴다.
- CRITICAL: 무료/30일권 한도와 이용권 판정은 `src/lib/plan.ts`에만 둔다. 타이머·구간 한도 확인은 Server Action에서 한다(화면 표시용으로 클라이언트에서 같은 함수를 쓰는 것은 괜찮다).
- CRITICAL: live 모드에서 30일권은 서명 검증을 통과한 Polar webhook(`order.paid`)에서만 부여한다. 결제 후 돌아오는 `successUrl`로는 아무것도 부여하지 않는다. mock의 "가짜 결제"만 예외다.
- CRITICAL: `SUPABASE_SECRET_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`은 서버 코드에서만 읽는다. `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 컴포넌트에서 import하지 않는다. admin 클라이언트(`lib/supabase/admin.ts`)는 webhook과 공유 상태 조회(`/api/share/[code]`)에만 쓴다.
- CRITICAL: Supabase 테이블에 비로그인 사용자용 공개 RLS 정책을 만들지 않는다.
- CRITICAL: Realtime 메시지는 "바뀌었음" 신호로만 쓴다. 메시지 내용으로 화면 상태를 바꾸지 말고 서버에서 다시 읽는다.
- 시간 계산(남은 시간, 진행 위치, 구간 차이, 정시 판정)은 `src/lib/timer.ts`의 순수 함수로만 한다. `stats.ts`·`format.ts`도 판정은 `timer.ts`를 부른다. 컴포넌트에 계산식을 직접 쓰지 않는다. 타임스탬프는 `lib/clock.ts`의 서버 보정 시각을 쓴다.
- 입력 검사는 `src/lib/validation.ts`의 zod 스키마 하나로 화면과 서버가 같이 한다.
- 화면 문구와 에러 메시지는 `src/lib/messages.ts`에 모은다. 한국어, 짧은 존댓말("~해요"). 컴포넌트에 문구를 직접 쓰지 않는다.
- 컴포넌트는 `src/components/`, 타입은 `src/types/`에 둔다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다 (TDD 가드 훅이 이 위치를 확인한다).
- `npm test`는 외부 서비스·네트워크·Docker 없이 통과해야 한다. 외부 SDK는 mock으로 대체하고, 화면 테스트는 mock 구현으로 돌린다.
- `npm run build`는 환경 변수 없이도 성공해야 한다. 환경 변수는 실행 시점에 검사하고, `NEXT_PUBLIC_DATA_MODE`가 없으면 mock 모드로 동작한다.
- CRITICAL: `vercel deploy`는 배포 step에서 `npm run deploy`로만, `supabase db push`는 DB 반영 step에서 `npm run db:push`로만 실행한다. 그 외 step에서는 실제 서비스를 바꾸는 명령을 실행하지 않는다.
- CRITICAL: 원격 DB에 `supabase db reset`을 실행하지 않는다. 이미 원격에 적용된 마이그레이션 파일을 고치지 말고 새 마이그레이션을 추가한다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, test:, chore:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (Vitest)
npm run deploy   # Vercel 운영 배포 (배포 step 전용)
npm run db:push  # Supabase 마이그레이션 반영 (DB 반영 step 전용)
