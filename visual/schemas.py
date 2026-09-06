from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
from enum import Enum


class VisualTask(str, Enum):
    description = "description"
    ocr = "ocr"
    objects = "objects"
    summary = "summary"
    caption = "caption"
    qa = "qa"
    chart = "chart"
    scene = "scene"


class EvidenceItem(BaseModel):
    type: str = Field(..., description="Evidence type: visual or ocr")
    observation: str = Field(..., description="Visually verified observation statement")


class VisualResponse(BaseModel):
    success: bool = True
    task: str
    result: Dict[str, Any]
    evidence: List[EvidenceItem] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    status: str = "success"
    message: str = "Image analyzed successfully."

