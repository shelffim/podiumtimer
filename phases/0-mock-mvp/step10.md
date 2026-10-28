# Step 10: viewer-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("로그인과 공유", "결과와 기록", "흐름 D. 시청자 입장", "예외 상황")
- `/docs/ARCHITECTURE.md` (핵심 규칙 R9·R10, "데이터 흐름", "공유 동기화", "에러 처리"의 시청자 페이지 동적 렌더링)
- `/docs/ADR.md` (ADR-003, ADR-007, ADR-008)
- `/docs/DESIGN.md` ("시청자 화면", "타이머 화면", "결과 표", "레이아웃")
- `/src/types/share.ts`, `/src/types/run.ts`
- `/src/lib/seats.ts`, `/src/lib/timer.ts`, `/src/lib/validation.ts`, `/src/lib/messages.ts`
- `/src/services/api/index.ts`, `/src/services/api/device.ts`, `/src/services/realtime.ts`
- `/src/components/TimerFace.tsx`, `/src/components/ResultTable.tsx`, `/src/components/SegmentList.tsx`, `/src/components/useNow.ts`
- `/src/components/useShareHost.ts` (발표자 쪽 재시도 방식 참고)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

로그인 없는 시청자 화면 `/s/[code]`를 만든다.

TDD: 새 파일마다 옆에 `*.test.ts(x)`를 먼저 만든다(TDD 가드). 테스트는 `vi.useFakeTimers()`와 `vi.mock('@/services/api')`·`vi.mock('@/services/realtime')`로 순서·재조회를 확인한다.

### 1. `src/app/s/[code]/page.tsx`
`export const dynamic = 'force-dynamic'`. 얇은 Server Component: `ViewerScreen code={code}`. `RequireAuth`와 `PageShell`을 쓰지 않는다.

### 2. `src/components/useShareViewer.ts`
```ts
export function useShareViewer(opts: { code: string; nickname: string | null; offset: number }): {
  share: ShareView | null
  status: 'loading' | 'not_found' | 'full' | 'ready'
  disconnected: boolean
}
```
`nickname`이 `null`이면 채널에 들어가지 않는다. 들어가면 아래 순서를 지킨다.

1. `joinShareChannel(code, device.getClientId())`를 만들고 `onChanged`·`onPresence` 핸들러를 **먼저** 등록한다.
2. `track({ nickname, role: 'viewer', joinedAt: Date.now() + offset })`.
3. 그다음 `api.getShare(code)`로 상태를 읽는다.

재조회:
- `changed`를 받으면 다시 읽는다. 1초 안에 여러 개가 오면 한 번만 읽는다.
- 화면이 보이는 동안 10초마다 다시 읽는다. 화면 복귀(`visibilitychange` → visible)와 `online` 때 바로 다시 읽는다.
- 조회는 한 번에 하나만 보낸다. 보내는 중에 다시 읽을 일이 생기면 끝난 뒤 한 번 더 읽는다.
- 응답의 `rev`가 지금 가진 값보다 클 때만 반영한다.
- 조회가 실패하면 `disconnected = true`, 1초·2초·4초… 최대 30초 간격으로 재시도. 성공하면 `false`.
- `NOT_FOUND`면 `not_found`(진행 중에 타이머가 삭제된 경우 포함).

입장 판정:
- `onPresence`로 받은 목록에 **내 `clientId`가 나타난 뒤부터** `admit(members, clientId, share.seatCap)`으로 판정한다. 그 전에는 판정하지 않는다.
- `false`면 `full`로 바꾸고 `leave()`하고 재조회를 멈춘다.

### 3. `src/components/ViewerScreen.tsx`
props `{ code: string }`.
- 처음: `api.getServerOffset()`, `api.getShare(code)`. `NOT_FOUND`면 "존재하지 않는 링크예요".
- 이 코드로 입장한 적이 있고(`device.hasJoined(code)`) 저장된 닉네임이 `nicknameSchema`를 통과하면 바로 다시 들어간다(새로고침 자동 재입장).
- 아니면 닉네임 입력: 타이머 이름, 닉네임 칸(`device.loadNickname()`으로 자동 채움), [입장](Primary). `sanitizeNickname` + `nicknameSchema`로 검사하고 오류는 칸 아래 한 줄. 통과하면 `device.saveNickname`, `device.markJoined(code)` 뒤 입장.
- 입장 뒤 `share.state.status`에 따라:
  - `idle`: 대기실. 타이머 이름, `SegmentList`, "발표자가 시작하면 자동으로 시작돼요".
  - `running`: `h-dvh`, 스크롤 없음. 상단에 `progressLabel`만(버튼·접속 인원 없음). `TimerFace`에 `computeTimer(share.segments, share.state, useNow(offset, true))`. 탭·키 입력은 아무 일도 하지 않는다.
  - `finished`: 타이머 이름 + `ResultTable`(`buildResult(share.segments, share.state)`).
  - `aborted`: "발표가 중단되었어요".
- `full`: "인원이 가득 찼어요 (3/3)" (숫자는 `seatCap`).
- `disconnected`면 오른쪽 위에 "연결 끊김"을 작게 표시한다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 핸들러 등록 → `track` → `getShare` 순서, 1초 안 `changed` 3개 → 조회 1번, 더 작거나 같은 `rev` 응답 무시, 보이는 동안만 10초 재조회, 조회 실패 시 "연결 끊김"과 재시도, 내 `clientId`가 목록에 나오기 전에는 판정 안 함, 무료 3자리에서 4번째 시청자 → "인원이 가득 찼어요 (3/3)"와 `leave`, 없는 링크 문구, 저장된 닉네임으로 자동 재입장, `idle`/`running`/`finished`/`aborted` 화면 전환.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (`changed`는 재조회 계기로만, 판정은 `admit`, 계산은 `computeTimer`)
   - DESIGN.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `changed` 메시지 내용(`rev` 등)으로 화면 상태를 바꾸지 마라. 이유: AGENTS.md CRITICAL, 공개 채널의 가짜 신호가 재조회만 일으켜야 한다.
- 시청자 화면에 접속 인원·발표자 연결 상태·"나도 만들기"를 표시하지 마라. 이유: PRD MVP 제외 사항이다.
- 시청자에게 로그인을 요구하지 마라. 이유: 시청자는 닉네임만 입력한다(ADR-003).
- 닉네임을 공유 데이터에 저장하지 마라. 이유: Presence와 기기 저장에만 둔다.
- 시청자 화면 탭에 동작을 넣지 마라. 이유: 탭 = '다음'은 발표자 화면에서만 동작한다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
