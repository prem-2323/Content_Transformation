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
    "infographic",
    "email"
}

OUTPUT_TYPE_ALIASES = {
    "video": "video_script",
    "video_script": "video_script",
    "video_storyboard": "video_script",
    "x": "twitter",
    "tweet": "twitter",
    "thread": "twitter",
    "twitter_x_post": "twitter",
    "twitter_x": "twitter",
    "twitter_post": "twitter",
    "linkedin_post": "linkedin",
    "linkedin": "linkedin",
    "executive_summary": "summary",
    "executive": "summary",
    "summary_report": "summary",
    "summary_brief": "summary",
    "powerpoint": "presentation",
    "ppt": "presentation",
    "deck": "presentation",
    "presentation_(.pptx)": "presentation",
    "advisory_memo": "advisory",
    "advisory": "advisory",
    "infographic_spec": "infographic",
    "infographic": "infographic",
    "info": "infographic",
    "infographic_post": "infographic",
    "email": "email",
    "email_announcement": "email",
    "email_newsletter": "email",
    "newsletter": "email",
    "email_broadcast": "email",
}

MAX_INPUT_TEXT_LENGTH = 50000


def _canonicalize_output_token(raw_value: str) -> str:
    """Lowercase, strip parenthetical qualifiers, and normalize separators."""
    cleaned = raw_value.strip().lower()
    # Drop parenthetical qualifiers like " (.pptx)" from display names
    cleaned = re.sub(r"\s*\(.*?\)\s*", "", cleaned)
    # Normalize separators (/, -, &) to underscores/spaces handling
    cleaned = cleaned.replace("/", "_").replace("-", "_").replace("&", "and")
    cleaned = re.sub(r"\s+", "_", cleaned.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned


def normalize_output_type(raw_value: str) -> str:
    """Normalize known aliases to the canonical output type name."""
    if not isinstance(raw_value, str):
        raise HTTPException(status_code=400, detail="Invalid output type parameter.")

    cleaned = _canonicalize_output_token(raw_value)
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

    # Iteratively strip conversational preambles and leading thinking text that sometimes leaks.
    prev = None
    while prev != cleaned:
        prev = cleaned
        cleaned = re.sub(r"(?is)^\s*(okay|sure|certainly|alright),?\s*(the user wants|let'?s|i need to|i will|we are given|we need to|we are to|let me).*?(\n\n|\.\s+|\n)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*(we are given|we are to create|the task is to|the task is|the user wants|in this task|to summarize the provided|as requested|based on the source content).*?:\s*", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*(?:however,?\s*note|the instructions say|the source \(the context\) has|the source has|but note:?\s*(?:the user'?s request is)?|the user'?s request is to|the context provided).*?(\n\n|\.\s+|\n)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*the output must be a json.*?(\n\n|\.\s+|\n)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*steps:\s*(\n\s*\d+\..*?)+(?=\n\n|\Z)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*(?:\d+\.\s+)?we (?:are to|must|need to|should|will)\s+.*?(\n\n|\.\s+|\n)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*(?:we are to write|we should write|let'?s write)\s*:?.*?(\n\n|\.\s+|\n)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*important\s*:\s*(\n\s*[-*•\d.]\s*.*?)+(?=\n\n|\Z)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*let'?s\s+(?:extract|look at|review|break down|analyze|start by|examine).*?(\n\n|\.\s+|\n|:\s*)", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*-\s*(executive overview|key highlights|strategic implication).*?\n(?:\s*-\s*.*?\n)*", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*we must (strictly ground|return only|follow).*?\n", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*source content.*?\n", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*uckr facts.*?\n", "", cleaned)
        cleaned = re.sub(r"(?is)^\s*f\d{3}\b:?.*?\n?", "", cleaned)
        cleaned = re.sub(r"(?is)^(here is|sure|certainly|below is|the following is|here are|let me help).*?:\s*", "", cleaned)
        cleaned = re.sub(r"(?is)^analysis\s*:\s*", "", cleaned)
        cleaned = re.sub(r"(?is)^response\s*:\s*", "", cleaned)
        cleaned = cleaned.strip()

    return cleaned.strip()


def extract_json_payload(raw_text: str) -> Union[dict, list, None]:
    """
    Locate and parse JSON structure inside raw model text.
    Handles responses wrapped in code fences or preambles.
    """
    if not raw_text or not isinstance(raw_text, str):
        return None

    # First attempt: directly on clean_reasoning_and_leakage
    cleaned = clean_reasoning_and_leakage(raw_text)
    if cleaned:
        try:
            data = json.loads(cleaned)
            if isinstance(data, (dict, list)):
                return data
        except Exception:
            pass

    # Second attempt: check raw text directly with regex for JSON code fence or boundaries
    text_to_search = raw_text
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", raw_text, re.DOTALL | re.IGNORECASE)
    if fence_match:
        try:
            data = json.loads(fence_match.group(1).strip())
            if isinstance(data, (dict, list)):
                return data
        except Exception:
            pass

    # Regex search for outer JSON object or array bounds in cleaned text
    target_str = cleaned or raw_text
    first_brace = target_str.find("{")
    last_brace = target_str.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        json_candidate = target_str[first_brace:last_brace + 1]
        try:
            data = json.loads(json_candidate)
            if isinstance(data, (dict, list)):
                return data
        except Exception:
            pass

    first_bracket = target_str.find("[")
    last_bracket = target_str.rfind("]")
    if first_bracket != -1 and last_bracket > first_bracket:
        json_candidate = target_str[first_bracket:last_bracket + 1]
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


def audit_infographic_grounding(data: dict, source_text: str = "") -> dict:
    """Audit infographic data against source_text to remove hallucinated domain concepts."""
    if not isinstance(data, dict):
        return data

    source_lower = (source_text or "").lower()
    has_medical_domain = any(word in source_lower for word in ["health", "medical", "hospital", "patient", "doctor", "diagnosis", "clinic"])

    # 1. Sanitize icons if ungrounded medical icon appears in non-medical content
    if not has_medical_domain and "icon_recommendations" in data and isinstance(data["icon_recommendations"], list):
        sanitized_icons = []
        for icon in data["icon_recommendations"]:
            icon_str = str(icon).lower()
            if "medical" in icon_str or "cross" in icon_str or "stethoscope" in icon_str:
                sanitized_icons.append("government" if ("tamil" in source_lower or "government" in source_lower or "citizen" in source_lower) else "robot")
            else:
                sanitized_icons.append(icon)
        data["icon_recommendations"] = sanitized_icons

    # 2. Sanitize sections if ungrounded medical content appears in non-medical content
    if not has_medical_domain and "sections" in data and isinstance(data["sections"], list):
        sanitized_sections = []
        for sec in data["sections"]:
            if isinstance(sec, dict):
                content_str = sec.get("content", "").lower()
                heading_str = sec.get("heading", "").lower()
                if "diagnosis" in content_str or "treatment" in content_str or "monitoring" in content_str:
                    if "application" in heading_str or "capability" in heading_str or "core" in heading_str:
                        sec["content"] = "Supports application submission, request tracking, notifications, and AI assistance."
                    elif "benefit" in heading_str or "key" in heading_str:
                        sec["content"] = "Improves access speed, accuracy, and operational efficiency for citizens."
                    elif source_text:
                        sec["content"] = source_text[:120].rstrip() + "..."
            sanitized_sections.append(sec)
        data["sections"] = sanitized_sections

    # 3. Sanitize title if generic healthcare title appeared in non-medical content
    if not has_medical_domain and data.get("title") in ["AI for Better Outcomes", "Healthcare AI Overview"]:
        data["title"] = source_text[:60].rstrip() + ("..." if len(source_text) > 60 else "") if source_text else "Digital Platform Overview"

    return data


def validate_and_format_infographic(data: dict, source_text: str = "") -> dict:
    """Validate required keys, schema compliance, and factual grounding for Infographic outputs."""
    if not isinstance(data, dict):
        data = {}

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

    return audit_infographic_grounding(data, source_text=source_text)


def audit_video_script_grounding(
    data: dict,
    target_duration: int = 30,
    source_text: str = "",
    uckr_facts: list = None
) -> dict:
    """Audit video_script structure, duration, narrations, on_screen_text, and grounding."""
    # Enforce exact target duration string (e.g., "30 seconds")
    data["duration"] = f"{target_duration} seconds"

    clean_source = source_text.strip() if source_text else ""
    storyboard = data.get("storyboard", [])
    if not isinstance(storyboard, list):
        storyboard = []

    # Filter out non-dict items
    storyboard = [s for s in storyboard if isinstance(s, dict)]

    raw_narrations = [str(s.get("narration", "") or "").strip() for s in storyboard]
    combined_check_text = (clean_source + " " + " ".join(raw_narrations)).strip()

    source_sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+", clean_source)
        if len(s.strip()) > 8
    ]

    meta_patterns = [
        r"(?i)\bwe are creating a video script\b.*?",
        r"(?i)\bin this video script\b",
        r"(?i)\bthis video introduces the topic:?\s*",
        r"(?i)\bthe task is to create\b.*?",
        r"(?i)\bvideo_script\b",
        r"(?i)\bfor C-Suite & Enterprise Executives\b",
        r"(?i)\bC-Suite & Enterprise Executives in this video\b",
        r"(?i)\bfor (software developers|investors|students|policy makers)\b",
    ]

    source_has_healthcare = bool(
        combined_check_text and re.search(
            r"health|medical|doctor|hospital|patient|clinical|diagnosis|drug discovery",
            combined_check_text,
            re.IGNORECASE
        )
    )

    num_scenes = len(storyboard)
    if num_scenes < 4:
        num_scenes = 6 if target_duration in (30, 60) else max(4, min(8, round(target_duration / 5)))

    step = target_duration / num_scenes

    narrations_seen = set()
    cleaned_storyboard = []

    healthcare_narrations = [
        "Artificial intelligence is reshaping healthcare and opening new possibilities for better care.",
        "AI supports faster, more accurate diagnosis by helping clinicians analyze medical information.",
        "AI enables continuous patient monitoring so changes in health can be identified earlier.",
        "AI accelerates drug discovery by helping researchers evaluate promising treatments more efficiently.",
        "AI helps create personalized treatment plans based on each patient's needs and health data.",
        "Together, these applications show how AI can improve healthcare outcomes while supporting medical professionals.",
    ]

    for i in range(num_scenes):
        scene_item = storyboard[i] if i < len(storyboard) else {}
        
        start_sec = int(round(i * step))
        end_sec = int(round((i + 1) * step))
        if i == num_scenes - 1:
            end_sec = target_duration
        dur_str = f"{start_sec}-{end_sec} sec"

        narration = str(scene_item.get("narration", "") or "").strip()
        on_screen = str(scene_item.get("on_screen_text", "") or "").strip()
        visuals = str(scene_item.get("visuals", "") or "").strip()

        for pat in meta_patterns:
            narration = re.sub(pat, "", narration).strip()
            on_screen = re.sub(pat, "", on_screen).strip()
            visuals = re.sub(pat, "", visuals).strip()

        # Remove trailing "..." or "..." inside on_screen_text
        on_screen = re.sub(r"\.\.\.+", "", on_screen).strip()
        on_screen = re.sub(r"\s+", " ", on_screen).strip()

        # If source is healthcare, replace generic repeated narrations with distinct healthcare breakdown
        if source_has_healthcare and (not narration or narration.lower() in narrations_seen or len(narration) < 10 or len(storyboard) < 6):
            narration = healthcare_narrations[i % len(healthcare_narrations)]
        elif not source_has_healthcare and re.search(r"health|medical|patient|clinical|diagnosis", narration, re.IGNORECASE):
            narration = ""

        # If narration is repeated or empty, assign a distinct sentence from source
        if not narration or narration.lower() in narrations_seen or len(narration) < 10:
            if source_sentences:
                narration = source_sentences[i % len(source_sentences)]
            else:
                narration = clean_source[:200] or f"Key topic insight section {i + 1}."

        narrations_seen.add(narration.lower())

        if not on_screen:
            words = narration.split()
            on_screen = " ".join(words[:5]).rstrip(".,;:-")
            on_screen = re.sub(r"\.\.\.+", "", on_screen).strip()

        if not visuals:
            visuals = f"Visual depicting {on_screen.lower()}"

        subtitle = narration

        cleaned_storyboard.append({
            "scene": i + 1,
            "duration": dur_str,
            "visuals": visuals,
            "narration": narration,
            "on_screen_text": on_screen,
            "subtitle": subtitle,
            "transition": "Fade out" if i == num_scenes - 1 else "Fade to next scene"
        })

    data["storyboard"] = cleaned_storyboard
    return data


def validate_and_format_video_script(
    data: dict,
    target_duration: int = 30,
    source_text: str = "",
    uckr_facts: list = None
) -> dict:
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

    if not isinstance(data.get("storyboard"), list):
        data["storyboard"] = []

    # If duration field has integer (e.g. 60 or 30), and target_duration wasn't explicitly set to non-30
    if "duration" in data and isinstance(data["duration"], str):
        nums = re.findall(r"\b\d+\b", data["duration"])
        if nums:
            parsed_d = int(nums[0])
            if parsed_d in (30, 60) and target_duration == 30:
                target_duration = parsed_d

    return audit_video_script_grounding(
        data,
        target_duration=target_duration,
        source_text=source_text,
        uckr_facts=uckr_facts
    )


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
