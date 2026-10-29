# Step 0: demo-frame

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (디렉토리 구조의 `lib/demo.ts`, 핵심 규칙 R3)
- `/docs/ADR.md` (ADR-019)
- `/docs/DESIGN.md` ("랜딩", "애니메이션")
- `/src/types/run.ts`, `/src/types/timer.ts`
- `/src/lib/timer.ts`, `/src/lib/timer.test.ts` (`computeTimer`, `toSegmentResult`, `resultTotals`, `verdictOf`, `formatClock`)
- `/src/lib/messages.ts` (`MESSAGES.landing.previewSegments`)
- `/src/components/Landing.tsx` (지금의 정지 미리보기 `previewView`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩 미리보기가 재생할 장면과 랜딩 그림에 쓸 예시 데이터를 순수 함수·상수로 만든다. 화면은 이 step에서 만들지 않는다.

TDD: `src/lib/demo.test.ts`를 먼저 만들고, 테스트가 통과하는 `src/lib/demo.ts`를 만든다.

### `src/lib/demo.ts`

```ts
export const DEMO_TICK_MS = 250;      // 장면 1초를 250ms에 보여준다 (4배속)
export const DEMO_LOOP_TICKS = 36;    // 36칸 = 9초 반복
export const DEMO_SEGMENTS: Segment[];          // 미리보기 구간 6개
export type DemoFrame = { run: RunState; nowMs: number; pressed: boolean };
export function demoFrame(tick: number): DemoFrame;
export const DEMO_STILL: DemoFrame;             // 정지 장면
export const DEMO_RESULTS: SegmentResult[];     // 비교 그림·기능 카드용 끝난 발표 하나
export const DEMO_AVERAGE_ROWS: AverageRow[];   // 기능 카드 "기록과 평균" 예시
export const DEMO_AVERAGE_COUNT = 5;            // 예시 평균에 들어간 기록 수
```

값은 아래처럼 고정한다(초 단위, `ms`로 바꿔 넣는다).

- `DEMO_SEGMENTS`: 이름은 `MESSAGES.landing.previewSegments`(인사·소개, 문제 정의, 연구 방법, 결과, 결론, 질의응답), 계획 30·90·120·150·60·150초(합계 10:00). `id`는 `"demo-0"`…`"demo-5"`.
- `demoFrame(tick)`: `t = tick`을 0~35로 접는다(음수·36 이상도 반복). `run = { status: "running", startedAt: 0, transitions, rev: 0 }`.
  - `nowMs = (108 + t) * 1000`
  - `transitions = t < 20 ? [26_000] : [26_000, 128_000]`
  - `pressed = t === 19 || t === 20`
  - 그래서 `computeTimer(DEMO_SEGMENTS, run, nowMs)`가 이렇게 나와야 한다(테스트로 확인):
    - t=0: 둘째 구간(index 1), 남은 `0:08`, 직전 결과 인사·소개 `early`(-4초), 전체 남은 `8:12`
    - t=19: 둘째 구간, 남은 `-0:11`
    - t=20: 셋째 구간(index 2), 남은 `2:00`, 직전 결과 문제 정의 `late`(+12초)
    - t=35: 셋째 구간, 남은 `1:45`
- `DEMO_STILL`: `transitions = [26_000, 128_000]`, `nowMs = 164_000`, `pressed = false` → 셋째 구간 남은 `1:24`, 직전 결과 문제 정의 `late`(+12초), 전체 남은 `7:16`.
- `DEMO_RESULTS`: 같은 6구간의 실제 시간 26·102·120·171·52·142초(합계 10:13). `toSegmentResult`로 만든다 → 판정 early·late·on_time·late·early·early, `resultTotals`의 차이 +13초.
- `DEMO_AVERAGE_ROWS`: 같은 6구간, 평균 차이 -3·+11·0·+15·-6·-4초. `actualMs = plannedMs + diffMs`, `verdict`는 `verdictOf(diffMs)`.

판정·차이 계산은 `lib/timer.ts`의 함수만 쓴다. 이 파일에서 판정 규칙(1초 이하 정시 등)을 다시 구현하지 마라.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 위 t=0·19·20·35와 `DEMO_STILL`의 `computeTimer` 결과(구간 index, `formatClock` 남은 시간, 직전 결과 판정·차이, 전체 남은 시간), `pressed`가 t=19·20에서만 참, `demoFrame(36)`과 `demoFrame(-1)`이 0·35칸과 같음, `DEMO_RESULTS` 판정 6개와 합계 차이 +13초, `DEMO_AVERAGE_ROWS` 판정 6개.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/lib/demo.ts`)
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (시간·판정은 `lib/timer.ts` 함수로만)
3. 결과에 따라 `phases/1-landing-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `computeTimer`가 내는 값(남은 시간, 직전 결과)을 상수로 미리 적어 두지 마라. 이유: 화면은 `computeTimer`로 계산해야 진행 화면과 같은 규칙을 쓴다(R3). 상수로 두는 것은 실행 상태(`transitions`, `nowMs`)와 예시 실제 시간뿐이다.
- 화면 컴포넌트·훅을 만들거나 `Landing.tsx`를 고치지 마라. 이유: 다음 step의 범위다.
- 구간 이름을 `demo.ts`에 직접 쓰지 마라. 이유: 문구는 `MESSAGES`에서 가져온다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
