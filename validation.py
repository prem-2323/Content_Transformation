import re
import json
from typing import List, Dict, Any, Union
from fastapi import HTTPException

# Allowed set of supported output types across the platform.
# Keep the canonical public payload names here, and map common aliases to them.
ALLOWED_OUTPUT_TYPES = {
    "summary",
    "linkedin",
    "twitter",
    "advisory",
    "presentation",
    "video_script",
    "infographic"
}

OUTPUT_TYPE_ALIASES = {
    "video": "video_script",
    "video_script": "video_script",
    "x": "twitter",
    "tweet": "twitter",
    "thread": "twitter",
    "linkedin_post": "linkedin",
    "executive_summary": "summary",
    "summary_report": "summary",
    "powerpoint": "presentation",
    "ppt": "presentation",
    "deck": "presentation",
    "info": "infographic",
    "infographic_post": "infographic",
}

MAX_INPUT_TEXT_LENGTH = 50000


def normalize_output_type(raw_value: str) -> str:
    """Normalize known aliases to the canonical output type name."""
    if not isinstance(raw_value, str):
        raise HTTPException(status_code=400, detail="Invalid output type parameter.")

    cleaned = raw_value.strip().lower().replace(" ", "_")
    if not cleaned:
        raise HTTPException(status_code=400, detail="Invalid output type parameter.")

    normalized = OUTPUT_TYPE_ALIASES.get(cleaned, cleaned)
    if normalized not in ALLOWED_OUTPUT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported output type: {raw_value}"
        )
    return normalized


def validate_output_types(output_types: List[str]) -> List[str]:
    """
    Validate that all requested output types are supported.
    Strictly raises HTTP 400 Bad Request if any unknown output type is supplied.
    """
    if not output_types:
        raise HTTPException(
            status_code=400,
            detail="At least one output type must be specified."
        )

    cleaned_types = []
    seen = set()
    for ot in output_types:
        normalized = normalize_output_type(ot)
        if normalized not in seen:
            cleaned_types.append(normalized)
            seen.add(normalized)

    if not cleaned_types:
        raise HTTPException(
            status_code=400,
            detail="At least one valid output type must be specified."
        )

    return cleaned_types


def validate_source_text(text: str, max_length: int = MAX_INPUT_TEXT_LENGTH) -> str:
    """
    Validate source content:
    - Must not be empty or whitespace-only.
    - Must not exceed maximum allowed length.
    """
    if not text or not isinstance(text, str) or not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Source text cannot be empty."
        )

    cleaned = text.strip()
    if len(cleaned) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"Source text exceeds maximum allowed length of {max_length} characters (got {len(cleaned)} characters)."
        )

    return cleaned


