from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union


class MultimodalResponse(BaseModel):
    filename: str
    output_type: Optional[str] = None
    output_types: List[str]
    audience: str
    tone: str
    language: str
    detail_level: str
    objective: str
    extracted_text: str
    extracted_images_count: int
    text_analysis_qwen: str
    image_analysis_gemma: List[Dict[str, Any]]
    outputs: Dict[str, Union[Dict[str, Any], str, Any]]
    final_combined_output: Optional[Union[Dict[str, Any], str, Any]] = None


# ---------------------------------------------------------------------------
# Job / status schemas — used by the async transform-pdf pipeline
# ---------------------------------------------------------------------------

class JobSubmittedResponse(BaseModel):
    """Returned immediately when a PDF transformation job is accepted."""
    job_id: str
    status: str   # always "queued" at submission time


class JobStatusResponse(BaseModel):
    """Returned by GET /multimodal/status/{job_id}."""
    job_id: str
    status: str                               # queued | processing | completed | failed
    progress: int                             # 0-100
    current_step: str
    result: Optional[MultimodalResponse] = None   # populated when status == "completed"
    error: Optional[str] = None                   # populated when status == "failed"
    created_at: datetime
    completed_at: Optional[datetime] = None
