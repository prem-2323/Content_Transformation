"""
video/schemas.py
~~~~~~~~~~~~~~~~
Pydantic request / response models for the video generation pipeline.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Request ────────────────────────────────────────────────────────────────────

class VideoRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=20,
        max_length=8000,
        description="Source content to convert into a video.",
        examples=["Artificial intelligence is transforming modern cities..."],
    )
    language: str = Field(
        "English",
        description="Narration language (passed as context to Qwen).",
    )
    tone: str = Field(
        "Professional",
        description="Tone of the narration (e.g. Professional, Casual, Educational).",
    )
    audience: str = Field(
        "General public",
        description="Target audience (used to tailor Qwen's scene writing).",
    )
    voice: str = Field(
        "en-US-AriaNeural",
        description="Edge TTS voice for narration.",
    )
    width: int = Field(512, ge=256, le=1024, description="Scene image width in pixels.")
    height: int = Field(512, ge=256, le=1024, description="Scene image height in pixels.")
    steps: int = Field(20, ge=1, le=40, description="Stable Diffusion sampling steps.")


# ── Response ───────────────────────────────────────────────────────────────────

class SceneSummary(BaseModel):
    scene_number: int
    duration: float
    narration: str
    visual_prompt: str
    on_screen_text: str
    image_file: str
    audio_file: str


class VideoResponse(BaseModel):
    status: str = "success"
    message: str = "Video generated successfully"
    video_file: str = Field(description="Path to the final subtitled MP4.")
    subtitle_file: str = Field(description="Path to the .srt subtitle file.")
    scenes: int = Field(description="Total number of scenes generated.")
    duration: float = Field(description="Total video duration in seconds.")
    scene_details: Optional[List[SceneSummary]] = None
