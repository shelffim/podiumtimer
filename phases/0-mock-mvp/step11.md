# Step 11: records-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("결과와 기록", "흐름 B ②")
- `/docs/ARCHITECTURE.md` (핵심 규칙 R2·R3, 기술 스택의 그래프)
- `/docs/UI_GUIDE.md` ("평균 차이 막대그래프", "결과 표", "기록", "레이아웃")
- `/src/types/timer.ts`
- `/src/lib/stats.ts`, `/src/lib/timer.ts`, `/src/lib/messages.ts`
- `/src/services/api/index.ts`, `/src/services/api/mock.ts`
- `/src/components/ResultTable.tsx`, `/src/components/PageShell.tsx`, `/src/components/RequireAuth.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`/timers/[id]/records` 기록 화면을 만든다.

TDD: 컴포넌트마다 옆에 `*.test.tsx`를 먼저 만든다(TDD 가드). 화면 테스트는 실제 `mockApi`(테스트마다 localStorage 비움)로 돌리고 `window.confirm`을 목으로 바꾼다.

### 1. `src/app/timers/[id]/records/page.tsx`
얇은 Server Component: `PageShell` > `RequireAuth` > `RecordsView timerId={id}`.

### 2. `src/components/RecordsView.tsx`
props `{ timerId: string }`.
- `api.getTimer(timerId)`와 `api.listRecords(timerId)`(최신순). `NOT_FOUND`면 "타이머를 찾을 수 없어요" + 목록 링크.
- 제목: 타이머 이름 + 기록. 링크 [시작] → `/timers/{id}/run`, [편집] → `/timers/{id}`.
- `averageRecords(timer, records)`가 `null`이 아니면 목록 위에 평균 섹션: `AverageTable`과 `AverageDiffChart`.
- 기록 목록(`divide-y divide-neutral-800`): 행마다 시작 일시(예: "10월 27일 (월) 14:05" — 표기 함수는 messages에). 행을 누르면 그 자리에서 `ResultTable`(`record.segments.map(toSegmentResult)`)이 펼쳐지고, 다시 누르면 접힌다.
- 행마다 [삭제](Text 또는 Danger 작게): `confirm()` 뒤 `api.deleteRecord(id)`, 성공하면 목록과 평균을 다시 계산한다.
- 기록이 없으면 "아직 기록이 없어요"와 "마지막 구간까지 끝낸 발표가 여기에 쌓여요".

### 3. `src/components/AverageTable.tsx`
```ts
props: { rows: AverageRow[] }
```
- 열: 구간 · 계획 · 평균 실제 · 평균 차이. 시간은 `formatDuration`, `tabular-nums`. 평균 차이 칸만 의미 색 + `diffLabel`.

### 4. `src/components/AverageDiffChart.tsx`
```ts
props: { rows: AverageRow[] }
```
- 차트 라이브러리 없이 `div` 너비(%)로 그린다.
- 가운데 세로 기준선. 늦음은 기준선에서 오른쪽으로 `bg-red-400`, 빠름은 왼쪽으로 `bg-blue-400`, 정시는 막대 없음.
- 막대 길이는 가장 큰 |평균 차이|를 100%(한쪽 절반 전체)로 맞춘다. 모든 행이 0이면 막대 없음.
- 줄마다 구간 이름과 `diffLabel`을 적는다(색만으로 구분하지 않는다).

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 같은 구성 기록 2개 이상일 때만 평균 섹션, 구성이 다른 기록은 평균에서 빠짐, 막대 방향·색(늦음 오른쪽 빨강, 빠름 왼쪽 파랑, 정시 없음), 가장 큰 차이가 100%, 행 눌러 펼치기/접기, 삭제 `confirm` 취소 시 그대로, 삭제 뒤 평균 다시 계산, 기록 없음 문구.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가? (차트 라이브러리 없음)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (평균은 `averageRecords`만)
   - UI_GUIDE.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 차트 라이브러리를 설치하지 마라. 이유: ARCHITECTURE 기술 스택은 `div`로 직접 그린다.
- 평균·판정을 컴포넌트에서 계산하지 마라. 이유: `averageRecords`, `toSegmentResult`, `diffLabel`만 쓴다.
- 회차별 추이 그래프, 연습/실전 구분, 중단한 발표 기록을 만들지 마라. 이유: PRD MVP 제외 사항이다.
- 플랜에 따라 기록·평균을 숨기지 마라. 이유: 기록·평균은 플랜과 상관없이 보여준다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
