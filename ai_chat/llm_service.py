import json
import os
from typing import AsyncGenerator

import httpx


DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")
DEFAULT_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60.0"))
DEFAULT_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").replace("/api/generate", "")


class LocalLLM:
    """Async client for Ollama's local LLM API with resilient fallback."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        ollama_url: str = DEFAULT_URL,
        timeout_seconds: float = DEFAULT_TIMEOUT,
    ):
        self.model = model
        self.ollama_url = ollama_url
        self.timeout_seconds = timeout_seconds

    def _build_messages(
        self,
        messages: list[dict],
        system_prompt: str
    ) -> list[dict]:
        """Build the Ollama message list with system prompt."""

        ollama_messages = [
            {
                "role": "system",
                "content": system_prompt
            }
        ]

        last_user_index = max(
            (index for index, message in enumerate(messages) if message["role"] == "user"),
            default=-1,
        )

        for index, message in enumerate(messages):
            role = message["role"]
            if role not in ["user", "assistant", "system"]:
                continue
            content = message["content"]
            if role == "user" and index == last_user_index:
                content = f"{content}\n/no_think"
            ollama_messages.append({
                "role": role,
                "content": content
            })

        return ollama_messages

    async def generate(
        self,
        messages: list[dict],
        system_prompt: str
    ) -> str:
        """Non-streaming generation with fallback on timeout."""

        payload = {
            "model": self.model,
            "messages": self._build_messages(messages, system_prompt),
            "stream": False,
            "think": False,
            "keep_alive": "30m",
            "options": {
                "temperature": 0.3,
                "num_ctx": 2048,
                "num_predict": 1024
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/chat",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
            return data["message"]["content"]
        except (httpx.TimeoutException, httpx.HTTPError, Exception) as exc:
            # Fallback to direct prompt generation via text.qwen_service
            try:
                from text.qwen_service import generate_with_qwen
                user_msg = ""
                for m in reversed(messages):
                    if m.get("role") == "user":
                        user_msg = m.get("content", "")
                        break
                combined_prompt = f"{system_prompt}\n\nUser: {user_msg}"
                return generate_with_qwen(combined_prompt, timeout=self.timeout_seconds)
            except Exception:
                raise exc

    async def stream(
        self,
        messages: list[dict],
        system_prompt: str
    ) -> AsyncGenerator[str, None]:
        """Streaming generation — yields text chunks as they arrive."""

        payload = {
            "model": self.model,
            "messages": self._build_messages(messages, system_prompt),
            "stream": True,
            "think": False,
            "keep_alive": "30m",
            "options": {
                "temperature": 0.3,
                "num_ctx": 2048,
                "num_predict": 1024
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                async with client.stream(
                    "POST",
                    f"{self.ollama_url}/api/chat",
                    json=payload
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except (httpx.TimeoutException, httpx.HTTPError, Exception):
            # Fallback to non-streaming generate
            try:
                full_text = await self.generate(messages, system_prompt)
                yield full_text
            except Exception:
                yield "I encountered a timeout connecting to the local LLM. Please make sure Ollama is running (`ollama run qwen3:4b`)."

