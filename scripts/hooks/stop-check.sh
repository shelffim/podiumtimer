#!/bin/bash
# Stop Hook — Claude Stop · Codex Stop
# 턴이 끝날 때 바뀐 구현 파일의 테스트 존재(TDD) → lint → build → test 순서로 확인한다.
# 마지막으로 통과한 작업 트리와 내용이 같으면 건너뛴다. 질문만 한 턴에 빌드를 다시 돌리지 않기 위해서다.

INPUT=$(cat)
# 이미 한 번 막혀서 이어 가는 중이면 무한 반복을 막기 위해 통과시킨다.
echo "$INPUT" | grep -qE '"stop_hook_active": ?true' && exit 0

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -f package.json ] || exit 0

HOOKS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PASSED=$(git rev-parse --git-path claude-stop-passed)

# 지금 작업 트리(추적 안 하는 새 파일 포함, .gitignore 제외)를 트리 해시 하나로 만든다.
# 실제 index를 건드리지 않도록 복사본에 add 한다.
INDEX=$(mktemp)
rm -f "$INDEX"
cp "$(git rev-parse --git-path index)" "$INDEX" 2>/dev/null
TREE=$(GIT_INDEX_FILE="$INDEX" git add -A . 2>/dev/null && GIT_INDEX_FILE="$INDEX" git write-tree)
rm -f "$INDEX"
[ -n "$TREE" ] || exit 0

LAST=$(cat "$PASSED" 2>/dev/null)
[ "$TREE" = "$LAST" ] && exit 0

# 마지막 통과 이후 바뀐 파일을 본다. 같은 턴에 커밋한 파일도 잡기 위해 HEAD가 아니라 통과 시점과 비교한다.
if [ "$(git cat-file -t "$LAST" 2>/dev/null)" = "tree" ]; then
  BASE=$LAST
else
  BASE=$(git rev-parse -q --verify 'HEAD^{tree}' || git hash-object -t tree /dev/null)
fi

# Bash로 고친 파일은 PreToolUse TDD 가드를 거치지 않으므로, 같은 규칙(tdd-guard.sh)을 바뀐 파일 전체에 다시 적용한다.
CHANGED=$(git diff --name-only --diff-filter=d "$BASE" "$TREE")
if [ -n "$CHANGED" ]; then
  REASON=$(printf '%s\n' "$CHANGED" | sed 's/^/*** Update File: /' | jq -Rs '{tool_input: {command: .}}' \
    | bash "$HOOKS_DIR/tdd-guard.sh" | jq -r '.hookSpecificOutput.permissionDecisionReason // empty' 2>/dev/null)
  if [ -n "$REASON" ]; then
    echo "바뀐 파일 검사 — $REASON" >&2
    exit 2
  fi
fi

OUT=$(npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1) || { echo "$OUT" >&2; exit 2; }
echo "$TREE" > "$PASSED"
exit 0
