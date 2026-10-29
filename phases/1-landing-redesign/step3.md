# Step 3: landing-sections

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/DESIGN.md` ("랜딩" 전체, "데이터/시맨틱 색상", "타이포그래피"의 `hero`·`display`, "레이아웃", "애니메이션", "AI 슬롭 안티패턴", "아이콘", "문구")
- `/docs/UX.md` (3.2 이해 → 가입)
- `/docs/ADR.md` (ADR-019)
- `/src/lib/demo.ts` (step 0: `DEMO_SEGMENTS`, `DEMO_RESULTS`, `DEMO_AVERAGE_ROWS`, `DEMO_AVERAGE_COUNT`)
- `/src/components/useDemoFrame.ts`, `/src/components/LandingPreview.tsx` (step 2)
- `/src/components/AppBar.tsx`, `/src/app/globals.css` (step 1: 넓은 `.page`)
- `/src/components/Landing.tsx`, `/src/components/Landing.test.tsx`
- `/src/lib/timer.ts` (`computeTimer`, `resultTotals`, `formatClock`, `isOvertime`), `/src/lib/messages.ts` (`diffLabel`, `averageCaption`, `seatCountLabel`, `MESSAGES.share.hostName`)
- `/src/components/AverageDiffChart.tsx`, `/src/components/TimelineBar.tsx`, `/src/components/verdictColor.ts`, `/src/components/Icon.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩을 DESIGN.md "랜딩"의 ①~④ 구성으로 완성한다. 폰(1열)·`md`(2열)·`lg`(최대 1200px) 모두 ① → ④ 순서다.

TDD: 새 컴포넌트마다 옆에 `*.test.tsx`를 먼저 만들고, `Landing.test.tsx`·`messages.test.ts`를 먼저 고친 뒤 구현한다.

### 1. 문구 (`src/lib/messages.ts`)
`MESSAGES.landing`에 더한다. 기존 `headline`(전체 문장)은 그대로 둔다.
- 헤드라인 조각 3개(앞부분 "구간마다, 계획보다", "빨랐는지", "늦었는지."). 조각을 공백 규칙대로 이으면 `headline`과 같아야 한다(테스트).
- 비교 그림: 제목 "남은 시간만 보면, 끝나고 나서야 알아요.", 설명 "같은 10분 발표라도 타이머에 따라 보이는 게 달라요. 보통 타이머는 전체 시간이 넘쳤다는 것만 알려주고, Podium Timer는 어느 구간에서 늦고 빨랐는지 구간마다 남겨요.", "보통 타이머"·"전체 남은 시간 하나", "구간마다 판정"(이 줄의 이름은 `MESSAGES.serviceName`).
- 함수: 넘친 초를 받아 "끝나고 나서야 13초 넘친 걸 알아요. 어느 구간 때문인지는 몰라요."를 만드는 것, 가장 늦은 두 구간을 받아 "결과에서 0:21, 문제 정의에서 0:12 늦었어요. 다음 연습에서 어디를 줄일지 바로 보여요."를 만드는 것(시간 표기는 `formatClock`).
- 기능 영역 제목 "혼자 리허설부터 토론 수업까지.", 진행 중 표시 "진행 중", 예시 닉네임 `["민지", "준호"]`.
- 아래 띠 제목 "이번 리허설부터 구간마다 확인해 보세요." (캡션은 기존 `MESSAGES.timers.free`와 `minimumAge`를 " · "로 이어 "무료 · 만 14세 이상").

### 2. 스타일 (`src/app/globals.css`, `src/components/verdictColor.ts`)
- `.hero`에 `xl:text-[68px]`(자간·행간은 지금 `md`와 같은 비율)을 더한다.
- `.display`를 만든다: 28px → `md` 36px → `lg` 44px, 굵기 400, 음수 자간, `text-balance`, `break-keep`.
- `verdictColor.ts`에 막대·점 색 `verdictFill: Record<Verdict, string>`을 더한다: late `bg-red-400`, early `bg-blue-400`, on_time `bg-[#6b717b]`. 판정 색은 이 파일에서만 정한다.

