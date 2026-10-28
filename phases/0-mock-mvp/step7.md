# Step 7: timer-face

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("페이스 표시와 계산", "결과와 기록")
- `/docs/ARCHITECTURE.md` ("실행 상태")
- `/docs/ADR.md` (ADR-004)
- `/docs/DESIGN.md` (전체, 특히 "타이머 화면", "타임라인 바", "결과 표", "타이포그래피", "애니메이션")
- `/src/types/timer.ts`, `/src/types/run.ts`
- `/src/lib/timer.ts`, `/src/lib/messages.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

발표자 진행 화면(step 8)과 시청자 화면(step 10)이 같이 쓰는 표시 컴포넌트를 만든다. 모두 props만 받아 그리고, `services`를 부르지 않는다.

TDD: 파일마다 옆에 `*.test.tsx` / `*.test.ts`를 먼저 만든다(TDD 가드).

### 1. `src/components/TimerFace.tsx`
```ts
props: { segments: Segment[]; view: TimerView; finishHint?: boolean }
```
위에서 아래로 (가운데 정렬):
- 현재 구간 이름 `text-xl font-medium text-neutral-50`
- 현재 구간 남은 시간 `formatClock(view.segmentRemainingMs)`, 클래스 `text-[clamp(5rem,28vw,12rem)] font-semibold tabular-nums leading-none`. `isOvertime`이면 숫자 전체 `text-red-400`, 아니면 `text-neutral-50`.
- `finishHint`면 큰 숫자 아래 "한 번 더 누르면 종료"(애니메이션 없이 바로)
- `TimelineBar`
- 전체 남은 시간 `text-3xl font-medium tabular-nums text-neutral-300`: "전체 8:30 남음". 마이너스면 "전체 -1:20"으로 쓰고 `text-red-400`.
- 직전 결과(`view.lastResult`가 있을 때만): "직전 구간 " + `diffLabel`, 늦음 `text-red-400` / 빠름 `text-blue-400` / 정시 `text-neutral-300`. 색과 글자를 항상 함께 쓴다.
- 다음 구간: "다음: 반대 입론" `text-neutral-400`. 마지막 구간이면 "마지막 구간".

"3 / 7" 진행 표시는 상단 바에 들어가므로 여기서 그리지 않는다. 대신 `src/lib/messages.ts`에 `progressLabel(index, count)`를 만들어 둔다.

### 2. `src/components/TimelineBar.tsx`
```ts
props: { segments: Segment[]; segmentIndex: number; progressMs: number; done?: boolean }
```
- `div`로 그린다. 높이 8px, 가로 전체. 구간마다 블록 하나, 너비 = 계획 시간 비율, 블록 사이 2px.
- 블록 위에 구간 이름 `text-xs text-neutral-500`, 넘치면 말줄임.
- 끝난 구간 `bg-neutral-500`. 현재 구간은 진행 위치까지 `bg-neutral-50`, 나머지 `bg-neutral-800`. 남은 구간 `bg-neutral-800`. `done`이면 모두 끝난 구간 색.
- 진행 위치(`progressMs`)에 흰 점 하나.
- 늦음·빠름 색을 쓰지 않는다. 계획 대비 위치 마커는 없다.

### 3. `src/components/ResultTable.tsx`
```ts
props: { results: SegmentResult[] }
```
- 열: 구간 · 계획 · 실제 · 차이. 시간은 `formatDuration`, `tabular-nums`.
- 차이 칸만 의미 색 + `diffLabel` 글자.

### 4. `src/components/SegmentList.tsx`
```ts
props: { segments: Segment[] }
```
- 시작 전·대기실용. 구간마다 이름과 계획 시간, 마지막 줄에 "전체 m:ss". `divide-y divide-neutral-800`.

### 5. `src/components/useNow.ts`
```ts
export function useNow(offsetMs: number, active: boolean): number   // Date.now() + offsetMs
```
- `active`인 동안 `requestAnimationFrame`으로 갱신한다(시청자·발표자가 매 프레임 `computeTimer`로 계산). 비활성이면 루프를 돌리지 않는다. 언마운트 때 정리한다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 남은 시간이 마이너스면 숫자가 빨강, `0:00`은 빨강 아님, 직전 결과 색·글자(늦음/빠름/정시), 첫 구간에서는 직전 결과 없음, 타임라인 바 블록 너비 비율과 현재 블록 채움, 결과 표 차이 칸에만 색, `useNow`가 비활성일 때 rAF를 부르지 않음.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가? (차트 라이브러리 없음)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (시간 계산은 `src/lib/timer.ts`만)
   - DESIGN.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (컴포넌트 이름과 props)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 컴포넌트 안에서 시간·판정을 계산하지 마라. 이유: `computeTimer`, `formatClock`, `diffLabel` 등 `src/lib` 함수만 쓴다.
- 깜빡임·펄스·전환 애니메이션을 넣지 마라. 이유: 발표자 시선을 뺏는다(DESIGN.md 애니메이션).
- 빠름에 초록색을 쓰지 마라. 비례폭 숫자를 쓰지 마라. 타이머 화면 배경을 칠하지 마라. 이유: DESIGN.md 안티패턴이다.
- 누적 차이, 계획 대비 위치 표시를 만들지 마라. 이유: PRD MVP 제외 사항이다.
- `services/api`나 `services/realtime`을 부르지 마라. 이유: 표시 전용 컴포넌트다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
