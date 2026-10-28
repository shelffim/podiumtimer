# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (기술 스택, 디렉토리 구조, 환경 변수, 배포와 DB 반영, 테스트)
- `/docs/ADR.md` (ADR-001, ADR-012, ADR-013, ADR-014, ADR-015)
- `/docs/DESIGN.md` (색상의 배경·텍스트, 타이포그래피의 글꼴)
- `/.gitignore`
- `/scripts/hooks/tdd-guard.sh` (어떤 파일이 테스트 없이 만들 수 있는지)
- `/.codex/hooks.json` (작업 종료 시 `npm run lint && npm run build && npm run test`가 실행된다)

지금 저장소에는 문서·스크립트만 있고 앱 코드가 없다. 이 step은 Next.js 앱 뼈대만 만든다.

## 작업

### 1. 패키지
`package.json`을 직접 만든다 (`name: "podiumtimer"`, `private: true`).

- dependencies: `next`(최신 안정 버전), `react`, `react-dom`, `zod`
- devDependencies: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss`와 그 버전에 맞는 PostCSS 플러그인, `eslint`, `eslint-config-next`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `vercel`
- `vercel`은 `npm install -D --save-exact vercel`로 버전을 고정한다 (ARCHITECTURE "배포와 DB 반영").
- scripts:
  ```
  dev     next dev
  build   next build
  start   next start
  lint    ESLint 실행 (설치한 Next 버전에 `next lint`가 없으면 `eslint .`)
  test    vitest run --passWithNoTests
  deploy  vercel deploy --prod --yes
  ```
  `db:push`는 이 phase에서 만들지 않는다.
- `package-lock.json`도 남긴다.

### 2. 설정 파일
- `tsconfig.json`: `strict: true`, 경로 별칭 `@/*` → `./src/*`, App Router 기본 설정.
- `next.config.ts`: 모든 경로에 `Content-Security-Policy: frame-ancestors 'none'` 헤더 하나만 붙인다 (ARCHITECTURE 보안 규칙).
- Tailwind CSS: 설치한 버전의 공식 방식대로 설정한다 (v4면 `postcss.config.mjs` + `globals.css`의 `@import "tailwindcss"`).
- `eslint.config.mjs`: Next.js core-web-vitals와 TypeScript 규칙.
- `vitest.config.ts`: 환경 `jsdom`, `@vitejs/plugin-react`, 별칭 `@` → `src`, 테스트 대상 `src/**/*.test.{ts,tsx}`, setupFiles `vitest.setup.ts`.
- `vitest.setup.ts`: `@testing-library/jest-dom/vitest`를 불러온다.
- `vercel.json`: `{ "regions": ["icn1"] }` (함수 리전 서울).
- `.env.example`: ARCHITECTURE "환경 변수" 표의 이름을 모두 값 없이 적는다 (`NEXT_PUBLIC_DATA_MODE=` 등). 각 줄 위에 용도를 짧은 주석으로 단다.

### 3. 최소 앱
- `src/app/globals.css`: Tailwind를 불러오고 `html`/`body`에 배경 `#0a0a0a`, 기본 글자색 `#d4d4d4`(neutral-300), `color-scheme: dark`, 시스템 글꼴 `-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`를 건다.
- `src/app/layout.tsx`: `<html lang="ko">`, `globals.css`를 불러오고, metadata title은 `Podium Timer`.
- `src/app/page.tsx`: 임시 페이지 (step 5에서 랜딩으로 바꾼다). 서비스 이름만 보여준다.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build    # 컴파일 에러 없음
npm test         # 테스트 통과 (아직 테스트 없음)
npx vercel --version
git diff --quiet -- AGENTS.md CLAUDE.md docs scripts .claude .codex   # 기존 하네스 파일이 그대로인지
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/app` 아래 App Router)
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (설치된 Next·Tailwind·zod·Vitest 버전과 lint 명령 방식을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 폴더에서 `create-next-app`을 바로 실행하지 마라. 이유: 기존 파일(`AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`, `.gitignore`, `.env`)과 충돌하거나 덮어쓴다. 참고가 필요하면 저장소 밖 임시 폴더에 만들어 보고, 설정 파일만 직접 옮겨 적어라. 그 폴더의 `AGENTS.md`·`CLAUDE.md`·`README.md`는 옮기지 마라.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다. `.gitignore`는 항목을 지우지 마라(추가만 허용).
- Supabase·Polar SDK(`@supabase/*`, `@polar-sh/*`)와 `supabase` CLI를 설치하지 마라. 이유: 다음 phase(1-supabase, 2-polar) 범위다.
- UI 컴포넌트 라이브러리, 차트, 아이콘 패키지, 상태 관리, 날짜 라이브러리를 설치하지 마라. 이유: ADR 기술 스택 밖이다. 그래프는 `div`, 아이콘은 인라인 SVG로 그린다.
- `next/font`를 포함해 웹폰트를 불러오지 마라. 이유: DESIGN.md는 시스템 글꼴만 쓴다.
- `package.json`에 `engines`로 Node 버전을 고정하지 마라. 이유: 로컬 Node(26)와 Vercel 빌드 Node가 달라 배포가 실패할 수 있다.
- `npm run deploy`나 `vercel` 명령(`vercel --version` 제외)을 실행하지 마라. 이유: 배포는 step 13에서만 한다.
- `.env`를 열거나 출력하거나 고치지 마라. 이유: 비밀 키가 들어갈 파일이다.
- `src/lib`, `src/services`, `src/components`, `src/types`에 파일을 만들지 마라. 이유: 다음 step 범위다.
- 기존 테스트를 깨뜨리지 마라
