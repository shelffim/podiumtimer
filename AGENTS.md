# 프로젝트: Podium Timer

발표·토론을 구간으로 나눠, 구간을 넘길 때마다 계획보다 빨랐는지 늦었는지 보여주는 모바일 웹 페이스 타이머. 목적은 **프로토타입 수준의 MVP**다. 단순하게 갈 수 있는 곳은 단순하게 간다. 범위는 `docs/PRD.md`를 따르고, "MVP 제외 사항"에 있는 기능은 만들지 않는다.

- 제품 요구·정책: `docs/PRD.md`
- 구조·인터페이스·DB·보안: `docs/ARCHITECTURE.md`
- 결정 근거: `docs/ADR.md`
- 화면 규칙: `docs/DESIGN.md`
- 브라우저 테스트 시나리오·알려진 문제: `docs/BROWSER_TEST.md` (브라우저로 확인할 때마다 이 문서를 따른다)

## 기술 스택
- Next.js (App Router) + TypeScript strict mode
- Tailwind CSS
- Supabase (Auth: Google, Postgres, Realtime Broadcast·Presence) — supabase-js만 사용
- Polar (sandbox) 결제 — 30일권 1회 결제 상품 하나
- zod 입력 검사
- Vitest + React Testing Library
- Vercel 배포 (Vercel CLI), Supabase CLI 마이그레이션

## 아키텍처 규칙
- CRITICAL: 화면 코드(components/, app/의 페이지)는 `src/services/api`와 `src/services/realtime`의 인터페이스만 호출한다. 컴포넌트에서 Supabase·Polar SDK나 서버 액션을 직접 부르지 마라. 이유: mock/live 전환 시 화면 코드를 고치지 않기 위해.
- CRITICAL: 시간 계산·판정·실행 상태 전이·평균·입력 검사·플랜 한도·만료일·입장 판정은 `src/lib`의 순수 함수 하나로만 한다. 같은 규칙을 서버·mock·화면에 다시 구현하지 마라. 이유: 규칙이 두 군데 있으면 어긋난다.
- CRITICAL: live 모드의 모든 쓰기는 서버 액션·API 라우트에서 로그인 사용자와 소유권을 확인한 뒤 비밀 키로 한다. RLS 정책은 자기 행 읽기(select)만 둔다. 비로그인 사용자용 공개 정책은 만들지 마라.
- CRITICAL: DB 함수(RPC)·트랜잭션·직접 DB 연결(`pg` 등)을 만들지 마라. 동시성은 supabase-js의 조건부 업데이트와 기본 키·유니크 제약으로 처리한다.
- CRITICAL: 비밀 키(`SUPABASE_SECRET_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`)는 서버 코드에서만 쓰고 `NEXT_PUBLIC_` 환경변수에 넣지 마라. 코드에 키 값을 직접 쓰지 마라. admin 클라이언트는 서버 액션의 쓰기, `/api/share/[code]`, 결제 웹훅에서만 쓴다.
- CRITICAL: live 모드에서 30일권은 서명 검증을 통과한 Polar 웹훅(`order.paid`)에서만 생긴다. 결제 후 돌아오는 주소로는 아무것도 부여하지 마라. mock의 "가짜 결제"만 예외다.
- CRITICAL: Realtime 메시지는 "바뀌었음" 힌트로만 쓴다. 메시지 내용으로 화면 상태나 권한을 바꾸지 말고 서버에서 다시 읽어라.
- 매초 상태를 전송하지 않는다. 실행 상태(시작 시각, '다음' 누른 시각)만 저장하고 각 화면이 `computeTimer`로 계산한다.
- 문구·에러 메시지는 `src/lib/messages.ts`에 모은다 (한국어만, 짧은 존댓말 "~해요"). 컴포넌트에 문구를 직접 쓰지 않는다.
- 컴포넌트는 `components/`, 타입은 `types/`, 순수 로직은 `lib/`, 외부 연동은 `services/`에 둔다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다 (TDD 가드 훅이 이 위치를 확인한다).
- `npm test`는 외부 서비스·네트워크·Docker 없이 통과해야 한다. 외부 SDK는 목으로 대체한다.
- `npm run build`는 환경변수 없이도 성공해야 한다. 환경변수는 실행 시점에 검사하고, `NEXT_PUBLIC_DATA_MODE`가 없으면 mock 모드로 동작한다.
- CRITICAL: `vercel deploy`는 배포 step에서 `npm run deploy`로만, `supabase db push`는 DB 반영 step에서 `npm run db:push`로만 실행한다. 그 외 step에서는 실제 서비스를 바꾸는 명령을 실행하지 마라.
- CRITICAL: 원격 DB에 `supabase db reset`을 실행하지 마라. 이미 원격에 적용된 마이그레이션 파일을 고치지 말고 새 마이그레이션을 추가하라.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, test:, chore:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (Vitest)
npm run deploy   # Vercel 운영 배포 (배포 step 전용)
npm run db:push  # Supabase 마이그레이션 반영 (DB 반영 step 전용)
