"""
execute.py 리팩터링 안전망 테스트.
리팩터링 전후 동작이 동일한지 검증한다.
"""

import json
import os
import subprocess
import sys
import textwrap
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import execute as ex


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_project(tmp_path):
    """phases/, AGENTS.md, docs/ 를 갖춘 임시 프로젝트 구조."""
    phases_dir = tmp_path / "phases"
    phases_dir.mkdir()

    agents_md = tmp_path / "AGENTS.md"
    agents_md.write_text("# Rules\n- rule one\n- rule two")

    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "arch.md").write_text("# Architecture\nSome content")
    (docs_dir / "guide.md").write_text("# Guide\nAnother doc")

    return tmp_path


@pytest.fixture
def phase_dir(tmp_project):
    """step 3개를 가진 phase 디렉토리."""
    d = tmp_project / "phases" / "0-mvp"
    d.mkdir()

    index = {
        "project": "TestProject",
        "phase": "mvp",
        "steps": [
            {"step": 0, "name": "setup", "status": "completed", "summary": "프로젝트 초기화 완료"},
            {"step": 1, "name": "core", "status": "completed", "summary": "핵심 로직 구현"},
            {"step": 2, "name": "ui", "status": "pending"},
        ],
    }
    (d / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))
    (d / "step2.md").write_text("# Step 2: UI\n\nUI를 구현하세요.")

    return d


@pytest.fixture
def top_index(tmp_project):
    """phases/index.json (top-level)."""
    top = {
        "phases": [
            {"dir": "0-mvp", "status": "pending"},
            {"dir": "1-polish", "status": "pending"},
        ]
    }
    p = tmp_project / "phases" / "index.json"
    p.write_text(json.dumps(top, indent=2))
    return p


@pytest.fixture
def executor(tmp_project, phase_dir):
    """테스트용 StepExecutor 인스턴스. git 호출은 별도 mock 필요."""
    with patch.object(ex, "ROOT", tmp_project):
        inst = ex.StepExecutor("0-mvp")
    # 내부 경로를 tmp_project 기준으로 재설정
    inst._root = str(tmp_project)
    inst._phases_dir = tmp_project / "phases"
    inst._phase_dir = phase_dir
    inst._phase_dir_name = "0-mvp"
    inst._index_file = phase_dir / "index.json"
    inst._top_index_file = tmp_project / "phases" / "index.json"
    return inst


# ---------------------------------------------------------------------------
# _stamp (= 이전 now_iso)
# ---------------------------------------------------------------------------

class TestStamp:
    def test_returns_kst_timestamp(self, executor):
        result = executor._stamp()
        assert "+0900" in result

    def test_format_is_iso(self, executor):
        result = executor._stamp()
        dt = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert dt.tzinfo is not None

    def test_is_current_time(self, executor):
        before = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0)
        result = executor._stamp()
        after = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0) + timedelta(seconds=1)
        parsed = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert before <= parsed <= after


# ---------------------------------------------------------------------------
# _read_json / _write_json
# ---------------------------------------------------------------------------