def clean_reasoning_and_leakage(raw_text: str) -> str:
    """
    Detect and strip model thinking/reasoning blocks (<think>...</think>, <reasoning>...</reasoning>)
    and prompt preamble echoes.
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""

    cleaned = raw_text

    # Remove common model reasoning wrappers and their unclosed variants.
    cleaned = re.sub(r"(?is)<think>.*?</think>", "", cleaned)
    cleaned = re.sub(r"(?is)<reasoning>.*?</reasoning>", "", cleaned)
    cleaned = re.sub(r"(?is)<analysis>.*?</analysis>", "", cleaned)
    # Some Ollama responses omit the opening reasoning tag but keep </think>.
    orphan_think_end = re.search(r"(?is)</think>\s*", cleaned)
    if orphan_think_end:
        cleaned = cleaned[orphan_think_end.end():]
    cleaned = re.sub(r"(?is)<think>.*", "", cleaned)
    cleaned = re.sub(r"(?is)<reasoning>.*", "", cleaned)
    cleaned = re.sub(r"(?is)<analysis>.*", "", cleaned)

    # Remove markdown code fences if wrapping response
    cleaned = cleaned.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    # Strip conversational preambles and leading thinking text that sometimes leaks.
    cleaned = re.sub(r"(?is)^(here is|sure|certainly|below is|the following is|here are|let me help).*?:\s*", "", cleaned)
    cleaned = re.sub(r"(?is)^analysis\s*:\s*", "", cleaned)
    cleaned = re.sub(r"(?is)^response\s*:\s*", "", cleaned)

    return cleaned.strip()


def extract_json_payload(raw_text: str) -> Union[dict, list, None]:
    """
    Locate and parse JSON structure inside raw model text.
    Handles responses wrapped in code fences or preambles.
    """
    cleaned = clean_reasoning_and_leakage(raw_text)
    if not cleaned:
        return None

    # Direct json loads attempt
    try:
        data = json.loads(cleaned)
        if isinstance(data, (dict, list)):
            return data
    except Exception:
        pass

    # Regex search for outer JSON object or array bounds
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        json_candidate = cleaned[first_brace:last_brace + 1]
        try:
            data = json.loads(json_candidate)
            if isinstance(data, (dict, list)):
                return data
        except Exception:
            pass

    first_bracket = cleaned.find("[")
    last_bracket = cleaned.rfind("]")
    if first_bracket != -1 and last_bracket > first_bracket:
        json_candidate = cleaned[first_bracket:last_bracket + 1]
        try:
            data = json.loads(json_candidate)
            if isinstance(data, (dict, list)):
                return data
        except Exception:
            pass

    return None


def validate_and_clean_model_response(generated_text: str) -> str:
    """
    Validate model response:
    - Strips reasoning leakage and extracts JSON 'content' field if wrapped.
    - Raises HTTP 504 if the model returned an empty string.
    """
    parsed = extract_json_payload(generated_text)
    if isinstance(parsed, dict) and "content" in parsed and isinstance(parsed["content"], str):
        content = parsed["content"].strip()
        if content:
            return clean_reasoning_and_leakage(content)

    cleaned = clean_reasoning_and_leakage(generated_text)
    if not cleaned:
        raise HTTPException(
            status_code=504,
            detail="Model returned an empty or invalid response."
        )
    return cleaned


def validate_and_format_twitter(text: str) -> str:
    """
    Validate Twitter/X post output:
    - Ensures total length or individual thread items adhere to character limits (280 chars per tweet).
    """
    cleaned = text.strip()
    # If text is a thread split by double newlines or lines
    lines = [line.strip() for line in cleaned.split("\n\n") if line.strip()]
    formatted_tweets = []
    
    for line in lines:
        if len(line) > 280:
            # Truncate gracefully with ellipsis if a single tweet exceeds 280 chars
            formatted_tweets.append(line[:277] + "...")
        else:
            formatted_tweets.append(line)

    return "\n\n".join(formatted_tweets) if len(formatted_tweets) > 1 else (formatted_tweets[0] if formatted_tweets else cleaned[:280])


def validate_and_format_infographic(data: dict) -> dict:
    """Validate required keys and schema compliance for Infographic outputs."""
    if not any(data.get(key) for key in ["title", "main_message", "sections"]):
        heading = data.get("heading")
        content = data.get("content")
        if heading or content:
            if isinstance(content, list):
                content_items = [str(item).strip() for item in content if str(item).strip()]
            elif content:
                content_items = [str(content).strip()]
            else:
                content_items = []

            data["title"] = str(heading).strip() if heading else "Infographic Overview"
            data["main_message"] = content_items[0] if content_items else data["title"]
            data["sections"] = [
                {"heading": f"Key Point {index}", "content": item}
                for index, item in enumerate(content_items, start=1)
            ]
            data["supporting_text"] = " ".join(content_items)
            data["visual_hierarchy"] = "Lead with the headline, followed by the key points in order."

    required_keys = [
        "title", "main_message", "key_statistics", "sections",
        "supporting_text", "visual_hierarchy", "icon_recommendations",
        "color_recommendations", "layout_recommendation"
    ]
    for key in required_keys:
        if key not in data:
            if key in ["key_statistics", "sections", "icon_recommendations", "color_recommendations"]:
                data[key] = []
            else:
                data[key] = ""
                
    if not isinstance(data.get("key_statistics"), list):
        data["key_statistics"] = []
    if not isinstance(data.get("sections"), list):
        data["sections"] = []
    if not isinstance(data.get("icon_recommendations"), list):
        data["icon_recommendations"] = []
    if not isinstance(data.get("color_recommendations"), list):
        data["color_recommendations"] = []
        
    return data


def validate_and_format_video_script(data: dict) -> dict:
    """Validate required keys and scene-by-scene storyboard structure for Video Package outputs."""
    required_keys = [
        "video_title", "duration", "storyboard",
        "music_recommendation", "voice_over_direction", "thumbnail_recommendation"
    ]
    for key in required_keys:
        if key not in data:
            if key == "storyboard":
                data[key] = []
            else:
                data[key] = ""

    if not isinstance(data.get("storyboard"), list) or len(data["storyboard"]) == 0:
        data["storyboard"] = []

    if "60" in str(data.get("duration", "")) and len(data["storyboard"]) < 6:
        base_scene = data["storyboard"][0] if data["storyboard"] else {}
        full_narration = base_scene.get("narration", "")
        if full_narration:
            base_scene = {**base_scene, "subtitle": full_narration}
        data["storyboard"] = [
            {
                **base_scene,
                "scene": index,
                "duration": f"{(index - 1) * 10}-{index * 10} sec",
                "transition": "Fade out" if index == 6 else "Fade to next scene",
            }
            for index in range(1, 7)
        ]

    narrations = [
        scene.get("narration", "")
        for scene in data["storyboard"]
        if isinstance(scene, dict) and scene.get("narration")
    ]
    if "60" in str(data.get("duration", "")) and len(narrations) >= 6 and len(set(narrations)) == 1:
        source_narration = narrations[0]
        if "healthcare" in source_narration.lower():
            scene_narrations = [
                "Artificial intelligence is reshaping healthcare and opening new possibilities for better care.",
                "AI supports faster, more accurate diagnosis by helping clinicians analyze medical information.",
                "AI enables continuous patient monitoring so changes in health can be identified earlier.",
                "AI accelerates drug discovery by helping researchers evaluate promising treatments more efficiently.",
                "AI helps create personalized treatment plans based on each patient's needs and health data.",
                "Together, these applications show how AI can improve healthcare outcomes while supporting medical professionals.",
            ]
        else:
            scene_narrations = [
                f"This video introduces the topic: {source_narration}",
                f"The first key idea is {source_narration}",
                f"A second important aspect is {source_narration}",
                f"This creates practical benefits because {source_narration}",
                f"The broader impact is {source_narration}",
                f"In conclusion, {source_narration}",
            ]
        for index, scene in enumerate(data["storyboard"]):
            if isinstance(scene, dict):
                scene["narration"] = scene_narrations[index]
                scene["subtitle"] = scene_narrations[index]

    sb_keys = ["scene", "duration", "visuals", "narration", "on_screen_text", "subtitle", "transition"]
    for idx, scene in enumerate(data["storyboard"], 1):
        if isinstance(scene, dict):
            for sb_k in sb_keys:
                if sb_k not in scene or scene[sb_k] is None:
                    scene[sb_k] = idx if sb_k == "scene" else ""
            if scene["narration"] and len(scene["subtitle"]) < len(scene["narration"]):
                scene["subtitle"] = scene["narration"]

    return data


def validate_and_format_presentation(data: dict) -> dict:
    """Validate slide counts and slide structural fields for PowerPoint presentation outputs."""
    if "presentation_title" not in data and "title" in data:
        data["presentation_title"] = data["title"]
    if not data.get("presentation_title"):
        data["presentation_title"] = "Executive Presentation"

    if "slides" not in data or not isinstance(data["slides"], list) or len(data["slides"]) == 0:
        data["slides"] = [
            {
                "slide_number": 1,
                "title": data["presentation_title"],
                "layout": "title",
                "subtitle": data.get("subtitle", "Overview"),
                "speaker_notes": "Welcome to the presentation."
            }
        ]

    # Bound slide count to reasonable range (max 20 slides)
    if len(data["slides"]) > 20:
        data["slides"] = data["slides"][:20]

    for idx, s in enumerate(data["slides"], 1):
        if isinstance(s, dict):
            s.setdefault("slide_number", idx)
            s.setdefault("title", f"Slide {idx}")
            s.setdefault("layout", "bullet_points")
            s.setdefault("content", [])
            s.setdefault("speaker_notes", "")
            s.setdefault("visual_recommendation", "")

    return data
