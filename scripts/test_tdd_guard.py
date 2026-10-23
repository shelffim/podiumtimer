"""실제 훅 프로세스에 입력을 보내 파일명 예외와 기본 차단을 검증한다."""

import json
import os
from pathlib import Path
import subprocess

import pytest


GUARD = Path(__file__).parent / "hooks" / "tdd-guard.sh"


def invoke_guard(project, relative_path):
    result = subprocess.run(
        ["bash", str(GUARD.resolve())],
        input=json.dumps({"tool_input": {"file_path": str(project / relative_path)}}),
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(project)},
        cwd=project, capture_output=True, text=True, check=True,
    )
    if not result.stdout.strip():
        return None
    return json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"]


@pytest.fixture
def project(tmp_path):
    # 프로젝트 경로에 test/spec이 있어도 소스가 면제되면 안 된다.
    root = tmp_path / "test-spec-project"
    root.mkdir()
    (root / "package.json").write_text("{}")
    return root


@pytest.mark.parametrize("name", ["calc", "latest", "contest", "inspector"])
def test_source_requires_test(project, name):
    assert invoke_guard(project, f"src/lib/{name}.ts") == "deny"


@pytest.mark.parametrize("relative_path", [
    "src/lib/calc.test.ts", "src/lib/calc.spec.ts",
    "src/__tests__/fixture.ts", "src/__mocks__/client.ts", "jest.setup.ts",
    "src/test/setup.ts", "src/test-utils.tsx", "tests/helpers/db.ts", "vitest.workspace.ts",
])
def test_test_support_files_are_allowed(project, relative_path):
    assert invoke_guard(project, relative_path) is None


def test_corresponding_test_allows_source(project):
    directory = project / "src/lib"
    directory.mkdir(parents=True)
    (directory / "calc.test.ts").write_text("test('calc', () => {});")
    assert invoke_guard(project, "src/lib/calc.ts") is None


def test_bootstrap_without_package_json_is_allowed(project):
    (project / "package.json").unlink()
    assert invoke_guard(project, "src/lib/calc.ts") is None
