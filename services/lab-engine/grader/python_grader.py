"""
Python Code Grader

Runs student-submitted Python code in an isolated subprocess with a timeout,
captures stdout/stderr, and compares against expected output criteria.

Security controls:
- Process runs in its own process group (start_new_session=True)
- Resource limits: 256 MB memory, 32 child processes (Linux only)
- Output truncated to 10 KB to prevent memory exhaustion
- Entire process group killed on timeout to prevent orphaned children
- Temp file paths stripped from error output
"""

import logging
import os
import signal
import subprocess
import sys
import tempfile
from typing import TypedDict

logger = logging.getLogger(__name__)

# Maximum bytes of stdout/stderr returned to the client
MAX_OUTPUT_CHARS = 10_000


def _set_resource_limits() -> None:
    """Apply OS-level resource limits to the subprocess (Linux only)."""
    try:
        import resource

        # 256 MB virtual memory
        mem_limit = 256 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem_limit, mem_limit))
        # Max 32 child processes (prevents fork bombs)
        resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))
    except (ImportError, ValueError, OSError):
        # resource module unavailable (non-Linux) or limits unsupported
        pass


class GradeResult(TypedDict):
    passed: bool
    output: str
    errors: str
    score: float


def grade_submission(
    code: str,
    expected_output_contains: str = "",
    timeout: int = 10,
) -> GradeResult:
    """
    Grade a Python code submission.

    Args:
        code: The student's Python source code.
        expected_output_contains: A substring that must appear in stdout
            for the submission to pass. If empty, any non-error execution passes.
        timeout: Maximum execution time in seconds.

    Returns:
        dict with keys: passed (bool), output (str), errors (str), score (float)
    """
    result: GradeResult = {
        "passed": False,
        "output": "",
        "errors": "",
        "score": 0.0,
    }

    # ------------------------------------------------------------------
    # Write code to a temporary file so we can run it in a subprocess.
    # ------------------------------------------------------------------
    tmp_fd = None
    tmp_path = None
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".py", prefix="studylab_grade_")
        with os.fdopen(tmp_fd, "w") as tmp_file:
            tmp_file.write(code)
        tmp_fd = None  # os.fdopen closed the fd

        # ------------------------------------------------------------------
        # Execute in a subprocess with resource limits.
        # start_new_session=True creates a new process group so we can
        # kill the entire tree (child + any grandchildren) on timeout.
        # ------------------------------------------------------------------
        proc = subprocess.Popen(
            [sys.executable, "-u", tmp_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
            preexec_fn=_set_resource_limits,
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONPATH": "",
                "HOME": "/tmp",
                "LANG": "en_US.UTF-8",
            },
        )

        try:
            stdout, stderr = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            # Kill the entire process group to prevent orphaned children
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (OSError, ProcessLookupError):
                proc.kill()
            proc.wait()
            result["errors"] = (
                f"Execution timed out after {timeout} seconds. "
                "Check for infinite loops or blocking I/O."
            )
            result["passed"] = False
            result["score"] = 0.0
            return result

        # Truncate output to prevent memory exhaustion
        raw_output = stdout.strip()[:MAX_OUTPUT_CHARS]
        raw_errors = stderr.strip()[:MAX_OUTPUT_CHARS]

        # Strip internal temp file paths from error output (SEC-11)
        if tmp_path:
            raw_errors = raw_errors.replace(tmp_path, "<student_code>")

        result["output"] = raw_output
        result["errors"] = raw_errors

        # ------------------------------------------------------------------
        # Evaluate pass/fail
        # ------------------------------------------------------------------
        if proc.returncode != 0:
            # Code raised an unhandled exception
            result["passed"] = False
            result["score"] = 0.0
        elif expected_output_contains:
            if expected_output_contains.lower() in result["output"].lower():
                result["passed"] = True
                result["score"] = 1.0
            else:
                result["passed"] = False
                result["score"] = 0.25  # partial credit for running without errors
        else:
            # No specific expected output -- just needs to run cleanly
            result["passed"] = True
            result["score"] = 1.0

    except Exception as exc:
        logger.exception("Grader internal error")
        result["errors"] = "An internal grading error occurred. Please try again."
        result["passed"] = False
        result["score"] = 0.0

    finally:
        # Clean up the temp file
        if tmp_fd is not None:
            try:
                os.close(tmp_fd)
            except OSError:
                pass
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return result
