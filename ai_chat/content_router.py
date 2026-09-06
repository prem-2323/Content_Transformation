"""Intent detection for the AI Assistant — maps user messages to platform actions."""

import re


def detect_intent(text: str) -> str:
    """Detect the user's intent from message text via keyword matching.

    Returns one of the canonical intent labels used by both the chat endpoint
    and the smart-action endpoint.
    """

    text = text.lower().strip()

    # --- Explicit action intents (most specific first) -----------------------

    # Image generation
    if any(x in text for x in [
        "generate an image",
        "generate image",
        "create an image",
        "create image",
        "make an image",
        "make image",
        "draw me",
        "draw a",
        "make a poster",
        "generate a poster",
        "create a poster",
        "design a",
        "illustration of",
        "picture of",
    ]):
        return "generate_image"

    # Visual / image analysis
    if any(x in text for x in [
        "analyze this image",
        "analyze image",
        "analyse image",
        "what is in this image",
        "describe this image",
        "describe image",
        "extract text from image",
        "ocr",
        "read this image",
        "what do you see",
        "analyze this photo",
        "identify objects",
    ]):
        return "analyze_image"

    # Video generation (full pipeline)
    if any(x in text for x in [
        "generate a video",
        "generate video",
        "create a video",
        "create video",
        "make a video",
        "make video",
        "produce a video",
    ]):
        return "generate_video"

    # Video planning
    if any(x in text for x in [
        "video plan",
        "plan a video",
        "plan video",
        "video storyboard",
        "storyboard",
        "scene plan",
        "video script",
    ]):
        return "video_plan"

    # Audio / TTS
    if any(x in text for x in [
        "generate audio",
        "generate narration",
        "text to speech",
        "read this aloud",
        "read aloud",
        "narrate this",
        "speak this",
        "voice over",
        "voiceover",
        "create audio",
        "make audio",
        "tts",
    ]):
        return "generate_audio"

    # Presentation / PPT
    if any(x in text for x in [
        "make a presentation",
        "make presentation",
        "create a presentation",
        "create presentation",
        "generate a presentation",
        "generate presentation",
        "make ppt",
        "create ppt",
        "generate ppt",
        "powerpoint",
        "make slides",
        "create slides",
        "export pptx",
    ]):
        return "make_presentation"

    # Consistency / quality score
    if any(x in text for x in [
        "quality score",
        "quality check",
        "check quality",
        "score this",
        "rate this",
        "evaluate quality",
        "content quality",
    ]):
        return "quality_score"

    # Consistency pipeline / fact checking
    if any(x in text for x in [
        "consistency check",
        "check consistency",
        "fact check",
        "fact-check",
        "verify facts",
        "is this true",
        "uckr",
        "extract facts",
        "consistency pipeline",
    ]):
        return "consistency_check"

    # --- Content transformation intents ------------------------------------

    if any(x in text for x in [
        "remove markdown",
        "without markdown",
        "plain text",
        "remove formatting",
        "without formatting",
        "clean content",
        "generate clean content",
    ]):
        return "clean_content"

    if any(x in text for x in [
        "summarize",
        "summary",
        "summarise",
        "brief",
        "shorten",
    ]):
        return "summarization"

    if any(x in text for x in [
        "linkedin",
        "linkedin post",
    ]):
        return "linkedin"

    if any(x in text for x in [
        "twitter",
        "tweet",
        "x post",
        "tweet thread",
    ]):
        return "twitter"

    if any(x in text for x in [
        "presentation",
        "slides",
        "ppt",
    ]):
        return "make_presentation"

    if any(x in text for x in [
        "video",
        "narration",
    ]):
        return "video_plan"

    if "infographic" in text:
        return "infographic"

    if any(x in text for x in [
        "advisory",
        "alert",
        "incident report",
    ]):
        return "advisory"

    if any(x in text for x in [
        "strategy",
        "strategize",
        "recommendation",
    ]):
        return "strategy"

    # Transform catch-all
    if any(x in text for x in [
        "transform",
        "rewrite",
        "convert",
        "rephrase",
        "paraphrase",
        "content for",
        "email",
    ]):
        return "transform"

    return "general"


# Intents that should be handled by calling a platform API directly
# (not just the LLM chat endpoint)
ACTION_INTENTS = {
    "generate_image",
    "analyze_image",
    "generate_video",
    "video_plan",
    "generate_audio",
    "make_presentation",
    "quality_score",
    "consistency_check",
    "transform",
    "summarization",
    "linkedin",
    "twitter",
    "infographic",
    "advisory",
    "strategy",
    "clean_content",
}

# Intents that are pure-chat (LLM only)
CHAT_INTENTS = {"general"}
