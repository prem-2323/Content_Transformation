"""
video/scene_generator.py
~~~~~~~~~~~~~~~~~~~~~~~~
Uses Qwen3 (via Ollama) to convert source text into a structured JSON
video scene plan.

Key improvements over v1:
  - Ultra-strict prompt: no explanations, no markdown, JSON only.
  - Robust JSON extraction: strips <think> tags, fences, leading text.
  - Full scene validation with clear error messages.
"""

import json
import re

import requests

from text.qwen_service import QwenServiceError


# ── Ollama config (mirrors qwen_service.py but with higher token limit) ────────

OLLAMA_URL            = "http://localhost:11434/api/generate"
MODEL_NAME            = "qwen3:4b"
REQUEST_TIMEOUT_SECS  = 240   # scenes need more tokens than a regular transform
DEFAULT_SCENE_COUNT   = 6


# ── Ultra-strict prompt ────────────────────────────────────────────────────────

SCENE_PROMPT_TEMPLATE = """\
You are a video scene planner.

Return ONLY a valid JSON object.
Do not write explanations.
Do not write reasoning.
Do not use markdown.
Do not use ```json.
Do not write anything before or after the JSON.

Create exactly {scene_count} scenes.
You MUST generate exactly {scene_count} scenes. Do not generate 3, 4, 5, 7, or 8 scenes.

Use this narrative structure:
- Scene 1: Introduction
- Scene 2: First key point
- Scene 3: Second key point
- Scene 4: Third key point
- Scene 5: Impact or real-world example
- Scene 6: Conclusion

Each scene must contain:
- scene_number: integer starting at 1
- duration: integer between 4 and 8
- narration: 1-2 sentences, maximum 30 words
- visual_prompt: one clear visual subject, environment, action, camera composition, and lighting; use photorealistic cinematic language, avoid abstract concepts, unrelated events, and readable image text
- on_screen_text: maximum 8 words, punchy headline

For every visual_prompt:
- Describe one clear visual scene directly understandable from the image alone.
- Specify the main subject, environment, action, camera composition, and lighting.
- Do not request readable text inside the generated image.

Required JSON structure (output this and nothing else):

{{
  "title": "Video title here",
  "scenes": [
    {{
      "scene_number": 1,
      "duration": 5,
      "narration": "Narration text here.",
      "visual_prompt": "Cinematic detailed visual description for image generation.",
      "on_screen_text": "Short punchy headline"
    }}
  ]
}}

SOURCE CONTENT:
Language: {language}
Tone: {tone}
Audience: {audience}

{content}"""

# Required keys that every scene dict must contain
REQUIRED_SCENE_FIELDS = [
    "scene_number",
    "duration",
    "narration",
    "visual_prompt",
    "on_screen_text",
]


# ── JSON extraction ────────────────────────────────────────────────────────────

def _extract_json_object(raw: str) -> dict:
    """Robustly extract a JSON object from Qwen's raw output.

    Handles:
      - <think>...</think> tags (Qwen3 extended thinking)
      - Markdown code fences (```json ... ```)
      - Leading / trailing prose before / after the JSON block
    """
    # 1. Strip <think>...</think> blocks
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    # 2. Strip markdown code fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"\s*```$",           "", raw, flags=re.IGNORECASE).strip()

    # 3. Try direct parse first (ideal case — Qwen obeyed the prompt)
    try:
        result = json.loads(raw)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # 4. Find the outermost {...} block (handles leading prose)
    start = raw.find("{")
    end   = raw.rfind("}")

    if start != -1 and end != -1 and end > start:
        candidate = raw[start : end + 1]
        try:
            result = json.loads(candidate)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"Qwen did not return a valid JSON object.\n"
        f"Raw output (first 600 chars):\n{raw[:600]}"
    )


# ── Scene validation ───────────────────────────────────────────────────────────

def _validate_scenes(data: dict) -> dict:
    """Validate and normalise the parsed scene plan dict.

    Raises ValueError with a clear message on any problem.
    Returns the (possibly normalised) dict on success.
    """
    if not isinstance(data, dict):
        raise ValueError("Scene data must be a JSON object (dict).")

    scenes = data.get("scenes")
    if not isinstance(scenes, list):
        raise ValueError("JSON is missing a 'scenes' array.")
    if len(scenes) < 5:
        raise ValueError(f"Qwen returned only {len(scenes)} scenes. Expected at least 5.")
    if len(scenes) > 8:
        scenes = scenes[:8]

    for i, scene in enumerate(scenes, start=1):
        if not isinstance(scene, dict):
            raise ValueError(f"Scene {i} is not a dict: {scene!r}")

        for field in REQUIRED_SCENE_FIELDS:
            if field not in scene:
                raise ValueError(f"Scene {i} missing field: {field}")

        if not isinstance(scene["scene_number"], int):
            raise ValueError(f"Scene {i} has a non-integer scene_number.")
        if not isinstance(scene["duration"], int) or not 4 <= scene["duration"] <= 8:
            raise ValueError(f"Scene {i} duration must be an integer between 4 and 8.")
        for field in ("narration", "visual_prompt", "on_screen_text"):
            if not isinstance(scene[field], str) or not scene[field].strip():
                raise ValueError(f"Scene {i} field '{field}' must be a non-empty string.")

    data["scenes"] = scenes
    data.setdefault("title", "AI Generated Video")
    data["total_duration"] = sum(s["duration"] for s in scenes)

    return data


# ── Public API ─────────────────────────────────────────────────────────────────

def generate_video_scenes(
    content: str,
    language: str = "English",
    tone: str = "Professional",
    audience: str = "General public",
) -> dict:
    """Call Qwen3 and return a validated video scene plan.

    Args:
        content:  Source text to convert into scenes.
        language: Narration language hint for the prompt.
        tone:     Tone hint (Professional, Casual, etc.).
        audience: Target audience hint.

    Returns:
        Dict with keys: title, total_duration, scenes (list of 5–8 dicts).

    Raises:
        QwenServiceError: If Ollama is unreachable or times out.
        ValueError:       If Qwen's output cannot be parsed / validated.
    """
    prompt = SCENE_PROMPT_TEMPLATE.format(
        language=language,
        tone=tone,
        audience=audience,
        scene_count=DEFAULT_SCENE_COUNT,
        content=content.strip(),
    )

    payload = {
        "model":  MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "think":  False,          # disable extended thinking → pure JSON output
        "format": "json",
        "options": {
            "num_predict": 2000,  # enough for 8 detailed scenes
            "temperature": 0.3,   # low temperature → less hallucination
        },
    }

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=(5.0, REQUEST_TIMEOUT_SECS),
        )
        response.raise_for_status()
    except requests.exceptions.Timeout as exc:
        raise QwenServiceError(
            "Ollama timed out while generating video scenes."
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise QwenServiceError(
            f"Ollama is unavailable: {exc}"
        ) from exc

    raw = response.json().get("response", "").strip()
    if not raw:
        raise ValueError("Qwen returned an empty response.")

    data = _extract_json_object(raw)
    return _validate_scenes(data)
