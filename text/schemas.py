from pydantic import BaseModel
from typing import Optional


class TextRequest(BaseModel):
    text: str
    output_type: str = "summary"
    audience: str = "General public"
    tone: str = "Professional"
    language: str = "English"
    detail_level: str = "Medium"
    objective: str = "Inform"


class TextResponse(BaseModel):
    output_type: str
    audience: str
    tone: str
    language: str
    detail_level: str
    objective: str
    generated_content: str


class FileTextResponse(TextResponse):
    filename: str
    extracted_text: str