class TestJsonHelpers:
    def test_roundtrip(self, tmp_path):
        data = {"key": "값", "nested": [1, 2, 3]}
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, data)
        loaded = ex.StepExecutor._read_json(p)
        assert loaded == data

    def test_save_ensures_ascii_false(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"한글": "테스트"})
        raw = p.read_text()
        assert "한글" in raw
        assert "\\u" not in raw

    def test_save_indented(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"a": 1})
        raw = p.read_text()
        assert "\n" in raw

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ex.StepExecutor._read_json(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# _load_guardrails
# ---------------------------------------------------------------------------

class TestLoadGuardrails:
    def test_loads_agents_md_and_docs(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "# Rules" in result
        assert "rule one" in result
        assert "# Architecture" in result
        assert "# Guide" in result

    def test_sections_separated_by_divider(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "---" in result

    def test_docs_sorted_alphabetically(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        arch_pos = result.index("arch")
        guide_pos = result.index("guide")
        assert arch_pos < guide_pos

    def test_no_agents_md(self, executor, tmp_project):
        (tmp_project / "AGENTS.md").unlink()
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "AGENTS.md" not in result
        assert "Architecture" in result

    def test_no_docs_dir(self, executor, tmp_project):
        import shutil
        shutil.rmtree(tmp_project / "docs")
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "Rules" in result
        assert "Architecture" not in result

    def test_empty_project(self, tmp_path):
        with patch.object(ex, "ROOT", tmp_path):
            # executor가 필요 없는 static-like 동작이므로 임시 인스턴스
            phases_dir = tmp_path / "phases" / "dummy"
            phases_dir.mkdir(parents=True)
            idx = {"project": "T", "phase": "t", "steps": []}
            (phases_dir / "index.json").write_text(json.dumps(idx))
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
            result = inst._load_guardrails()
        assert result == ""


# ---------------------------------------------------------------------------
# _build_step_context
# ---------------------------------------------------------------------------

class TestBuildStepContext:
    def test_includes_completed_with_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert "Step 0 (setup): 프로젝트 초기화 완료" in result
        assert "Step 1 (core): 핵심 로직 구현" in result

    def test_excludes_pending(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert "ui" not in result

    def test_excludes_completed_without_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        del index["steps"][0]["summary"]
        result = ex.StepExecutor._build_step_context(index)
        assert "setup" not in result
        assert "core" in result

    def test_empty_when_no_completed(self):
        index = {"steps": [{"step": 0, "name": "a", "status": "pending"}]}
        result = ex.StepExecutor._build_step_context(index)
        assert result == ""

    def test_has_header(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert result.startswith("## 이전 Step 산출물")


# ---------------------------------------------------------------------------
# _build_preamble
# ---------------------------------------------------------------------------

class TestBuildPreamble:
    def test_includes_project_name(self, executor):
        result = executor._build_preamble("", "")
        assert "TestProject" in result

    def test_includes_guardrails(self, executor):
        result = executor._build_preamble("GUARD_CONTENT", "")
        assert "GUARD_CONTENT" in result

    def test_includes_step_context(self, executor):
        ctx = "## 이전 Step 산출물\n\n- Step 0: done"
        result = executor._build_preamble("", ctx)
        assert "이전 Step 산출물" in result

    def test_leaves_committing_to_executor(self, executor):
        result = executor._build_preamble("", "")
        assert "직접 커밋하지 마라" in result

    def test_includes_rules(self, executor):
        result = executor._build_preamble("", "")
        assert "작업 규칙" in result
        assert "AC" in result

    def test_no_retry_section_by_default(self, executor):
        result = executor._build_preamble("", "")
        assert "이전 시도 실패" not in result

    def test_retry_section_with_prev_error(self, executor):
        result = executor._build_preamble("", "", prev_error="타입 에러 발생")
        assert "이전 시도 실패" in result
        assert "타입 에러 발생" in result

    def test_includes_max_retries(self, executor):
        result = executor._build_preamble("", "")
        assert str(ex.StepExecutor.MAX_RETRIES) in result

    def test_includes_index_path(self, executor):
        result = executor._build_preamble("", "")
        assert "/phases/0-mvp/index.json" in result


# ---------------------------------------------------------------------------
# _update_top_index
# ---------------------------------------------------------------------------

class TestUpdateTopIndex:
    def test_completed(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"
        assert "completed_at" in mvp

    def test_error(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("error")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "error"
        assert "failed_at" in mvp

    def test_blocked(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("blocked")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "blocked"
        assert "blocked_at" in mvp

    def test_other_phases_unchanged(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        polish = next(p for p in data["phases"] if p["dir"] == "1-polish")
        assert polish["status"] == "pending"

    def test_nonexistent_dir_is_noop(self, executor, top_index):
        executor._top_index_file = top_index
        executor._phase_dir_name = "no-such-dir"
        original = json.loads(top_index.read_text())
        executor._update_top_index("completed")
        after = json.loads(top_index.read_text())
        for p_before, p_after in zip(original["phases"], after["phases"]):
            assert p_before["status"] == p_after["status"]

    def test_no_top_index_file(self, executor, tmp_path):
        executor._top_index_file = tmp_path / "nonexistent.json"
        executor._update_top_index("completed")  # should not raise


# ---------------------------------------------------------------------------
# _checkout_branch (mocked)
# ---------------------------------------------------------------------------

class TestCheckoutBranch:
    def _mock_git(self, executor, responses):
        call_idx = {"i": 0}
        def fake_git(*args):
            idx = call_idx["i"]
            call_idx["i"] += 1
            if idx < len(responses):
                return responses[idx]
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

    def test_already_on_branch(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="feat-mvp\n", stderr=""),
        ])
        executor._checkout_branch()  # should return without checkout

    def test_branch_exists_checkout(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_branch_not_exists_create(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="not found"),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_checkout_fails_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="dirty tree"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1

    def test_no_git_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=1, stdout="", stderr="not a git repo"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _commit_step (mocked)
# ---------------------------------------------------------------------------

class TestCommitStep:
    def test_commit_failure_stops_without_housekeeping_commit(self, executor):
        def fake_git(*args):
            if args[0] == "commit" or args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1, stderr="commit failed")
            return MagicMock(returncode=0, stdout="", stderr="")

        with patch.object(executor, "_run_git", side_effect=fake_git) as git:
            with pytest.raises(SystemExit) as error:
                executor._commit_step(2, "ui")
        assert error.value.code == 1
        assert len([call for call in git.call_args_list if call.args[0] == "commit"]) == 1

    def test_two_phase_commit(self, executor):
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_calls = [c for c in calls if c[0] == "commit"]
        assert len(commit_calls) == 2
        assert "feat(mvp):" in commit_calls[0][2]
        assert "chore(mvp):" in commit_calls[1][2]

    def test_no_code_changes_skips_feat_commit(self, executor):
        call_count = {"diff": 0}
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                call_count["diff"] += 1
                if call_count["diff"] == 1:
                    return MagicMock(returncode=0)
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_msgs = [c[2] for c in calls if c[0] == "commit"]
        assert len(commit_msgs) == 1
        assert "chore" in commit_msgs[0]


# ---------------------------------------------------------------------------
# _invoke_codex (mocked)
# ---------------------------------------------------------------------------

class TestInvokeCodex:
    def test_invokes_codex_with_correct_args(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"type": "turn.completed"}', stderr="")
        step = {"step": 2, "name": "ui"}
        preamble = "PREAMBLE\n"

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            output = executor._invoke_codex(step, preamble)

        cmd = mock_run.call_args[0][0]
        assert cmd[:2] == ["codex", "exec"]
        assert "--dangerously-bypass-approvals-and-sandbox" in cmd
        # 훅은 /hooks로 신뢰한 것만 돌린다. 신뢰 우회는 신뢰하지 않은 플러그인 훅까지 실행한다.
        assert "--dangerously-bypass-hook-trust" not in cmd
        assert "--json" in cmd
        # 프롬프트는 인자 길이 제한을 피하려고 stdin으로 넘긴다.
        assert cmd[-1] == "-"
        prompt = mock_run.call_args[1]["input"]
        assert "PREAMBLE" in prompt
        assert "UI를 구현하세요" in prompt

    def test_saves_output_json(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"ok": true}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result):
            executor._invoke_codex(step, "preamble")

        output_file = executor._phase_dir / "step2-output.json"
        assert output_file.exists()
        data = json.loads(output_file.read_text())
        assert data["step"] == 2
        assert data["name"] == "ui"
        assert data["exitCode"] == 0

    def test_nonexistent_step_file_exits(self, executor):
        step = {"step": 99, "name": "nonexistent"}
        with pytest.raises(SystemExit) as exc_info:
            executor._invoke_codex(step, "preamble")
        assert exc_info.value.code == 1

    def test_timeout_is_1800(self, executor):
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_codex(step, "preamble")

        assert mock_run.call_args[1]["timeout"] == 1800


# ---------------------------------------------------------------------------
# progress_indicator (= 이전 Spinner)
# ---------------------------------------------------------------------------

class TestProgressIndicator:
    def test_context_manager(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.15)
        assert pi.elapsed >= 0.1

    def test_elapsed_increases(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.2)
        assert pi.elapsed > 0


# ---------------------------------------------------------------------------
# main() CLI 파싱 (mocked)
# ---------------------------------------------------------------------------

class TestMainCli:
    def test_no_args_exits(self):
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2  # argparse exits with 2

    def test_invalid_phase_dir_exits(self):
        with patch("sys.argv", ["execute.py", "nonexistent"]):
            with patch.object(ex, "ROOT", Path("/tmp/fake_nonexistent")):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_missing_index_exits(self, tmp_project):
        (tmp_project / "phases" / "empty").mkdir()
        with patch("sys.argv", ["execute.py", "empty"]):
            with patch.object(ex, "ROOT", tmp_project):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _check_blockers (= 이전 main() error/blocked 체크)
# ---------------------------------------------------------------------------

class TestCheckBlockers:
    def _make_executor_with_steps(self, tmp_project, steps):
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        return inst

    def test_error_step_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "bad", "status": "error", "error_message": "fail"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 1

    def test_blocked_step_exits_2(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "stuck", "status": "blocked", "blocked_reason": "API key"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 2

    @pytest.mark.parametrize("status,code", [("error", 1), ("blocked", 2)])
    def test_checks_before_completed_steps(self, tmp_project, status, code):
        steps = [
            {"step": 0, "name": "stuck", "status": status},
            {"step": 1, "name": "done", "status": "completed"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as error:
            inst._check_blockers()
        assert error.value.code == code


class TestExecutionFailures:
    def test_failed_process_cannot_complete_step(self, executor):
        def invoke(step, preamble):
            data = executor._read_json(executor._index_file)
            data["steps"][2].update(status="completed", summary="unverified", completed_at="stale")
            executor._write_json(executor._index_file, data)
            return {"exitCode": 1, "stdout": "", "stderr": "process failed"}

        with patch.object(executor, "_invoke_codex", side_effect=invoke) as call, \
                patch.object(executor, "_commit_step"):
            with pytest.raises(SystemExit) as error:
                executor._execute_single_step({"step": 2, "name": "ui"}, "")
        assert error.value.code == 1
        assert call.call_count == executor.MAX_RETRIES
        step = executor._read_json(executor._index_file)["steps"][2]
        assert step["status"] == "error"
        assert "process failed" in step["error_message"]
        assert "completed_at" not in step
        assert "summary" not in step
        assert "process failed" in call.call_args_list[1].args[1]

    def test_successful_process_completes_step(self, executor):
        def invoke(step, preamble):
            data = executor._read_json(executor._index_file)
            data["steps"][2].update(status="completed", summary="UI done")
            executor._write_json(executor._index_file, data)
            return {"exitCode": 0, "stdout": "{}", "stderr": ""}

        with patch.object(executor, "_invoke_codex", side_effect=invoke), \
                patch.object(executor, "_commit_step") as commit:
            assert executor._execute_single_step({"step": 2, "name": "ui"}, "")
        commit.assert_called_once_with(2, "ui")
        assert "completed_at" in executor._read_json(executor._index_file)["steps"][2]

    @pytest.mark.parametrize("exception,code", [
        (subprocess.TimeoutExpired("codex", 1800, output=b"partial output"), 124),
        (FileNotFoundError("codex not found"), 127),
    ])
    def test_process_exception_retries_and_records_failure(self, executor, exception, code):
        with patch("subprocess.run", side_effect=exception) as run, \
                patch.object(executor, "_commit_step"):
            with pytest.raises(SystemExit) as error:
                executor._execute_single_step({"step": 2, "name": "ui"}, "")
        assert error.value.code == 1
        assert run.call_count == executor.MAX_RETRIES
        step = executor._read_json(executor._index_file)["steps"][2]
        assert step["status"] == "error"
        assert "failed_at" in step
        output = executor._read_json(executor._phase_dir / "step2-output.json")
        assert output["exitCode"] == code
        assert output["stderr"]
        if code == 124:
            assert output["stdout"] == "partial output"

    @pytest.mark.parametrize("status", ["pending", "error", "blocked", "unknown"])
    def test_finalize_rejects_incomplete_phase(self, executor, status):
        data = executor._read_json(executor._index_file)
        data["steps"][2]["status"] = status
        executor._write_json(executor._index_file, data)
        with patch.object(executor, "_run_git") as git:
            with pytest.raises(SystemExit):
                executor._finalize()
        git.assert_not_called()
        assert "completed_at" not in executor._read_json(executor._index_file)

    def test_failed_step_prevents_later_pending_step(self, executor):
        data = executor._read_json(executor._index_file)
        data["steps"][0]["status"] = "error"
        executor._write_json(executor._index_file, data)
        with patch.object(executor, "_invoke_codex") as invoke:
            with pytest.raises(SystemExit):
                executor._execute_all_steps("")
        invoke.assert_not_called()


@pytest.fixture
def git_executor(executor, top_index, monkeypatch):
    """사용자 Git 설정/훅의 영향을 받지 않는 격리된 실제 저장소."""
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    for args in [
        ("init", "-q"), ("config", "user.name", "Harness test"),
        ("config", "user.email", "test@example.invalid"),
        ("config", "core.hooksPath", os.devnull),
        ("add", "-A"), ("commit", "-qm", "baseline"),
    ]:
        result = executor._run_git(*args)
        assert result.returncode == 0, result.stderr
    return executor


class TestGitProtection:
    @pytest.mark.parametrize("kind", ["tracked", "untracked", "staged"])
    def test_existing_user_changes_stop_before_checkout(self, git_executor, kind):
        executor = git_executor
        path = Path(executor._root) / ("AGENTS.md" if kind == "tracked" else "user-notes.txt")
        path.write_text("user work")
        if kind == "staged":
            executor._run_git("add", "--", "user-notes.txt")
        before = executor._run_git("status", "--porcelain").stdout
        with patch.object(executor, "_checkout_branch") as checkout, \
                patch.object(executor, "_execute_all_steps") as execute, \
                patch.object(executor, "_finalize"):
            with pytest.raises(SystemExit):
                executor.run()
        checkout.assert_not_called()
        execute.assert_not_called()
        assert executor._run_git("status", "--porcelain").stdout == before
        assert path.read_text() == "user work"

    def test_clean_project_runs_and_splits_code_metadata_commits(self, git_executor):
        executor = git_executor

        def invoke(step, preamble):
            (Path(executor._root) / "ui.ts").write_text("export const ui = true;")
            data = executor._read_json(executor._index_file)
            data["steps"][2].update(status="completed", summary="UI done")
            executor._write_json(executor._index_file, data)
            return {"exitCode": 0, "stdout": "{}", "stderr": ""}

        with patch.object(executor, "_invoke_codex", side_effect=invoke):
            executor.run()
        assert executor._run_git("status", "--porcelain").stdout == ""
        files = executor._run_git("show", "--pretty=format:", "--name-only", "HEAD~2").stdout.splitlines()
        assert "ui.ts" in files
        assert "phases/0-mvp/index.json" not in files

    def test_finalize_stages_only_phase_metadata(self, git_executor):
        executor = git_executor
        data = executor._read_json(executor._index_file)
        data["steps"][2]["status"] = "completed"
        executor._write_json(executor._index_file, data)
        (Path(executor._root) / "user-notes.txt").write_text("concurrent user work")
        executor._finalize()
        files = executor._run_git("show", "--pretty=format:", "--name-only", "HEAD").stdout.splitlines()
        assert set(files) == {"phases/0-mvp/index.json", "phases/index.json"}
        assert "?? user-notes.txt" in executor._run_git("status", "--porcelain").stdout
