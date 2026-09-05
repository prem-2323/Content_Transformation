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
