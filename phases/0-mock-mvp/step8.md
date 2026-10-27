# Step 8: run-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("타이머 동작", "결과와 기록", "흐름 B", "흐름 F", "예외 상황")
- `/docs/ARCHITECTURE.md` (핵심 규칙 R6·R7, "실행 상태", "데이터 흐름", "에러 처리")
- `/docs/ADR.md` (ADR-005)
- `/docs/UI_GUIDE.md` ("타이머 화면", "결과 표", "조작 입력", "애니메이션", "레이아웃")
- `/src/types/run.ts`, `/src/types/timer.ts`
- `/src/lib/timer.ts`, `/src/lib/messages.ts`
- `/src/services/api/index.ts`, `/src/services/api/device.ts`, `/src/services/api/mock.ts`
- `/src/components/TimerFace.tsx`, `/src/components/TimelineBar.tsx`, `/src/components/ResultTable.tsx`, `/src/components/SegmentList.tsx`, `/src/components/useNow.ts`, `/src/components/RequireAuth.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

발표자 진행 화면 `/timers/[id]/run`을 만든다. 공유 기능은 step 9에서 붙이므로 이번에는 넣지 않는다(`LocalRun.shareCode`는 읽고 쓸 때 그대로 유지만 한다).

TDD: 파일마다 옆에 `*.test.ts(x)`를 먼저 만든다(TDD 가드). 테스트는 `vi.useFakeTimers()`, 실제 `mockApi` 또는 `vi.mock('@/services/api')`, `window.confirm` 목을 쓴다. jsdom에 `PointerEvent`가 없으면 `vitest.setup.ts`에 간단한 polyfill을 넣어라.

### 1. `src/app/timers/[id]/run/page.tsx`
얇은 Server Component: `RequireAuth` > `RunScreen timerId={id}`. `PageShell`·푸터 없이 화면 전체를 쓴다.

### 2. `src/components/useAdvanceInput.ts`
```ts
export function useAdvanceInput(opts: {
  enabled: boolean
  targetRef: RefObject<HTMLElement | null>   // 탭 영역 (상단 바 아래 전체)
  onAdvance: () => void
}): void
```
- `Space`: `keydown`에서 처리하고 `preventDefault`. 포커스가 `input`·`textarea`·`select`·`contenteditable`에 있으면 무시. `event.repeat`면 무시.
- 탭: `targetRef` 안의 `pointerdown`/`pointerup`. `pointerType`이 `touch`나 `pen`일 때만. 시작 지점에서 10px 넘게 움직였으면 무시(스와이프). 대상이 `button`·`a`·`[data-no-advance]` 안이면 무시. 마우스 클릭은 '다음'이 아니다(노트북은 Space).
- 0.5초 안의 두 번째 '다음'은 무시한다(탭·Space 공통).

### 3. `src/components/useWakeLock.ts`
```ts
export function useWakeLock(active: boolean): void
```
- `active`이고 화면이 보이면 `navigator.wakeLock.request('screen')`. 화면 복귀(`visibilitychange` → visible) 때 다시 요청. 비활성·언마운트 때 해제. 지원하지 않거나 실패하면 조용히 넘어간다.

### 4. `src/components/RunScreen.tsx`
props `{ timerId: string }`.

**불러오기**
- `api.getTimer(timerId)`와 `api.getServerOffset()`. `NOT_FOUND`면 "타이머를 찾을 수 없어요" + 목록 링크.
- `device.loadRun(timerId)`:
  - `isStaleRun(run, Date.now() + offset)`이면 버리고(`device.clearRun`) 대기로.
  - `running`·`finished`·`aborted`면 저장된 `LocalRun.segments`로 그대로 이어간다.
  - 없거나 `idle`이면 대기. 대기 화면은 타이머의 **지금** 구간을 보여준다.

**대기 (`idle`)** — 관리 화면처럼 스크롤 가능한 한 열
- 타이머 이름, `SegmentList`, [시작](Primary, 넓게). [편집]·[기록] 링크.
- 구간이 0개면 [시작] 대신 "구간을 추가해야 시작할 수 있어요" + [편집] 링크.
- [시작]: `at = Date.now() + offset`. 타이머의 지금 구간을 복사해 `LocalRun.segments`로 두고 `reduceRun(..., { type: 'start', at }, n)`. 기존 `shareCode`는 유지한다. `device.saveRun`.

**진행 (`running`)** — `h-dvh`, 스크롤 없음, `touch-action: manipulation`, `user-select: none`
- 상단 바(`data-no-advance`): [되돌리기](글자 라벨 + 아이콘, `transitions`가 비면 비활성) · `progressLabel(i, n)` · [중단].
- 상단 바 아래 전체가 탭 영역이다. `TimerFace`에 `computeTimer(segments, run, useNow(offset, true))`를 넘긴다.
- '다음' 처리 (`useAdvanceInput`의 `onAdvance`):
  - 마지막 구간이 아니면 `reduceRun(next)`.
  - 마지막 구간이면 첫 입력에 `finishHint`를 켜고 3초 뒤 끈다. 힌트가 켜진 동안의 입력(0.5초 무시 규칙 때문에 0.5초~3초 사이)만 `reduceRun(next)`로 종료한다.
- [되돌리기]: `reduceRun(undo)`, 힌트를 끈다. [중단]: `confirm()` 확인 뒤 `reduceRun(abort)`.
- 모든 전이는 `src/lib/timer.ts`의 `reduceRun`으로만 하고, 성공하면 상태와 `device.saveRun`을 함께 갱신한다. `at`은 항상 `Date.now() + offset`.
- `useWakeLock(status === 'running')`.

**종료 (`finished`)** — 스크롤 가능
- `ResultTable`(`buildResult(segments, run)`), [다시 하기](Primary), [기록 보기](Secondary → `/timers/{id}/records`).
- **기록 저장은 종료하는 그 조작에서 한 번만 한다**: 마지막 `next`가 성공한 직후 `api.saveRecord(timerId, run.startedAt, results)`. 실패하면(`ok: false`이거나 예외) 에러 문구와 [다시 저장]을 보여준다. 성공하면 "기록을 저장했어요"를 작게 보여준다.
- 새로고침 등으로 `finished` 상태를 다시 연 경우에는 결과 표만 보여주고 저장하지 않는다. 이유: 같은 기록이 두 번 저장되는 것을 막는다.

**중단 (`aborted`)**
- "발표를 중단했어요" + [다시 하기]. 기록은 저장하지 않는다. 상태를 바로 `idle`로 돌리지 않는 이유: step 9에서 시청자에게 중단 상태를 보내야 한다.

**[다시 하기]**
- `api.getTimer`로 지금 구간을 다시 읽고, `{ segments: 지금 구간, run: createIdleRun(), shareCode: null }`을 저장한 뒤 대기로.

**새로고침·앱 전환**: 화면이 다시 보이면 `useNow`가 지금 시각으로 다시 계산하므로 따로 보정하지 않는다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 0.5초 안 두 번째 '다음' 무시, 마지막 구간 첫 입력은 힌트만 / 3초 안 두 번째 입력이면 종료 / 3초 지나면 힌트 사라지고 그대로 진행, 상단 바 탭은 '다음' 아님, 10px 넘게 움직인 터치 무시, 입력 칸 포커스 중 Space 무시, 되돌리기 비활성 조건, 중단 `confirm` 취소 시 그대로, 종료 시 `saveRecord` 정확히 1회, 저장 실패 → [다시 저장], `finished` 상태로 다시 열면 저장하지 않음, 12시간 지난 `running`은 대기로, 구간 0개 시작 불가.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (상태 전이·시간 계산은 `src/lib/timer.ts`만, 데이터는 `services/api`만)
   - UI_GUIDE.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (RunScreen 구조와 step 9가 공유 UI를 붙일 위치)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 상태 전이를 컴포넌트에서 직접 만들지 마라(`transitions.push` 등). 이유: `reduceRun` 하나로만 해야 서버·시청자와 어긋나지 않는다.
- 진행 중에 타이머의 지금 구간을 다시 읽어 쓰지 마라. 이유: [시작] 때 복사한 구간만 쓴다(ARCHITECTURE R7).
- 일시정지, 소리·진동·미리 경고, 전체화면 버튼, 자동 구간 전환을 만들지 마라. 이유: PRD MVP 제외 사항이다.
- 마지막 구간 종료에 `confirm()`을 쓰지 마라. 이유: 스페이스바로도 종료할 수 있게 "한 번 더 누르기"로 한다.
- 매초 상태를 저장하거나 보내지 마라. 이유: 조작할 때만 저장하고 화면은 `computeTimer`로 계산한다.
- 공유 링크·접속자 UI를 이 step에서 만들지 마라. 이유: step 9 범위다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
