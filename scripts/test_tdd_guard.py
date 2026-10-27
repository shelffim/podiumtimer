"""실제 훅 프로세스에 입력을 보내 파일명 예외와 기본 차단을 검증한다."""

import json
from pathlib import Path
import subprocess

import pytest


GUARD = Path(__file__).parent / "hooks" / "tdd-guard.sh"


def invoke_guard(project, tool_input):
    # Codex는 세션 cwd에서 훅을 실행한다.
    result = subprocess.run(
        ["bash", str(GUARD.resolve())],
        input=json.dumps({"tool_name": "apply_patch", "tool_input": tool_input}),
        cwd=project, capture_output=True, text=True, check=True,
    )
    if not result.stdout.strip():
        return None
    return json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"]


def apply_patch(*files, action="Add File"):
    """Codex apply_patch 입력. 경로는 세션 cwd 기준 상대 경로다."""
    hunks = "".join(f"*** {action}: {f}\n+export {{}};\n" for f in files)
    return {"command": f"*** Begin Patch\n{hunks}*** End Patch\n"}


@pytest.fixture
def project(tmp_path):
    # 프로젝트 경로에 test/spec이 있어도 소스가 면제되면 안 된다.
    root = tmp_path / "test-spec-project"
    root.mkdir()
    (root / "package.json").write_text("{}")
    return root


@pytest.mark.parametrize("name", ["calc", "latest", "contest", "inspector"])
def test_source_requires_test(project, name):
    assert invoke_guard(project, apply_patch(f"src/lib/{name}.ts")) == "deny"


@pytest.mark.parametrize("relative_path", [
    "src/lib/calc.test.ts", "src/lib/calc.spec.ts",
    "src/__tests__/fixture.ts", "src/__mocks__/client.ts", "jest.setup.ts",
    "src/test/setup.ts", "src/test-utils.tsx", "tests/helpers/db.ts", "vitest.workspace.ts",
])
def test_test_support_files_are_allowed(project, relative_path):
    assert invoke_guard(project, apply_patch(relative_path)) is None


def test_corresponding_test_allows_source(project):
    directory = project / "src/lib"
    directory.mkdir(parents=True)
    (directory / "calc.test.ts").write_text("test('calc', () => {});")
    assert invoke_guard(project, apply_patch("src/lib/calc.ts", action="Update File")) is None


def test_bootstrap_without_package_json_is_allowed(project):
    (project / "package.json").unlink()
    assert invoke_guard(project, apply_patch("src/lib/calc.ts")) is None


def test_any_untested_file_in_patch_denies(project):
    # 한 패치에 테스트와 구현을 함께 넣어도 테스트가 먼저 있어야 한다.
    assert invoke_guard(project, apply_patch("src/lib/calc.test.ts", "src/lib/calc.ts")) == "deny"


def test_absolute_patch_path_is_checked(project):
    assert invoke_guard(project, apply_patch(str(project / "src/lib/calc.ts"))) == "deny"


def test_delete_is_allowed(project):
    assert invoke_guard(project, apply_patch("src/lib/calc.ts", action="Delete File")) is None


def test_claude_file_path_input_is_checked(project):
    # .claude/settings.json 훅도 같은 스크립트를 쓴다.
    assert invoke_guard(project, {"file_path": str(project / "src/lib/calc.ts")}) == "deny"
