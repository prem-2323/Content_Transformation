from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class MultimodalResponse(BaseModel):
    filename: str
    output_type: str
    audience: str
    tone: str
    language: str
    detail_level: str
    objective: str
    extracted_text: str
    extracted_images_count: int
    text_analysis_qwen: str
    image_analysis_gemma: List[Dict[str, Any]]
    final_combined_output: str
