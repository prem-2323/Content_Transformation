def detect_intent(text: str) -> str:
    """Detect the user's intent from message text via keyword matching."""

    text = text.lower()

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
        "shorten"
    ]):
        return "summarization"

    if any(x in text for x in [
        "linkedin",
        "linkedin post"
    ]):
        return "linkedin"

    if any(x in text for x in [
        "twitter",
        "tweet",
        "x post",
        "tweet thread"
    ]):
        return "twitter"

    if any(x in text for x in [
        "presentation",
        "slides",
        "ppt",
        "powerpoint"
    ]):
        return "presentation"

    if any(x in text for x in [
        "video",
        "storyboard",
        "narration",
        "video script"
    ]):
        return "video"

    if "infographic" in text:
        return "infographic"

    if any(x in text for x in [
        "advisory",
        "alert",
        "incident report"
    ]):
        return "advisory"

    if any(x in text for x in [
        "fact check",
        "fact-check",
        "verify",
        "is this true"
    ]):
        return "fact_check"

    if any(x in text for x in [
        "strategy",
        "strategize",
        "recommendation",
        "plan"
    ]):
        return "strategy"

    return "general"
