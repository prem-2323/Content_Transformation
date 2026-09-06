import json
from typing import AsyncGenerator

import httpx


class LocalLLM:
    """Async client for Ollama's local LLM API. No API keys required."""

    def __init__(
        self,
        model: str = "qwen3:4b",
        ollama_url: str = "http://localhost:11434",
        timeout_seconds: float = 25.0,
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
        """Non-streaming generation (kept for backward compat)."""

        payload = {
            "model": self.model,
            "messages": self._build_messages(messages, system_prompt),
            "stream": False,
            "think": False,
            "keep_alive": "30m",
            "options": {
                "temperature": 0.3,
                "num_ctx": 2048,
                "num_predict": 300
            }
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.ollama_url}/api/chat",
                json=payload
            )
            response.raise_for_status()
            data = response.json()

        return data["message"]["content"]

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
                "num_predict": 300
            }
        }

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
