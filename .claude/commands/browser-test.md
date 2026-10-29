---
description: docs/BROWSER_TEST.md 유스케이스를 브라우저로 돌리고 실행 기록을 남긴다
argument-hint: "[UC 번호들, 예: 2 5 — 비우면 UC1~UC6 전부]"
---

`docs/BROWSER_TEST.md` 기준으로 브라우저 테스트를 돌려라. 대상 UC: $ARGUMENTS (비어 있으면 UC1~UC6 전부)

## 1. 개발 서버
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` 이 200인지 본다.
- 꺼져 있으면 `npm run dev`를 백그라운드로 띄우고 200이 될 때까지 기다린다.
- mock 모드인지 확인한다(`.env`의 `NEXT_PUBLIC_DATA_MODE`가 `mock`이거나 비어 있음). live면 멈추고 사용자에게 묻는다.

## 2. 실행
`browser-tester` 에이전트에게 대상 UC를 넘겨 실행을 맡긴다. 직접 dev-browser를 돌리지 마라. 이유: 스크린샷과 단계별 출력이 메인 대화의 컨텍스트를 채운다.

## 3. 문서 갱신
에이전트 보고를 받으면 `docs/BROWSER_TEST.md`만 고친다.
- 6절 "실행 기록" 표 맨 위에 보고의 "실행 기록 한 줄"을 넣는다.
- "새 문제"를 4절 "알려진 문제" 표에 추가한다. "해결됨"으로 확인된 문제는 "해결한 문제" 표로 옮긴다.

## 4. 보고
- UC별 결과 표와 새 문제를 사용자에게 보여준다.
- 문제를 고치지 마라. 어떤 문제를 고칠지, 정책을 어떻게 할지는 사용자에게 묻는다.
- 커밋하지 마라.
