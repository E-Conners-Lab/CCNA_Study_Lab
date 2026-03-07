"""
CCNA StudyLab - Lab Engine
FastAPI service providing exercise grading for CCNA certification study.
"""

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from grader.python_grader import grade_submission
from grader.ios_grader import grade_ios_commands
from grader.subnet_grader import grade_subnetting
from grader.config_grader import grade_config_review
from grader.acl_grader import grade_acl

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CCNA StudyLab - Lab Engine",
    description="Exercise grading for CCNA 200-301 certification study",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "lab-engine",
        "version": "1.0.0",
        "lab_types": ["ios-cli", "subnetting", "config-review", "python", "acl-builder"],
    }


# ---------------------------------------------------------------------------
# Grade router
# ---------------------------------------------------------------------------

grade_router = APIRouter(prefix="/api/v1/grade", tags=["grading"])


class GradeRequest(BaseModel):
    exercise_id: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., max_length=100_000)
    lab_type: str = "python"
    expected: Optional[dict] = None


class GradeResponse(BaseModel):
    passed: bool
    output: str
    errors: str
    score: float
    exercise_id: str
    feedback: Optional[str] = None


@grade_router.post("", response_model=GradeResponse)
async def grade(request: GradeRequest):
    result = {"passed": False, "output": "", "errors": "", "score": 0.0}

    if request.lab_type == "ios-cli":
        result = grade_ios_commands(
            code=request.code,
            expected=request.expected or {},
        )
    elif request.lab_type == "subnetting":
        result = grade_subnetting(
            code=request.code,
            expected=request.expected or {},
        )
    elif request.lab_type == "config-review":
        result = grade_config_review(
            code=request.code,
            expected=request.expected or {},
        )
    elif request.lab_type == "acl-builder":
        result = grade_acl(
            code=request.code,
            expected=request.expected or {},
        )
    elif request.lab_type == "python":
        expected_contains = ""
        if request.expected and "output_contains" in request.expected:
            expected_contains = request.expected["output_contains"]
        result = grade_submission(
            code=request.code,
            expected_output_contains=expected_contains,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown lab type: {request.lab_type}")

    feedback = None
    if result["passed"]:
        feedback = "Great work! Your solution is correct."
    elif result["errors"]:
        feedback = "There are errors in your submission. Check the output for details."
    else:
        feedback = "Your submission doesn't match the expected result. Review and try again."

    return GradeResponse(
        passed=result["passed"],
        output=result["output"],
        errors=result["errors"],
        score=result["score"],
        exercise_id=request.exercise_id,
        feedback=feedback,
    )


# ---------------------------------------------------------------------------
# Sandbox router
# ---------------------------------------------------------------------------

sandbox_router = APIRouter(prefix="/api/v1/sandbox", tags=["sandbox"])


class SandboxRunRequest(BaseModel):
    code: str = Field(..., max_length=100_000)
    language: str = "python"
    timeout: int = Field(default=10, ge=1, le=30)


class SandboxRunResponse(BaseModel):
    output: str
    errors: str
    exit_code: int


@sandbox_router.post("/run", response_model=SandboxRunResponse)
async def sandbox_run(request: SandboxRunRequest):
    """Execute arbitrary code in a sandboxed subprocess (for practice)."""
    result = grade_submission(
        code=request.code,
        expected_output_contains="",
        timeout=request.timeout,
    )
    return SandboxRunResponse(
        output=result["output"],
        errors=result["errors"],
        exit_code=0 if not result["errors"] else 1,
    )


# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------

app.include_router(grade_router)
app.include_router(sandbox_router)
