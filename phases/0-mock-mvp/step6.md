# Step 6: timers-screens

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("핵심 기능" 1, "플랜", "입력 범위", "화면", "흐름 A", "흐름 B ①", "흐름 E", "예외 상황")
- `/docs/ARCHITECTURE.md` (핵심 규칙 R1·R2·R3, "서버 액션"의 에러 코드)
- `/docs/UI_GUIDE.md` (전체, 특히 입력 필드·안내·레이아웃·문구)
- `/src/types/timer.ts`, `/src/types/api.ts`
- `/src/lib/validation.ts`, `/src/lib/billing.ts`, `/src/lib/timer.ts`, `/src/lib/messages.ts`
- `/src/services/api/index.ts`, `/src/services/api/mock.ts`
- `/src/components/PageShell.tsx`, `/src/components/RequireAuth.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

발표자의 타이머 목록·만들기·편집 화면을 만든다.

TDD: 컴포넌트마다 옆에 `*.test.tsx`를 먼저 만든다(TDD 가드). 화면 테스트는 실제 `mockApi`(테스트마다 localStorage 비움)로 돌리고 `next/navigation`은 목으로 바꾼다.

### 1. 페이지 (얇은 Server Component)
- `src/app/timers/page.tsx`: `PageShell` > `RequireAuth` > `TimerList`
- `src/app/timers/new/page.tsx`: `PageShell` > `RequireAuth` > `TimerEditor`
- `src/app/timers/[id]/page.tsx`: `PageShell` > `RequireAuth` > `TimerEditor timerId={id}` (설치된 Next 버전이 `params`를 Promise로 주면 `await`)

### 2. `src/components/TimerList.tsx`
- `api.listTimers()`와 `api.getPlanStatus()`로 읽는다. `UNAUTHENTICATED`면 `/`로.
- 위쪽: 페이지 제목, 플랜 줄("무료" / "30일권 · 11월 25일까지" — 날짜 표기 함수는 messages에), [30일권 구매] → `/pricing?returnTo=/timers`, [로그아웃] → `api.signOut()` 뒤 `/`.
- [새 타이머] 버튼. 무료면 버튼에 "2/3"처럼 `timerCount / LIMITS.free.timers`를 표시한다.
  - 누르면 `checkTimerLimit({ plan, existingTimerCount: timerCount, segmentCount: 0, isNew: true })`로 먼저 확인한다. 한도면 목록 위에 안내 박스(`planLimitMessage` + [30일권 보기] → `/pricing?returnTo=/timers`)를 보여주고, 아니면 `/timers/new`로 간다.
  - 버튼을 숨기거나 비활성화하지 않는다(PRD 정책).
- 목록이 비면 "첫 타이머 만들기"(Primary, 위와 같은 동작).
- 목록은 `divide-y divide-neutral-800`. 행마다 타이머 이름, "구간 n개 · 전체 m:ss"(`formatDuration(totalPlannedMs)`), 링크 [시작] → `/timers/{id}/run`, [편집] → `/timers/{id}`, [기록] → `/timers/{id}/records`.

### 3. `src/components/TimerEditor.tsx`
props `{ timerId?: string }` — 없으면 새로 만들기, 있으면 편집.
- 편집이면 `api.getTimer(id)`. `NOT_FOUND`면 "타이머를 찾을 수 없어요" + 목록 링크. `api.getPlanStatus()`도 읽어 둔다(한도 안내의 플랜 문구용).
- 새로 만들기는 이름 빈 칸 + 빈 구간 한 줄로 시작한다.
- 입력: 타이머 이름. 구간 줄마다 이름, 시간(`m:ss` 한 칸, placeholder `3:00`), [위로] [아래로] [삭제] 아이콘 버튼(인라인 SVG, `aria-label`). [구간 추가]. 전체 시간 표시.
  - 순서 변경은 위/아래 버튼만 쓴다(드래그 없음).
- [저장](Primary):
  1. 시간 칸마다 `parseClock`. `null`이면 그 칸 아래 `MESSAGES.validation`의 형식 오류.
  2. `TimerInput`을 만들고(기존 구간은 ID 유지, 새 구간은 `crypto.randomUUID()`) `timerInputSchema.safeParse`. 실패하면 issue `path`에 맞는 칸 아래 `text-sm text-red-400` 한 줄.
  3. 통과하면 `api.createTimer` / `api.updateTimer`.
  4. `PLAN_LIMIT_TIMERS`·`PLAN_LIMIT_SEGMENTS` → 안내 박스(`planLimitMessage(code, plan)`). 무료 플랜이면 [30일권 보기] → `/pricing?returnTo=<지금 경로>`를 함께 둔다. 그 외 에러는 `errorMessage(code)`.
  5. 성공하면 새로 만들기는 `router.replace('/timers/' + id)`. 저장 뒤 화면에 "저장했어요"와 [바로 리허설 해보기](→ `/timers/{id}/run`)를 보여준다.
- 구간 11개째를 추가하는 버튼을 막지 않는다. 한도는 저장할 때 알려준다(PRD "구간 11개째 저장").
- 편집 화면에는 [시작](→ run), [기록](→ records), [타이머 삭제](Danger, `confirm()` 뒤 `api.deleteTimer` → `/timers`)를 둔다. 삭제 확인 문구에 "기록과 공유 링크도 함께 지워져요"를 넣는다.
- 구간 0개 저장은 허용한다(시작만 막는다, step 8).

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 무료 "2/3" 표시, 타이머 3개일 때 [새 타이머] → 안내 박스(버튼은 활성), `m:ss` 형식 오류 표시, 4초 구간 범위 오류, 구간 11개 저장 → 무료 한도 안내와 [30일권 보기], 위/아래 순서 변경 후 저장된 순서, 삭제 `confirm` 취소 시 그대로.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (화면은 `services/api`만, 검사·한도는 `src/lib`, 문구는 messages)
   - UI_GUIDE.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 한도 숫자나 입력 범위를 컴포넌트에 다시 쓰지 마라. 이유: `LIMITS`, `checkTimerLimit`, `timerInputSchema`가 유일한 규칙이다.
- [새 타이머]·[구간 추가] 버튼을 숨기거나 비활성화하지 마라. 이유: 한도 도달 순간이 결제 안내 지점이다(PRD 정책).
- 템플릿, 타이머 복제, 발표/토론 모드, 발언자·팀 구분을 만들지 마라. 이유: PRD MVP 제외 사항이다.
- 모달을 만들지 마라. 이유: 안내는 화면 안 안내 박스, 확인은 브라우저 `confirm()`만 쓴다(UI_GUIDE).
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
