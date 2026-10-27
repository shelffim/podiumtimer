#!/bin/bash
# TDD Guard Hook — Codex PreToolUse[apply_patch] (Claude PreToolUse[Edit|Write]도 지원)
# 구현 코드를 작성하려 할 때, 해당 모듈의 테스트 파일이 먼저 존재하는지 체크.
# 테스트 없이 구현 코드를 작성하려 하면 차단.

INPUT=$(cat)
# Codex는 패치 본문(tool_input.command)에, Claude는 tool_input.file_path에 경로를 준다.
# 패치는 여러 파일을 한 번에 고칠 수 있으므로 추가·수정·이동 대상 경로를 모두 검사한다. 삭제는 검사하지 않는다.
FILE_PATHS=$(echo "$INPUT" | jq -r '
  .tool_input.file_path // empty,
  ((.tool_input.command // "") | strings | split("\n")[]
    | capture("^\\*\\*\\* (Add File|Update File|Move to): (?<path>.+)$") | .path)')

# 파일 경로가 없으면 통과
if [ -z "$FILE_PATHS" ]; then
  exit 0
fi

# 훅은 세션 cwd에서 실행되고 Codex가 하위 폴더에서 시작할 수 있으므로 git 루트를 프로젝트 루트로 쓴다.
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)

# 프로젝트가 아직 스캐폴딩되지 않았으면(package.json 없음) TDD 가드를 건너뛴다.
# 테스트 프레임워크가 깔리기 전(MVP 부트스트랩)에는 강제할 대상이 없기 때문.
# package.json이 생기면 이후 모든 lib/소스 편집에 TDD가 적용된다.
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  exit 0
fi

while IFS= read -r FILE_PATH; do
  # 패치의 상대 경로는 세션 cwd 기준이다.
  case "$FILE_PATH" in
    /*) ;;
    *) FILE_PATH="$(pwd -P)/$FILE_PATH" ;;
  esac

  # 패턴은 프로젝트 기준 경로로 검사한다.
  # 절대 경로로 검사하면 프로젝트 폴더명에 test/spec이 들어갈 때 모든 파일이 통과된다.
  REL_PATH="/${FILE_PATH#"$PROJECT_ROOT"/}"

  # 테스트 파일과 테스트 설정·헬퍼·mock 파일(jest.setup.ts, test/, test-utils, __mocks__/)은 허용
  case "$REL_PATH" in
    *.test.*|*.spec.*|*.setup.*|*/__tests__/*|*/__mocks__/*|*/test/*|*/tests/*|*/test-utils.*|*/vitest.*)
      continue
      ;;
  esac

  # 설정/타입/스타일 파일은 테스트 불필요 — 허용
  case "$REL_PATH" in
    *.json|*.css|*.scss|*.md|*.yml|*.yaml|*.env*|*.config.*|*tailwind*|*postcss*|*next.config*|*tsconfig*)
      continue
      ;;
  esac

  # types/ 폴더와 타입 선언 파일은 테스트 불필요 — 허용
  case "$REL_PATH" in
    */types/*|*/types.ts|*.d.ts)
      continue
      ;;
  esac

  # Next.js 프레임워크 파일은 허용 (layout, page, loading, error, not-found, global styles)
  case "$REL_PATH" in
    */layout.tsx|*/layout.ts|*/page.tsx|*/page.ts|*/loading.tsx|*/error.tsx|*/not-found.tsx|*/globals.css)
      continue
      ;;
  esac

  # lib/ 또는 소스 파일이면 테스트 파일 존재 여부 확인
  case "$FILE_PATH" in
    *.ts|*.tsx|*.js|*.jsx)
      # 파일명 추출
      DIR=$(dirname "$FILE_PATH")
      BASENAME=$(basename "$FILE_PATH" | sed -E 's/\.(ts|tsx|js|jsx)$//')

      # 테스트 파일 후보 경로들
      TEST_FOUND=false

      # 같은 폴더에 .test 파일
      for EXT in ts tsx js jsx; do
        if [ -f "${DIR}/${BASENAME}.test.${EXT}" ] || [ -f "${DIR}/${BASENAME}.spec.${EXT}" ]; then
          TEST_FOUND=true
          break
        fi
      done

      # __tests__ 폴더
      if [ "$TEST_FOUND" = false ]; then
        PARENT=$(dirname "$DIR")
        for EXT in ts tsx js jsx; do
          if [ -f "${PARENT}/__tests__/${BASENAME}.test.${EXT}" ] || [ -f "${DIR}/__tests__/${BASENAME}.test.${EXT}" ]; then
            TEST_FOUND=true
            break
          fi
        done
      fi

      # src/__tests__/ 루트 테스트 폴더
      if [ "$TEST_FOUND" = false ]; then
        for EXT in ts tsx js jsx; do
          if [ -f "${PROJECT_ROOT}/src/__tests__/${BASENAME}.test.${EXT}" ]; then
            TEST_FOUND=true
            break
          fi
        done
      fi

      # 테스트를 만들 정확한 경로를 알려줘야 탐색하지 않는 위치에 만들고 계속 차단되는 일이 없다.
      if [ "$TEST_FOUND" = false ]; then
        cat << EOF
  {
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "TDD GUARD: '${BASENAME}'에 대한 테스트 파일이 존재하지 않습니다. 구현 코드를 작성하기 전에 테스트를 먼저 작성하세요. (테스트 파일 경로: ${DIR}/${BASENAME}.test.${FILE_PATH##*.})"
    }
  }
EOF
        exit 0
      fi
      ;;
  esac

done <<< "$FILE_PATHS"

exit 0
