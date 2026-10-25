# UI 디자인 가이드

## 디자인 원칙
1. **멀리서 3초 안에 읽혀야 한다.** 타이머 화면은 숫자·색·글자 세 가지로 상태를 전달한다. 단상에서 1m, 교실 뒤에서 TV를 봐도 "늦다/빠르다"가 바로 보여야 한다.
2. **도구처럼 보여야 한다.** 마케팅 장식 없이, 발표 직전에 바로 쓰는 조작 패널. 랜딩도 기능 설명과 화면 미리보기만 둔다.
3. **발표 중의 실수는 되돌릴 수 있어야 한다.** 조작 영역은 크게, [취소]는 진행 중 항상 보이게, 종료는 한 번 더 눌러야 되게 한다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

## 색상
다크 테마 고정. 라이트 모드는 만들지 않는다.

### 배경
| 용도 | 값 |
|------|------|
| 페이지 | `#0a0a0a` |
| 패널·카드 | `#141414` |
| 입력 필드 | `bg-neutral-900` (`#171717`) |
| 경계선 | `border-neutral-800` (`#262626`) |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트 | `text-neutral-50` |
| 본문 | `text-neutral-300` |
| 보조 | `text-neutral-400` |
| 비활성 | `text-neutral-500` |

### 데이터/시맨틱 색상
| 용도 | 값 |
|------|------|
| 정상 페이스 (`on_track`) | `#22c55e` (green-500) |
| 빠름 (`ahead`) | `#3b82f6` (blue-500) |
| 느림 (`behind`) | `#ef4444` (red-500) |
| 알림 깜빡임 테두리 | `#f59e0b` (amber-500) |
| 에러 문구 | `text-red-400` |
| MOCK 모드 배지 | `bg-amber-500/15 text-amber-300 border border-amber-500/40` |
| 중립 (대기·미진행) | `#525252` (neutral-600) |

- 상태는 **항상 색과 글자를 함께** 쓴다 ("느림", "빠름", "정상"). 색만으로 구분하지 않는다.
- 타이머 화면 배경은 상태색을 아주 옅게 섞는다 (`bg-green-500/10` 등). 메인 숫자와 상태 글자는 상태색 그대로.

## 컴포넌트
### 패널
```
rounded-md bg-[#141414] border border-neutral-800 p-4
```
목록은 패널을 반복하지 말고 `divide-y divide-neutral-800`로 나눈다.

### 버튼
```
Primary:   h-11 px-4 rounded-md bg-neutral-50 text-neutral-950 font-medium hover:bg-neutral-200
Secondary: h-11 px-4 rounded-md border border-neutral-700 text-neutral-100 hover:bg-neutral-900
Danger:    h-11 px-4 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10
Text:      text-neutral-400 hover:text-neutral-200
```
- 터치 대상은 최소 44×44px.
- 아이콘만 있는 버튼에도 `aria-label`을 단다. 타이머 조작 버튼은 글자 라벨을 함께 쓴다.

### 입력 필드
```
h-11 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-neutral-100
placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none
```
- 시간 입력은 `분:초` 형식 하나로 받는다.
- 에러는 필드 아래 `text-sm text-red-400` 한 줄.

