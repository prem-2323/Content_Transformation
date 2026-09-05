from typing import Any, Dict, List, Union

from pydantic import BaseModel, Field

from .generator import DEFAULT_NEGATIVE_PROMPT


class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT
    width: int = Field(512, ge=256, le=1024)
    height: int = Field(512, ge=256, le=1024)
    steps: int = Field(20, ge=1, le=40)


class ImageResponse(BaseModel):
    status: str = "success"
    filename: str
    image_path: str


class SceneImageRequest(BaseModel):
    script: Union[Dict[str, Any], str]
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT
    width: int = Field(512, ge=256, le=1024)
    height: int = Field(512, ge=256, le=1024)
    steps: int = Field(20, ge=1, le=40)


class SceneImageResponse(BaseModel):
    status: str = "success"
    images: List[ImageResponse]
