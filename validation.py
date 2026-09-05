import re
import json
from typing import List, Dict, Any, Union
from fastapi import HTTPException

# Allowed set of supported output types across the platform
ALLOWED_OUTPUT_TYPES = {
    "summary",
    "linkedin",
    "twitter",
    "advisory",
    "presentation",
    "video_script",
    "infographic"
}

MAX_INPUT_TEXT_LENGTH = 50000


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
    for ot in output_types:
        if not isinstance(ot, str) or not ot.strip():
            raise HTTPException(status_code=400, detail="Invalid output type parameter.")
        
        normalized = ot.strip().lower()
        if normalized not in ALLOWED_OUTPUT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported output type: {ot}"
            )
        cleaned_types.append(normalized)

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

    # Remove <think>...</think> and <reasoning>...</reasoning> blocks (case insensitive, dotall)
    cleaned = re.sub(r"(?i)<think>.*?</think>", "", raw_text, flags=re.DOTALL)
    cleaned = re.sub(r"(?i)<reasoning>.*?</reasoning>", "", cleaned, flags=re.DOTALL)

    # Remove lingering unclosed tags if present
    cleaned = re.sub(r"(?i)<think>.*", "", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"(?i)<reasoning>.*", "", cleaned, flags=re.DOTALL)

    # Strip leading/trailing whitespace
    return cleaned.strip()


def validate_and_clean_model_response(generated_text: str) -> str:
    """
    Validate model response:
    - Strips reasoning leakage.
    - Raises HTTP 504/500 if the model returned an empty string.
    """
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
        data["storyboard"] = [
            {
                "scene": 1,
                "duration": "0-60 sec",
                "visuals": "Presenter or motion graphics illustrating key themes.",
                "narration": data.get("video_title", "Overview narrative"),
                "on_screen_text": "Key Highlights",
                "subtitle": "Overview narrative",
                "transition": "Fade Out"
            }
        ]

    sb_keys = ["scene", "duration", "visuals", "narration", "on_screen_text", "subtitle", "transition"]
    for idx, scene in enumerate(data["storyboard"], 1):
        if isinstance(scene, dict):
            for sb_k in sb_keys:
                if sb_k not in scene or scene[sb_k] is None:
                    scene[sb_k] = idx if sb_k == "scene" else ""

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
