# Step 4: realtime-mock

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (핵심 규칙 R1·R9·R10, "공유 동기화", "mock 모드")
- `/docs/ADR.md` (ADR-007, ADR-008)
- `/src/types/share.ts` (`PresenceMember`, `PresenceRole`)
- `/src/lib/seats.ts`
- `/src/services/api/index.ts`, `/src/services/api/device.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

공유 채널 인터페이스와 mock 구현을 `src/services/realtime.ts` 한 파일에 만든다. 화면은 이 파일만 부른다. live(Supabase Broadcast·Presence) 구현은 다음 phase에서 추가한다.

TDD: `src/services/realtime.test.ts`를 먼저 만든다(TDD 가드).

```ts
export type ShareChannel = {
  onChanged(handler: () => void): () => void                       // 해제 함수 반환
  onPresence(handler: (members: PresenceMember[]) => void): () => void
  track(meta: { nickname: string; role: PresenceRole; joinedAt: number }): Promise<void>
  sendChanged(rev: number): Promise<void>
  leave(): Promise<void>
}
export function joinShareChannel(code: string, clientId: string): ShareChannel
```

핵심 규칙:

- **변경 신호는 힌트일 뿐이다.** `onChanged` 핸들러에는 아무 값도 넘기지 않는다. 받은 쪽은 서버(mock은 `api.getShare`)에서 다시 읽어야 한다. 메시지 내용으로 화면 상태를 바꿀 수 없게 하려는 것이다(AGENTS.md CRITICAL).
- **mock 구현**: 같은 브라우저의 다른 탭끼리 `BroadcastChannel('share:' + code)`로 통신한다.
  - `sendChanged(rev)`: `{ type: 'changed', rev }`를 보낸다. 받은 쪽은 모양이 맞을 때만 `onChanged` 핸들러를 부른다.
  - `track(meta)`: 내 항목 `{ clientId, ...meta }`를 저장하고 다른 탭에 알린다. 새로 들어온 탭이 기존 참가자를 알 수 있도록, 알림을 받은 탭은 자기 항목을 다시 보낸다(한 번만, 무한 반복 금지).
  - 접속자 목록 = 내 항목 + 받은 항목(`clientId` 기준). 바뀔 때마다 `onPresence` 핸들러를 부른다. 핸들러를 등록하면 곧바로 현재 목록으로 한 번 부른다.
  - `leave()`: 다른 탭에 떠남을 알리고 채널을 닫는다. 탭을 닫을 때(`pagehide`)도 떠남을 알린다.
  - 모양이 틀린 메시지는 무시한다.
- 테스트 환경(jsdom)에 `BroadcastChannel`이 없거나 불안정하면, 구현이 채널 생성 함수를 주입받을 수 있게 하고 테스트에서는 메모리 구현을 넣어라.

테스트에 반드시 넣을 것: 두 채널 사이 `changed` 전달(핸들러에 값 없음), 늦게 들어온 채널이 기존 참가자 목록을 받음, `leave` 뒤 목록에서 빠짐, 해제 함수로 핸들러 해제, 잘못된 메시지 무시.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/services/realtime.ts`)
   - ADR 기술 스택을 벗어나지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가? (Realtime 메시지는 힌트만)
3. 결과에 따라 `phases/0-mock-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (ShareChannel 메서드와 mock 메시지 종류)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 실행 상태나 남은 시간을 채널로 보내지 마라. 이유: 매초 전송하지 않고 각 화면이 `computeTimer`로 계산한다(ARCHITECTURE R6).
- 입장 판정을 이 파일에서 하지 마라. 이유: 판정은 `src/lib/seats.ts`의 `admit`으로만 한다.
- 닉네임을 저장소에 쓰지 마라. 이유: 닉네임은 Presence에만 있다.
- Supabase SDK를 설치하거나 import하지 마라. live 분기용 빈 자리도 만들지 마라. 이유: 다음 phase 범위다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `.codex/`를 수정하지 마라. 이유: 실행기 가드레일과 기획 기준이다.
- 기존 테스트를 깨뜨리지 마라
