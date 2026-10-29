# Step 2: landing-preview

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/DESIGN.md` ("랜딩"의 미리보기 카드·재생 장면·정지 장면, "애니메이션", "타이머 화면"의 아래쪽 조작 줄, "AI 슬롭 안티패턴")
- `/docs/UX.md` (3.2 이해 → 가입)
- `/docs/ADR.md` (ADR-019)
- `/src/lib/demo.ts`, `/src/lib/demo.test.ts` (step 0)
- `/src/lib/timer.ts` (`computeTimer`)
- `/src/lib/messages.ts` (`MESSAGES.run.next`·`keyHint`·`spaceKey`·`tapHint`, `progressLabel`)
- `/src/components/Landing.tsx`, `/src/components/Landing.test.tsx` (지금의 `LandingPreview` 함수)
- `/src/components/TimerFace.tsx`, `/src/components/RunScreen.tsx` (아래쪽 `pointer-fine` 조작 줄), `/src/components/Icon.tsx`
- `/src/app/globals.css`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩 미리보기를 스스로 재생되는 컴포넌트로 바꾼다. 문서 "랜딩"의 미리보기 카드·재생 장면·정지 장면을 그대로 따른다.

TDD: 새 파일마다 옆에 `*.test.ts(x)`를 먼저 만든다. 타이머는 `vi.useFakeTimers()`로, `matchMedia`는 테스트에서 직접 흉내 낸다.

### 1. `src/components/useDemoFrame.ts`
```ts
export function useDemoFrame(): DemoFrame
```
- 첫 렌더는 항상 `DEMO_STILL`이다(서버 렌더와 첫 그림이 같아 hydration이 어긋나지 않는다).
- 마운트 뒤 `window.matchMedia`가 있고 `(prefers-reduced-motion: reduce)`가 아니면 `DEMO_TICK_MS`마다 칸을 하나씩 올리고 `demoFrame(칸)`을 돌려준다. 0칸부터 시작한다.
- `matchMedia`가 없거나(jsdom) 움직임 줄이기면 `DEMO_STILL`에 머문다. 재생 중에 움직임 줄이기로 바뀌면 멈추고 `DEMO_STILL`로 돌아간다.
- 언마운트하면 interval과 리스너를 정리한다.

### 2. `src/components/LandingPreview.tsx`
```ts
export function LandingPreview(props: { frame: DemoFrame }): JSX.Element
```
- `view = computeTimer(DEMO_SEGMENTS, frame.run, frame.nowMs)`. 시간·판정은 여기서 다시 계산하지 않는다.
- 구성은 지금 `Landing.tsx`의 `LandingPreview`와 같다: `card` 안 위쪽 바(`progressLabel` 칩 + 되돌리기·중단 `plate` 모양) + `TimerFace compact`. 그 아래 경계선을 두고 조작 줄을 더한다.
  - 마우스 기기(`pointer-fine:`): 흰 알약 [다음 →] 모양 + "또는" + `Space` 키 모양. `frame.pressed`면 알약이 눌린 모양(`scale-95`, 한 단계 어두운 바탕)이고 `Space` 테두리가 흰색이 된다.
  - 터치 기기(`pointer-fine:hidden`): 가운데 캡션 "화면 아무 곳이나 탭하면 다음 구간". `frame.pressed`면 카드 위(숫자 오른쪽, 대략 가로 68%·세로 46%)에 지름 64px 탭 동그라미(흰 2px 테두리 + 옅은 흰 바탕)를 보인다. 마우스 기기에서는 동그라미를 숨긴다.
  - 문구는 `MESSAGES.run.next`·`keyHint`·`spaceKey`·`tapHint`를 그대로 쓴다.
- 카드 루트에 `aria-hidden="true"`. 안에 `button`·`a`·`tabindex` 같은 포커스 가는 요소를 두지 마라. 버튼 모양은 `span`으로 그린다.
- 카드는 첫 화면 오른쪽 칸에서 최대 540px. 숫자는 `lg`에서 지금보다 크게(약 120px) 보이도록 `TimerFace`의 `compact` 숫자 크기에 `lg` 크기를 더해도 된다. 진행 화면(`compact` 아님) 크기는 바꾸지 마라.
- 배지 강조: `compact`일 때만 직전 결과 배지가 바뀌면 200ms 동안 1.12배에서 제자리로 돌아온다(`motion-safe:`). keyframes는 `globals.css`의 `@theme`에 둔다. 배지 글자가 바뀔 때 다시 재생되도록 배지에 판정 글자를 `key`로 준다.

### 3. `src/components/Landing.tsx`
- 파일 안의 `LandingPreview` 함수와 `previewSegments`·`previewView` 상수를 지운다.
- `const frame = useDemoFrame()`을 `Landing`에서 부르고 `<LandingPreview frame={frame} />`로 그린다(다음 step에서 공유 카드가 같은 `frame`을 쓴다).
- 그 밖의 랜딩 구성·문구는 이 step에서 바꾸지 않는다.
- `Landing.test.tsx`의 미리보기 단언을 정지 장면 값으로 고친다: `3 / 6`, `1:24`, 빨강 배지 `0:12 늦음`, `직전 구간 · 문제 정의`, `전체 남은 시간7:16`.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것:
- `useDemoFrame`: 첫 값이 `DEMO_STILL`, 움직임 허용이면 250ms 뒤 `demoFrame(0)`, 다시 250ms 뒤 `demoFrame(1)`, 움직임 줄이기면 시간이 지나도 `DEMO_STILL`, `matchMedia`가 없으면 `DEMO_STILL`, 언마운트 뒤 타이머가 남지 않음.
- `LandingPreview`: `DEMO_STILL`이면 `3 / 6`·`1:24`·빨강 `0:12 늦음`·`7:16`, `demoFrame(0)`이면 `2 / 6`·`0:08`·파랑 `0:04 빠름`, `demoFrame(19)`면 남은 시간이 빨강 `-0:11`, 루트 `aria-hidden`, 안에 버튼·링크 없음, `다음`·`Space`·탭 안내 문구가 있음, `pressed`일 때만 탭 동그라미가 있음.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (훅·컴포넌트는 `components/`, 장면은 `lib/demo.ts`)
   - ADR 기술 스택을 벗어나지 않았는가? (애니메이션 라이브러리 없음)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (계산은 `computeTimer`로만, 문구는 `messages.ts`)
   - DESIGN.md "애니메이션" 예외 2와 "AI 슬롭 안티패턴"을 따르는가?
3. 결과에 따라 `phases/1-landing-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 미리보기를 방문자가 눌러서 조작하게 만들지 마라(클릭·탭·Space로 장면 넘기기 등). 이유: "로그인 전 데모"는 PRD MVP 제외 사항이다. 재생은 스스로만 한다.
- 진행 화면(`RunScreen`·`ViewerScreen`, `TimerFace`의 `compact` 아닌 모드)에 애니메이션을 넣지 마라. 이유: DESIGN.md "타이머 화면의 깜빡임·펄스·진행 애니메이션" 금지.
- 글로우(`box-shadow` 애니메이션), `backdrop-filter: blur`, 그라데이션을 쓰지 마라. 이유: DESIGN.md AI 슬롭 안티패턴.
- 첫 렌더에서 `window`·`matchMedia`를 읽지 마라. 이유: 서버 렌더와 첫 그림이 달라 hydration 오류가 난다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
