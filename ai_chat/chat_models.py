from typing import Literal, Optional, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: str = ""

    language: str = "English"
    tone: str = "Professional"
    detail_level: str = "Balanced"
    audience: str = "General"
    objective: str = "Inform"


class ChatResponse(BaseModel):
    reply: str
    intent: str
    model: str


# ---------------------------------------------------------------------------
# Smart Action — unified endpoint that detects intent and calls platform APIs
# ---------------------------------------------------------------------------


class SmartActionRequest(BaseModel):
    """Request to the /api/ai/smart-action endpoint."""
    messages: list[ChatMessage] = Field(default_factory=list)
    context: str = ""
    language: str = "English"
    tone: str = "Professional"
    audience: str = "General"
    objective: str = "Inform"
    detail_level: str = "Balanced"


class SmartActionResponse(BaseModel):
    """Structured response from /api/ai/smart-action."""
    action: str  # e.g. "chat", "transform", "image", "video_plan", "audio", etc.
    intent: str  # detected intent label
    text: str  # human-readable reply text
    data: Optional[Any] = None  # action-specific payload (image url, transform results, etc.)
    download_url: Optional[str] = None  # direct download link if applicable
    media_type: Optional[str] = None  # "image", "audio", "video", "document", None
    model: str = "platform"  # which model / service was used
