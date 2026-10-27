# Step 13: deploy-mock

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (특히 `npm run deploy` 규칙)
- `/docs/ARCHITECTURE.md` ("배포와 DB 반영", "환경 변수")
- `/docs/ADR.md` (ADR-012, ADR-013)
- `/package.json` (`deploy` 스크립트), `/vercel.json`, `/next.config.ts`, `/.gitignore`
- `/src/app/layout.tsx`, `/src/components/MockBadge.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

mock 모드 앱을 Vercel 운영 환경에 **1차 배포**한다. 이 phase에서 실제 서비스를 바꾸는 명령을 실행하는 유일한 step이다.

1. 배포 전 확인: `npm run lint && npm run build && npm test`가 통과해야 한다.
2. Vercel 인증 확인: `npx vercel whoami`. 실패하면 `blocked`(사유: "Vercel CLI 로그인 필요 — `vercel login` 후 재실행")로 기록하고 즉시 중단한다.
3. 배포: `npm run deploy` (= `vercel deploy --prod --yes`). 처음 실행이면 프로젝트를 만들고 연결한다(`.vercel/`은 gitignore돼 있다). Vercel에 환경변수를 등록하지 않는다. `NEXT_PUBLIC_DATA_MODE`가 없으므로 mock으로 빌드된다.
   - Vercel 빌드가 코드 문제로 실패하면 원인을 고치고(로컬 lint·build·test 통과 확인) 다시 `npm run deploy`한다. 고친 내용을 summary에 적는다.
4. 운영 주소 찾기: 배포 출력에서 운영 별칭(`https://<프로젝트>.vercel.app` 형태, 배포마다 바뀌는 고유 주소가 아닌 것)을 찾는다. 출력에 없으면 `npx vercel inspect <배포 주소>`의 Aliases에서 찾는다.
5. 확인:
   ```bash
   curl -sS -o /dev/null -w '%{http_code}' <운영 주소>          # 200
   curl -sS <운영 주소> | grep -q 'MOCK 모드'                   # mock 배지가 서버 HTML에 있음
   curl -sSI <운영 주소> | grep -i "frame-ancestors 'none'"     # 보안 헤더
   ```
   운영 주소가 401·403이면(배포 보호가 켜짐) `blocked`(사유: "Vercel Deployment Protection이 운영 주소를 막고 있음 — 대시보드에서 운영 도메인 보호 해제 필요")로 기록하고 중단한다.
6. `.env`의 `NEXT_PUBLIC_SITE_URL` 줄 **하나만** 운영 주소(끝에 `/` 없음)로 바꾼다. 다른 줄은 건드리지 않는다. `.env` 내용을 출력하지 않는다(예: 해당 줄만 치환하는 짧은 node/sed 명령을 쓰고 결과는 `grep -c '^NEXT_PUBLIC_SITE_URL=https://' .env`로만 확인).
7. summary에 운영 주소를 반드시 적는다. 다음 phase(1-supabase)에서 Supabase Auth Site URL·리다이렉트 허용 목록과 Polar 웹훅 주소에 쓴다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
npm run deploy  # 운영 배포 성공
# 운영 주소 200 응답, HTML에 "MOCK 모드", frame-ancestors 'none' 헤더
```

## 검증 절차

1. 위 AC 커맨드와 "작업" 5번 확인을 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md "배포와 DB 반영"의 1차 배포 절차를 따랐는가?
   - ADR 기술 스택을 벗어나지 않았는가? (Vercel CLI, 함수 리전 서울)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (배포는 `npm run deploy`로만, 비밀 키 노출 없음)
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (운영 주소, Vercel 프로젝트 이름, 고친 내용이 있으면 그것)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (Vercel 로그인, 배포 보호 해제 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `vercel deploy`를 직접 부르지 마라. `npm run deploy`로만 배포한다. 이유: AGENTS.md CRITICAL.
- `vercel env add`·`vercel env rm`, 도메인·별칭 변경, 프로젝트 삭제, 배포 삭제를 하지 마라. 이유: 1차 배포는 환경변수 없이 mock으로 한다. 환경변수 등록은 다음 phase의 `scripts/sync-env.sh`가 한다.
- `.env`를 출력하거나 `NEXT_PUBLIC_SITE_URL` 외의 줄을 바꾸지 마라. 이유: 비밀 키가 들어갈 파일이다.
- `supabase` 명령, `npm run db:push`를 실행하지 마라. 이유: 다음 phase의 DB 반영 step 범위다.
- 이 step에서 새 기능을 추가하지 마라. 배포 실패를 고치는 최소 수정만 한다. 이유: 배포 step이다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
