from typing import Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)

    language: str = "English"
    tone: str = "Professional"
    detail_level: str = "Balanced"
    audience: str = "General"
    objective: str = "Inform"


class ChatResponse(BaseModel):
    reply: str
    intent: str
    model: str
