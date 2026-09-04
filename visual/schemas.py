from pydantic import BaseModel
from typing import List
from enum import Enum


class VisualTask(str, Enum):
    description = "description"
    ocr = "ocr"
    objects = "objects"
    summary = "summary"


class VisualAnalysis(BaseModel):
    description: str
    objects: List[str]
    visible_text: List[str]
    important_details: List[str]


class VisualResponse(BaseModel):
    status: str
    message: str
    result: VisualAnalysis
