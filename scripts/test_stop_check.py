"""실제 Stop 훅 프로세스를 임시 git 저장소에서 돌려 검사 순서·건너뛰기·TDD 차단을 검증한다."""

import json
import os
from pathlib import Path
import subprocess

import pytest


STOP = Path(__file__).parent / "hooks" / "stop-check.sh"
FAKE_NPM = """#!/bin/sh
echo "$2" >> "$CALLS"
if [ "$2" = "$FAIL" ]; then echo "$2 실패"; exit 1; fi
"""


def git(project, *args):
    subprocess.run(["git", *args], cwd=project, check=True, capture_output=True)


@pytest.fixture
def project(tmp_path):
    root = tmp_path / "app"
    (root / "src/lib").mkdir(parents=True)
    (root / "package.json").write_text("{}")
    (root / "src/lib/calc.ts").write_text("export {};")
    (root / "src/lib/calc.test.ts").write_text("test('calc', () => {});")
    git(root, "init", "-q")
    git(root, "add", "-A")
    git(root, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init")
    return root


@pytest.fixture
def run(tmp_path, project):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "npm").write_text(FAKE_NPM)
    (bin_dir / "npm").chmod(0o755)
    calls = tmp_path / "calls.log"

    def invoke(active=False, fail=""):
        calls.write_text("")
        result = subprocess.run(
            ["bash", str(STOP.resolve())],
            input=json.dumps({"hook_event_name": "Stop", "stop_hook_active": active}),
            cwd=project, capture_output=True, text=True,
            env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "CALLS": str(calls), "FAIL": fail},
        )
        return result.returncode, result.stderr, calls.read_text().split()

    return invoke


def test_runs_lint_build_test_in_order(run):
    assert run() == (0, "", ["lint", "build", "test"])


def test_skips_when_nothing_changed_since_last_pass(run):
    run()
    assert run() == (0, "", [])


@pytest.mark.parametrize("change", ["tracked", "untracked"])
def test_reruns_after_any_change(run, project, change):
    run()
    if change == "tracked":
        (project / "src/lib/calc.test.ts").write_text("test('calc 2', () => {});")
    else:
        (project / "notes.md").write_text("메모")
    assert run()[2] == ["lint", "build", "test"]


def test_failure_reports_output_and_is_not_remembered(run):
    code, stderr, calls = run(fail="build")
    assert (code, calls) == (2, ["lint", "build"])
    assert "build 실패" in stderr
    assert run()[2] == ["lint", "build", "test"]


def test_skips_when_stop_hook_is_already_active(run, project):
    (project / "src/lib/new.ts").write_text("export {};")
    assert run(active=True) == (0, "", [])


def test_blocks_changed_source_without_test_before_lint(run, project):
    (project / "src/lib/new.ts").write_text("export {};")
    code, stderr, calls = run()
    assert (code, calls) == (2, [])
    assert "TDD" in stderr and "new" in stderr


def test_blocks_source_committed_after_last_pass(run, project):
    # Bash로 고치고 같은 턴에 커밋해도 마지막 통과 이후 바뀐 파일로 잡혀야 한다.
    run()
    (project / "src/lib/new.ts").write_text("export {};")
    git(project, "add", "-A")
    git(project, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "new")
    assert run()[0] == 2


def test_allows_source_with_sibling_test_and_deletions(run, project):
    (project / "src/lib/new.ts").write_text("export {};")
    (project / "src/lib/new.test.ts").write_text("test('new', () => {});")
    (project / "src/lib/calc.ts").unlink()
    (project / "src/lib/calc.test.ts").unlink()
    assert run()[0] == 0


def test_skips_projects_without_package_json(run, project):
    (project / "package.json").unlink()
    assert run() == (0, "", [])
