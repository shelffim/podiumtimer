# Step 9: share-host

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md` ("로그인과 공유", "플랜", "흐름 C", "흐름 E"의 ③, "예외 상황")
- `/docs/ARCHITECTURE.md` (핵심 규칙 R8·R9·R10, "데이터 흐름", "서버 액션"의 `createShare`·`updateShareState`, "공유 동기화")
- `/docs/ADR.md` (ADR-007, ADR-008)
- `/docs/UI_GUIDE.md` ("타이머 화면"의 시작 전·접속·자리 가득·공유 연결 끊김, "안내")
- `/src/types/share.ts`, `/src/types/run.ts`
- `/src/lib/seats.ts`, `/src/lib/billing.ts`, `/src/lib/messages.ts`
- `/src/services/api/index.ts`, `/src/services/api/mock.ts`, `/src/services/api/device.ts`, `/src/services/realtime.ts`
- `/src/components/RunScreen.tsx`와 그 테스트

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

발표자 진행 화면에 공유를 붙인다: 링크 만들기·복사, 접속자 표시, 자리 가득 안내, 실행 상태 저장과 변경 신호.

TDD: 새 파일마다 옆에 `*.test.ts(x)`를 먼저 만든다(TDD 가드). 테스트는 `vi.useFakeTimers()`와 `vi.mock('@/services/api')`·`vi.mock('@/services/realtime')`로 실패·재시도를 재현한다.

### 1. `src/components/useShareHost.ts`
```ts
export function useShareHost(opts: {
  code: string | null
  run: RunState
  segments: Segment[]
  offset: number
}): { members: PresenceMember[]; seatCap: number | null; disconnected: boolean }
```
`code`가 `null`이면 아무것도 하지 않는다. 있으면:

- **채널**: `joinShareChannel(code, device.getClientId())`. `track({ nickname: MESSAGES의 발표자 표시 이름, role: 'host', joinedAt: Date.now() + offset })`. `onPresence`로 `members`를 갱신한다. 언마운트하거나 `code`가 바뀌면 `leave()`.
- **인원 한도 읽기**: 시작할 때 `api.getShare(code)`로 `seatCap`을 읽는다. 시작 상태 저장이 성공한 뒤 다시 읽는다(시작 때 플랜으로 덮어쓰이므로).
- **상태 저장** (`run.rev`가 바뀔 때마다, `idle`은 저장하지 않음):
  - `api.updateShareState(code, run, start?)`. 성공하면 `channel.sendChanged(run.rev)`.
  - **핵심 규칙: 시작 상태를 담은 저장이 한 번 성공하기 전까지는 모든 저장에 `start: { segments }`를 붙인다.** 이유: 시작 저장이 실패한 뒤 '다음'이 먼저 저장되면 공유의 구간과 인원 한도가 덮어써지지 않는다. 성공한 뒤에는 붙이지 않는다. 이유: 발표 도중 플랜이 바뀌어도 시작 때의 인원 한도를 유지해야 한다(PRD).
  - 이 "시작 저장 완료" 여부는 훅이 시작될 때 `api.getShare(code)`로 다시 계산한다: 서버 `state.startedAt`이 지금 `run.startedAt`과 같으면 이미 저장된 것이다. 새로고침 뒤에도 맞게 동작하게 하려는 것이다.
  - 실패하면(`ok: false`이거나 예외) `disconnected = true`. 1초, 2초, 4초… 최대 30초 간격으로 **가장 최신 상태**를 다시 저장한다. 성공하면 `disconnected = false`.
  - 저장 요청은 한 번에 하나만 보낸다. 보내는 중에 새 상태가 생기면 끝난 뒤 최신 상태 하나만 보낸다.
  - 화면 복귀(`visibilitychange` → visible)와 `online` 이벤트 때 최신 상태를 한 번 더 저장한다(서버는 같은 `rev`를 무시한다).

### 2. `src/components/ShareHostPanel.tsx`
대기 화면에 들어가는 공유 영역.
```ts
props: {
  timerId: string
  code: string | null
  seatCap: number | null
  members: PresenceMember[]
  onCreate: () => void
}
```
- `code`가 없으면 [공유 링크 만들기](Secondary).
- 있으면: 링크 `location.origin + '/s/' + code`, [복사](`navigator.clipboard.writeText`, 성공하면 "복사했어요"), `seatUsage(members, seatCap)`로 "접속 2/3", 시청자 닉네임 목록(`joinedAt` 순).
- `seatUsage(...).full`이면 "접속" 줄 아래 안내 박스 "자리가 가득 찼어요". `seatCap < LIMITS.pass.seats`면 "30일권은 10명까지"와 [30일권 보기] → `/pricing?returnTo=/timers/{timerId}/run`도 보여준다.
- QR 코드, 링크 다시 만들기, 시청자 내보내기 버튼은 없다.

### 3. `RunScreen` 수정
- 대기 화면에 `ShareHostPanel`을 넣는다. [공유 링크 만들기] → `api.createShare(timerId)` → `LocalRun.shareCode = code`(대기 상태 그대로)로 `device.saveRun`. 실패하면 `errorMessage`.
- `useShareHost({ code: local.shareCode, run, segments, offset })`를 쓴다.
- 진행 화면: 공유 중이면 상단 바 아래 줄에 "접속 n/cap"을 보여주고, `disconnected`면 그 옆에 "공유 연결 끊김"을 작게(`text-xs text-neutral-400`) 표시한다. 이 줄도 `data-no-advance`다. 자리 가득 안내 박스는 대기 화면에만 둔다.
- 종료·중단 상태도 공유에 저장된다(`rev`가 바뀌므로). [다시 하기]는 `shareCode`를 지우므로 채널을 떠난다. 다음 발표는 새 링크가 필요하다.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

테스트에 반드시 넣을 것: 저장 성공 뒤에만 `sendChanged`, 시작 저장 실패 → 다음 저장(next)에 `start`가 붙음 → 성공 뒤 저장에는 안 붙음, 서버 `startedAt`이 같으면 처음부터 `start`를 붙이지 않음, 실패 중 `disconnected` true와 간격 늘리며 재시도, 보내는 중 생긴 여러 상태는 최신 하나만 저장, `idle`은 저장 안 함, 자리 가득 시 안내(무료 인원 한도일 때만 [30일권 보기]), [다시 하기] 뒤 `leave` 호출.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (Realtime 메시지는 힌트만, 인원 판정은 `src/lib/seats.ts`)
   - UI_GUIDE.md 규칙(색·글꼴·모서리·아이콘·문구)을 따르는가?
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 진행 중에 공유 링크를 만들게 하지 마라. 이유: 공유 링크는 시작 전에만 만든다(PRD). 진행 중 공유 시트도 MVP 제외 사항이다.
- 매초 상태를 보내지 마라. 이유: 조작으로 `rev`가 바뀔 때만 저장한다.
- 채널 메시지에 실행 상태를 담거나, 받은 메시지로 화면 상태를 바꾸지 마라. 이유: AGENTS.md CRITICAL, Realtime은 "바뀌었음" 힌트뿐이다.
- 시작 저장 성공 뒤에도 `start`를 계속 붙이지 마라. 이유: 발표 도중 30일권이 만료되면 인원 한도가 줄어든다(PRD "진행 중에 30일권 만료").
- 시청자를 내보내거나 링크를 다시 만드는 기능을 만들지 마라. 이유: PRD MVP 제외 사항이다.
- 컴포넌트에 문구를 직접 쓰지 마라. 이유: `src/lib/messages.ts`에 모은다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
