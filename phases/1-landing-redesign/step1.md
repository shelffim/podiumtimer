# Step 1: wide-layout

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/DESIGN.md` ("디자인 원칙" 5번, "레이아웃", "타이머 목록", "기록", "요금제·결제")
- `/docs/ADR.md` (ADR-019)
- `/src/app/globals.css` (`.page`, `.page-narrow`)
- `/src/components/AppBar.tsx`, `/src/components/AppBar.test.tsx`
- `/src/components/TimerList.tsx`, `/src/components/RecordsView.tsx`, `/src/components/PricingView.tsx`
- `page-narrow`를 쓰는 화면: `/src/components/TimerEditor.tsx`, `/src/components/RunScreen.tsx`, `/src/components/BillingSuccess.tsx`, `/src/components/ViewerScreen.tsx`, `/src/app/error.tsx`, `/src/app/not-found.tsx`, `/src/app/terms/page.tsx`, `/src/app/privacy/page.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

노트북 전체 화면에서 앱 화면이 폰처럼 가운데에 좁게 붙어 보이지 않게, 넓은 화면 배치를 넣는다. 폰(767px까지) 배치는 바꾸지 않는다.

TDD: `AppBar.test.tsx`에 `narrow` 테스트를 먼저 추가한 뒤 구현한다.

### 1. `src/app/globals.css`
- `.page`: 지금 그대로에 `lg:max-w-[1200px]`를 더한다. `lg` 좌우 여백은 지금 `md`와 같은 32px이다.
- `.page-narrow`: 모든 너비에서 최대 560px이어야 한다. `.page`의 `lg` 규칙이 `.page-narrow`를 이기지 않게 하라(예: `.page-narrow`에 `lg:max-w-[560px]`도 둔다).
- 위쪽 바와 본문의 폭을 한 곳에서 맞추도록 같은 폭 클래스를 쓴다. 예: `.bar` / `.bar-narrow` 같은 폭·여백 클래스를 만들거나, 같은 값을 `AppBar`에서 쓴다. 폭·여백 값을 여러 파일에 따로 적지 마라.

### 2. `src/components/AppBar.tsx`
```ts
export function AppBar(props: { back?: string; title?: string; children?: ReactNode; narrow?: boolean })
```
- 기본은 `.page`와 같은 최대 폭(960px, `lg` 이상 1200px)과 좌우 여백(20px, `md` 32px).
- `narrow`면 `.page-narrow`와 같은 최대 560px. 그래서 서비스 이름·[뒤로]의 왼쪽 선이 본문 왼쪽 선과 맞는다.
- `page-narrow` 본문을 쓰는 화면(위 "읽어야 할 파일"의 8곳)은 모두 `<AppBar narrow …>`로 바꾼다. 진행 중 화면(`RunScreen`의 전체 화면 위쪽 바)은 `AppBar`를 쓰지 않으므로 건드리지 않는다.

### 3. 넓은 화면 배치
- `TimerList`: 카드 목록 `md:grid-cols-2`에 `lg:grid-cols-3`을 더한다.
- `RecordsView`: 평균 | 기록 두 열을 `lg` 이상에서 3 : 2 비율(`lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`)로 둔다.
- `PricingView`: 요금제 카드 두 장이 든 영역은 넓은 화면에서도 최대 960px로 둔다(왼쪽 정렬).
- 랜딩(`Landing.tsx`)은 이 step에서 고치지 않는다. `.page`가 넓어지는 것만 받는다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: `AppBar` 기본은 넓은 폭 클래스, `narrow`면 560px 폭 클래스를 쓴다. `TimerEditor`처럼 `page-narrow` 화면의 위쪽 바가 `narrow`로 그려진다(대표 화면 하나 이상).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가? (Tailwind 클래스만, 새 패키지 없음)
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가?
   - DESIGN.md "레이아웃" 규칙(최대 폭, 여백, 목록 3열, 기록 3 : 2, 요금제 960px)을 따르는가?
3. 결과에 따라 `phases/1-landing-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 진행·시청 중 전체 화면(`h-dvh`, 최대 1100px)을 바꾸지 마라. 이유: 1m 가독성 기준으로 이미 맞춘 화면이다.
- 767px까지의 폰 배치(여백·글자 크기·열 수)를 바꾸지 마라. 이유: 폰이 기준이고(ADR-014) 브라우저 테스트가 390·360에서 확인한다.
- `Landing.tsx`를 고치지 마라. 이유: 뒤 step의 범위다.
- 새 디자인 토큰 색·그림자·블러를 넣지 마라. 이유: DESIGN.md 안티패턴과 색 원칙.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
