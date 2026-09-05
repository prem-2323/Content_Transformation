import asyncio
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from .job_store import create_job, get_job, update_job
from .schemas import JobSubmittedResponse, JobStatusResponse, MultimodalResponse
from .extractor import extract_pdf_text_and_images
from .service import process_multimodal_content
from text.qwen_service import QwenServiceError
from text.routes import resolve_form_output_types
from validation import validate_output_types

router = APIRouter(
    prefix="/multimodal",
    tags=["Multimodal Transformation"]
)


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

async def _run_job(
    job_id: str,
    filename: str,
    pdf_bytes: bytes,
    output_types: list[str],
    audience: str,
    tone: str,
    language: str,
    detail_level: str,
    objective: str,
) -> None:
    """
    Coroutine executed as a background asyncio task.

    Runs the full multimodal pipeline and writes progress + results back into
    the job store so the status endpoint can serve live updates.
    """

    def _cb(progress: int, step: str) -> None:
        """Write a progress tick into the job store."""
        update_job(job_id, status="processing", progress=progress, current_step=step)

    try:
        update_job(job_id, status="processing", progress=5, current_step="extracting_pdf")

        # Re-create a file-like object from the pre-read bytes
        pdf_stream = io.BytesIO(pdf_bytes)

        # Wrap bytes in a minimal duck-typed object that extractor expects
        class _FakeUpload:
            file = pdf_stream

        text, images = extract_pdf_text_and_images(_FakeUpload())

        if not text.strip() and not images:
            update_job(
                job_id,
                status="failed",
                progress=0,
                current_step="failed",
                error="Uploaded PDF contains neither readable text nor embedded images.",
                completed_at=datetime.now(timezone.utc),
            )
            return

        results = await process_multimodal_content(
            text=text,
            images=images,
            output_types=output_types,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective,
            progress_callback=_cb,
        )

        first_type = output_types[0]

        result_payload = MultimodalResponse(
            filename=filename,
            output_type=first_type,
            output_types=output_types,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective,
            extracted_text=text,
            extracted_images_count=len(images),
            text_analysis_qwen=results["text_analysis_qwen"],
            image_analysis_gemma=results["image_analysis_gemma"],
            outputs=results["outputs"],
            final_combined_output=results["final_combined_output"],
        )

        update_job(
            job_id,
            status="completed",
            progress=100,
            current_step="completed",
            result=result_payload.model_dump(),
            completed_at=datetime.now(timezone.utc),
        )

    except QwenServiceError as err:
        update_job(
            job_id,
            status="failed",
            progress=0,
            current_step="failed",
            error=f"Qwen service error: {err}",
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as err:
        update_job(
            job_id,
            status="failed",
            progress=0,
            current_step="failed",
            error=f"Multimodal transformation failed: {err}",
            completed_at=datetime.now(timezone.utc),
        )


# ---------------------------------------------------------------------------
# POST /multimodal/transform-pdf  — submit job, return immediately
# ---------------------------------------------------------------------------

@router.post("/transform-pdf", response_model=JobSubmittedResponse)
async def transform_multimodal_pdf(
    file: UploadFile = File(..., description="PDF document containing text and/or embedded images"),
    output_type: Optional[str] = Form(None, description="Target output type (legacy single selection)"),
    output_types: Optional[str] = Form(None, description="Comma-separated or JSON list of target output types"),
    audience: str = Form("General public"),
    tone: str = Form("Professional"),
    language: str = Form("English"),
    detail_level: str = Form("Medium"),
    objective: str = Form("Inform"),
):
    """
    Accept a PDF for multimodal transformation and return a job handle immediately.

    The heavy work (Gemma image analysis + Qwen synthesis) runs in the background.
    Poll **GET /multimodal/status/{job_id}** to track progress and retrieve the
    final result when ``status == "completed"``.
    """
    # --- Validation (same rules as before) ---
    raw_types = resolve_form_output_types(output_type, output_types)
    target_types = validate_output_types(raw_types)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported by /multimodal/transform-pdf.",
        )

    # --- Read file bytes NOW while the upload is still alive ---
    # The UploadFile object becomes invalid after the request returns, so we
    # read the raw bytes synchronously before firing the background task.
    file.file.seek(0)
    pdf_bytes = file.file.read()

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # --- Create job and launch background coroutine ---
    job = create_job()

    asyncio.create_task(
        _run_job(
            job_id=job.job_id,
            filename=file.filename,
            pdf_bytes=pdf_bytes,
            output_types=target_types,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective,
        )
    )

    return JobSubmittedResponse(job_id=job.job_id, status=job.status)


# ---------------------------------------------------------------------------
# GET /multimodal/status/{job_id}  — poll job progress / result
# ---------------------------------------------------------------------------

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Poll the status of a PDF transformation job.

    Possible ``status`` values:
    - **queued** — job accepted, not yet started
    - **processing** — pipeline is running; ``progress`` and ``current_step`` update live
    - **completed** — pipeline finished; full ``result`` is embedded in the response
    - **failed** — pipeline errored; ``error`` field contains the reason
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    result_model = MultimodalResponse(**job.result) if job.result else None

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        current_step=job.current_step,
        result=result_model,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )
