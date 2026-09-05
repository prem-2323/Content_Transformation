"""
multimodal/job_store.py
-----------------------
In-memory job store for async PDF transformation jobs.

Each job tracks:
  - status   : queued → processing → completed | failed
  - progress : 0-100 integer
  - current_step : human-readable label shown to the client
  - result   : full result dict when status == "completed"
  - error    : error message when status == "failed"

The store lives for the lifetime of the server process.  To persist across
restarts, swap _JOB_STORE for a Redis/SQLite backend without changing any
caller code — the public API (create_job / get_job / update_job) stays the same.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional


# ---------------------------------------------------------------------------
# Job dataclass
# ---------------------------------------------------------------------------

JobStatus = Literal["queued", "processing", "completed", "failed"]


@dataclass
class Job:
    job_id: str
    status: JobStatus
    progress: int                   # 0-100
    current_step: str
    result: Optional[Dict[str, Any]] = None   # populated on completion
    error: Optional[str] = None               # populated on failure
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------

_JOB_STORE: Dict[str, Job] = {}


def create_job() -> Job:
    """Create a new job in the 'queued' state and register it in the store."""
    job = Job(
        job_id=str(uuid.uuid4()),
        status="queued",
        progress=0,
        current_step="queued",
    )
    _JOB_STORE[job.job_id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    """Return the Job for the given id, or None if not found."""
    return _JOB_STORE.get(job_id)


def update_job(
    job_id: str,
    *,
    status: Optional[JobStatus] = None,
    progress: Optional[int] = None,
    current_step: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    completed_at: Optional[datetime] = None,
) -> None:
    """
    Mutate fields on an existing job in-place.

    Only the keyword arguments you supply are changed; the rest stay the same.
    Raises KeyError if job_id is not in the store.
    """
    job = _JOB_STORE[job_id]
    if status is not None:
        job.status = status
    if progress is not None:
        job.progress = progress
    if current_step is not None:
        job.current_step = current_step
    if result is not None:
        job.result = result
    if error is not None:
        job.error = error
    if completed_at is not None:
        job.completed_at = completed_at
