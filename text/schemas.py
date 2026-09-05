from pydantic import BaseModel, model_validator
from typing import Optional, Union, Dict, Any, List


class TextRequest(BaseModel):
    text: str
    output_type: Optional[str] = None
    output_types: Optional[List[str]] = None
    audience: str = "General public"
    tone: str = "Professional"
    language: str = "English"
    detail_level: str = "Medium"
    objective: str = "Inform"

    @model_validator(mode='after')
    def resolve_output_types(self):
        if not self.output_types:
            if self.output_type:
                self.output_types = [self.output_type]
            else:
                self.output_types = ["summary"]
        if not self.output_type and self.output_types:
            self.output_type = self.output_types[0]
        return self


class TextResponse(BaseModel):
    output_type: Optional[str] = None
    output_types: List[str]
    audience: str
    tone: str
    language: str
    detail_level: str
    objective: str
    outputs: Dict[str, Union[Dict[str, Any], str, Any]]
    generated_content: Optional[Union[Dict[str, Any], str, Any]] = None


class FileTextResponse(TextResponse):
    filename: str
    extracted_text: str
