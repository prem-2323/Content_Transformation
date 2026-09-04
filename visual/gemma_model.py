import base64
import io
import json
import httpx


class GemmaModel:
    system_prompt = """
You are a strict image analysis assistant.

You MUST follow the user's requested task.

TASK RULES:

1. If the user asks to EXTRACT TEXT:
    - Look only for visible written text.
    - Return ONLY the text that is clearly readable.
    - Do NOT describe the image.
    - Do NOT mention objects, people, colors, or scenery.
    - Do NOT guess missing or unclear text.
    - If no readable text exists, respond exactly:
      No clearly visible text.

2. If the user asks to IDENTIFY OBJECTS:
    - List only objects clearly visible.
    - Do not guess.

3. If the user asks for a DESCRIPTION:
    - Describe only clearly visible information.
    - Do not infer relationships, age, location, emotions, or intentions.

4. If the user asks for a SUMMARY:
    - Summarize only clearly visible information.

5. If the image contains a chart, diagram, document, screenshot, or poster:
    - Treat readable titles, labels, legends, axis labels, and values as visible text.
    - Treat chart bars, lines, points, tables, and other meaningful visual elements as objects.
    - Report these elements even when the requested task focuses on description or summary.

Always follow the requested task exactly.
Never answer a different task.

The requested task controls the emphasis of the description, but do not omit
clearly visible objects, text, or important details from the structured fields.

For every image request, return ONLY valid JSON with exactly these fields:
{
    "description": "A concise description using only visible information.",
    "objects": ["clearly visible object"],
    "visible_text": ["clearly readable text"],
    "important_details": ["clearly visible detail"]
}
Use empty arrays when no items are clearly visible. Do not use Markdown or code fences.
"""

    def __init__(self):
        self.model_name = "gemma3:4b"
        self.ollama_url = "http://localhost:11434/api/chat"

    async def analyze_image(self, image, prompt: str, task: str) -> dict:
        image_buffer = io.BytesIO()
        image.save(image_buffer, format="JPEG")
        image_bytes = image_buffer.getvalue()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": self.system_prompt
                },
                {
                    "role": "user",
                    "content": f"Requested task: {task}\nUser prompt: {prompt}",
                    "images": [
                        image_base64
                    ]
                }
            ],
            "stream": False
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self.ollama_url,
                json=payload
            )

        response.raise_for_status()
        result = response.json()

        content = result["message"]["content"].strip()

        if content.startswith("```"):
            content = content.removeprefix("```").removeprefix("json").removesuffix("```").strip()

        try:
            structured_result = json.loads(content)
        except json.JSONDecodeError as error:
            raise RuntimeError("Ollama returned invalid structured JSON.") from error

        if not isinstance(structured_result, dict):
            raise RuntimeError("Ollama returned structured data in an invalid format.")

        description = structured_result.get("description", "")
        if not isinstance(description, str):
            description = str(description)

        def string_list(field_name: str) -> list[str]:
            values = structured_result.get(field_name, [])
            if not isinstance(values, list):
                return []
            return [str(value) for value in values]

        task_result = {
            "description": description,
            "objects": string_list("objects"),
            "visible_text": string_list("visible_text"),
            "important_details": string_list("important_details")
        }

        return task_result