### 3. `src/components/PaceCompare.tsx`
```ts
export function PaceCompare(): JSX.Element
```
- `DEMO_RESULTS`와 `resultTotals`만으로 그린다. 판정·차이를 다시 계산하지 않는다.
- `section`(제목 `h2.display` + 설명) 안 `card` 하나에 두 줄을 경계선으로 나눈다. 줄마다 왼쪽 이름 칸(약 160~200px, 좁으면 위로 올라감) + 오른쪽 막대 칸.
  - 보통 타이머: 계획 합계 막대(`bg-[#4a4f57]`) + 넘친 시간 막대(`bg-red-400`)를 `flex-grow` 비율로 붙이고, 오른쪽 고정 폭 칸에 빨강 `-0:13`(`formatClock(계획 − 실제)`). 아래에 넘친 초 문구.
  - Podium Timer: 구간 6개 막대를 실제 시간 비율로(`verdictFill`), 오른쪽 같은 고정 폭 칸에 전체 차이 배지 `0:13 늦음`(`verdict` + `verdictTone`). 그 아래 구간 6개 목록(`ul`, 2열 → `sm` 3열 → `lg` 6열): 점(`verdictFill`) + 이름 + 판정 배지(`diffLabel`). 마지막에 가장 늦은 두 구간 문구.
  - 두 줄의 막대 칸은 같은 비율(실제 합계 기준)이라 오른쪽 끝이 맞아야 한다. 오른쪽 칸 폭을 두 줄에 같게 준다.
- 막대는 `aria-hidden`. 목록과 문구는 스크린 리더가 읽는다.

### 4. `src/components/FeatureCards.tsx`
```ts
export function FeatureCards(props: { frame: DemoFrame }): JSX.Element
```
- 제목 `h2.display` + 카드 3개(`article.card`, 폰 1열 → `md` 2열 → `lg` 3열). 카드마다 위에 그림 패널(`aria-hidden`, `surface` 바탕, 20px 모서리, 최소 높이 약 230px, 내용 세로 가운데), 아래 `plate` 아이콘(gauge·link·chart) + `h3` 제목 + 설명(`MESSAGES.landing.features`).
- 구간별 페이스: 세로 선 위에 점이 놓인 단계 4줄. 위 3줄은 `DEMO_RESULTS` 앞 3개(점 `verdictFill` + 이름 + 판정 배지), 마지막 줄은 넷째 구간(빈 흰 테두리 점 + "결과 · 진행 중" + 그 구간 계획 시간).
- 링크로 공유: 선(`border-2 border-line`)으로 그린 노트북 1대(16:10 화면 + 받침) + 폰 2대. 세 화면 모두 `computeTimer(DEMO_SEGMENTS, frame.run, frame.nowMs)`의 남은 시간을 보여주고(마이너스면 빨강), 노트북에는 구간 이름과 `TimelineBar`도 둔다. 아래 칩: `MESSAGES.share.hostName`, 예시 닉네임 2개, 사람 아이콘 + `seatCountLabel(3, 3)`.
- 기록과 평균: `averageCaption(DEMO_AVERAGE_COUNT)` + `<AverageDiffChart rows={DEMO_AVERAGE_ROWS} />`.