### 포커스
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400
```

## 레이아웃
- 관리 화면(룸 목록·편집·요금제·계정·약관): `max-w-3xl mx-auto px-4 sm:px-6`, 좌측 정렬.
- 타이머·참여자·대기실 화면: 화면 전체(`h-dvh`), 스크롤 없음. 메인 숫자는 중앙 정렬한다 (이 화면만 예외).
- 간격: 요소 사이 `gap-3`~`gap-4`, 섹션 사이 `space-y-8`.
- 폰 세로, 폰 가로, 태블릿, 노트북, 외부 모니터 모두에서 메인 숫자가 잘리지 않아야 한다.

## 타이포그래피
글꼴은 시스템 글꼴을 쓴다 (`-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`). 외부 웹폰트를 불러오지 않는다. 시간 숫자는 모두 `tabular-nums`.

| 용도 | 스타일 |
|------|--------|
| 메인 차이 숫자 | `font-semibold tabular-nums leading-none`, 크기 `clamp(4rem, 20vw, 14rem)` |
| 상태 글자 ("느림") | `text-2xl sm:text-3xl font-medium`, 상태색 |
| 구간 남은 시간 | `tabular-nums`, 크기 `clamp(2rem, 8vw, 5rem)` |
| 전체 남은 시간·보조 정보 | `text-base text-neutral-400 tabular-nums` |
| 페이지 제목 | `text-2xl font-semibold text-neutral-50` |
| 섹션 제목 | `text-sm font-medium text-neutral-400` |
| 본문 | `text-sm text-neutral-300 leading-relaxed` |

## 화면별 구성

### 타이머 화면 (방장, `/rooms/[id]/run`)
위에서 아래 순서:
1. **상단 줄**: 룸 제목 · 구간 `n/N` 이름 · 발언자(토론) · 연결 상태 · 접속 `2/3` · 전체화면 버튼(지원 기기만)
2. **메인**: 누적 차이 `+0:42` + 상태 글자 `느림` (상태색)
3. **보조**: 구간 남은 시간 (초과면 `+0:23 초과`), 전체 남은 시간
4. **타임라인 바**: 구간별 블록(계획 시간 비율) 위에 계획상 위치 마커와 실제 위치 마커. 두 마커는 모양으로도 구분한다 (예: 세로선 / 원)
5. **발언자별 차이** (토론만): `찬성 +0:15 · 반대 -0:05`
6. **하단 조작**: [일시정지/재개] [취소] [지금 종료] [공유]. 취소는 되돌릴 '다음'이 있을 때만 활성
- 마지막 구간에서 [다음]을 누르면 메인 아래에 "한 번 더 누르면 종료"를 3초간 표시한다.
- 공유 패널: 링크 복사, QR 코드, 접속자 닉네임 목록, 링크 다시 만들기(확인 포함). 열려 있어도 타이머가 가려지지 않게 측면 또는 하단 시트로.

### 참여자 화면 (`/j/[token]`)
- 타이머 화면과 같은 구성에서 하단 조작을 빼고, 상단에 음소거 토글을 둔다.
- 대기실: 룸 제목, 구간 미리보기 목록, "선생님이 시작하면 자동으로 시작돼요" 같은 안내, 접속 인원.
- 방장 연결이 끊기면 상단에 "방장 연결 끊김 · 타이머는 계속 흐릅니다".

### 리포트
- 요약: 최종 차이(상태색 + 글자), 정상 종료 / 중도 종료, 전체 계획 시간, 진행한 구간의 계획 시간, 실제 활성 시간.
- 표: 구간 · 계획 · 실제 · 차이 · 상태(`중단`/`미진행` 배지). 차이는 상태색 글자.
- 그래프(SVG): 가로축 실제 활성 시간, 세로축 누적 차이, 0 기준선. 선은 `neutral-300`, 구간 경계 점은 그 시점의 상태색.
- 참여자 리포트 하단에 "나도 만들기" 버튼 (랜딩으로, `signup_ref` 전달).

## 조작 입력
- 타이머 화면에 `touch-action: manipulation`, `user-select: none`을 건다.
- 터치 기기에서 버튼이 아닌 영역 탭 = [다음]. 시작 지점에서 10px 넘게 움직인 터치는 무시한다.
- 키보드 단축키는 `keydown`에서 처리하고 기본 동작을 막는다. 입력 필드에 포커스가 있으면 끈다.
- 0.5초 안의 두 번째 [다음]은 무시한다.

## 애니메이션
허용하는 것만 쓴다. 그 외 모든 애니메이션 금지.
- 상태색 전환: `transition-colors duration-200`
- 알림: 화면 가장자리 8px amber 테두리 0.4초 깜빡임 2회
- "한 번 더 누르면 종료" 표시: fade-in 150ms
- `prefers-reduced-motion`이면 깜빡임 대신 테두리를 1.5초 고정 표시

## 아이콘
- SVG 인라인, 24px, `strokeWidth 1.5`, `currentColor`.
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다.

## 문구
- 짧은 존댓말("~해요")로 쓴다. 예: "인원이 가득 찼어요", "진행 중에는 수정할 수 없어요".
- 모든 문구와 에러 메시지는 `src/lib/messages.ts`에서 가져온다. 컴포넌트에 문구를 직접 쓰지 않는다.