### 5. `src/components/Landing.tsx`
- `.page` 안을 영역 사이 72px → `lg` 128px 간격의 세로 흐름으로 바꾼다.
- ① 첫 화면: `md` 두 열, `lg`는 소개 칸이 조금 넓은 두 열(예: 1.1fr : 0.9fr)이고 최소 높이가 화면 높이를 채우며(`lg:min-h-[calc(100svh-…)]`) 세로 가운데. 왼쪽: `h1.hero` 안에 헤드라인 조각(“빨랐는지” `text-blue-400`, “늦었는지.” `text-red-400`) — `h1`의 접근 이름은 `headline` 전체 문장이어야 한다. 설명, 로그인 버튼, 캡션은 지금과 같다. 오른쪽: `<LandingPreview frame={frame} />`.
- ② `<PaceCompare />`, ③ `<FeatureCards frame={frame} />`.
- ④ 아래 로그인 띠: `section.card`(모서리 32px, 안쪽 여백 28px → `lg` 64px) 안에 `h2.display` 제목 + "무료 · 만 14세 이상" + 첫 화면과 같은 로그인 버튼(같은 `signIn`, 같은 비활성 조건, 같은 라벨). `md` 이상은 글과 버튼이 한 줄.
- 로그인 실패 문구(`role="alert"`)는 누른 버튼 아래에만 하나 보인다(어느 버튼을 눌렀는지 기억한다).

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것:
- `messages`: 헤드라인 조각을 이으면 `headline`, 넘친 초 문구(13초), 가장 늦은 두 구간 문구.
- `PaceCompare`: 제목, 빨강 `-0:13`, 배지 `0:13 늦음`, 목록 6개의 판정 글자(0:04 빠름·0:12 늦음·정시·0:21 늦음·0:08 빠름·0:08 빠름)와 색, 가장 늦은 두 구간 문구.
- `FeatureCards`: 제목 3개(`h3`), `demoFrame(0)`이면 공유 그림의 남은 시간 `0:08`이 세 화면 모두에, `demoFrame(19)`면 빨강 `-0:11`, 칩 `발표자`·`민지`·`준호`·`3/3`, `같은 구간 구성의 기록 5개`, 평균 막대.
- `Landing`: `h1` 이름이 `headline`이고 “빨랐는지”가 파랑·“늦었는지.”가 빨강, 같은 라벨의 로그인 버튼 2개, 아래 버튼으로도 로그인해 목적지로 이동, 아래 버튼 실패 시 그 버튼 아래에만 알림 1개, 비교 그림·기능·아래 띠 제목, 기존 테스트(목적지 안전 처리, 로그인한 사용자 바로 이동, 정책 링크, 정지 장면 값)는 그대로 통과.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (컴포넌트는 `components/`, 예시 데이터는 `lib/demo.ts`)
   - ADR 기술 스택을 벗어나지 않았는가? (차트·애니메이션 라이브러리, 이미지 파일 없음)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (화면은 `services/api`만 부름, 계산은 `lib`, 문구는 `messages.ts`)
   - DESIGN.md "랜딩"·"데이터/시맨틱 색상"·"AI 슬롭 안티패턴"을 따르는가? (색은 판정 의미로만)
3. 결과에 따라 `phases/1-landing-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 가격표, 후기, 실적 숫자, 로그인 말고 다른 행동 버튼(요금제 보기·데모 보기 등)을 넣지 마라. 이유: UX.md 3.2 "하지 않는 것".
- 스크롤하면 나타나는 효과, 숫자 카운트업, 미리보기·공유 그림 말고 움직이는 요소를 넣지 마라. 이유: DESIGN.md "애니메이션" — 랜딩 예외는 미리보기 재생뿐이다.
- 사진·일러스트·이미지 파일·외부 이미지 URL을 쓰지 마라. 이유: ADR-019, 그림은 코드로 그린다.
- 판정 색(빨강·파랑) 말고 강조색을 쓰거나 판정과 상관없는 곳에 빨강·파랑을 쓰지 마라. 이유: DESIGN.md 디자인 원칙 2.
- 그라데이션·블러·글로우를 쓰지 마라. 이유: DESIGN.md AI 슬롭 안티패턴.
- 예시 데이터를 컴포넌트 안에 다시 적지 마라. 이유: `lib/demo.ts` 한 곳에 둔다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
