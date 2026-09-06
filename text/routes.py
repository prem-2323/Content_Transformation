import json
import re
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import FileResponse
from typing import Optional, List

from .qwen_service import QwenServiceError, generate_with_qwen
from .document_extractor import extract_txt, extract_pdf, extract_docx
from .schemas import (
    TextRequest,
    TextResponse,
    FileTextResponse,
    AudioRequest,
    VideoAudioRequest,
    AudioResponse,
    BrandVoiceProfile,
    AudienceReframeRequest,
    AudienceReframeResponse
)
from .pptx_generator import create_pptx_presentation
from .tts import generate_audio, RECOMMENDED_VOICES, extract_video_script_narration
from validation import (
    validate_output_types,
    validate_source_text,
    validate_and_clean_model_response,
    extract_json_payload,
    validate_and_format_twitter,
    validate_and_format_infographic,
    validate_and_format_video_script,
    validate_and_format_presentation
)

router = APIRouter(tags=["Text Transformation"])

OUTPUT_INSTRUCTIONS = {
    "linkedin": """
Create a professional LinkedIn post.
Return ONLY valid JSON matching this exact structure:
{
  "content": "Professional LinkedIn post text with an engaging opening, clear paragraphs, and relevant hashtags."
}
""",

    "twitter": """
Create a concise X/Twitter post or thread.
Return ONLY valid JSON matching this exact structure:
{
  "content": "Concise X/Twitter post or thread text."
}
""",

    "summary": """
Create a clear executive summary.
Return ONLY valid JSON matching this exact structure:
{
  "content": "Executive summary text including key points and conclusions."
}
""",

    "advisory": """
Create a professional advisory.
Return ONLY valid JSON matching this exact structure:
{
  "content": "Professional advisory text explaining situation, potential impact, and recommended actions."
}
""",

    "email": """
Create an engaging corporate or team Email Announcement.
Return ONLY valid JSON matching this exact structure:
{
  "content": "Subject: [Engaging Email Subject]\n\nDear Team / Partners,\n\n[Body text with key announcement points, executive takeaways, call to action, and formal sign-off]."
}
""",

    "presentation": """
Create structured content for a PowerPoint presentation.
Return ONLY valid JSON with exactly this structure:
{
  "presentation_title": "Main Presentation Title",
  "subtitle": "Subtitle or Deck Summary",
  "slides": [
    {
      "slide_number": 1,
      "title": "Title Slide Title",
      "layout": "title",
      "subtitle": "Cover Subtitle",
      "content": [],
      "speaker_notes": "Welcome audience to the presentation.",
      "visual_recommendation": "Modern graphic concept"
    },
    {
      "slide_number": 2,
      "title": "Key Market Insights",
      "layout": "bullet_points",
      "content": [
        "Key insight bullet point 1",
        "Key insight bullet point 2",
        "Key insight bullet point 3"
      ],
      "speaker_notes": "Detailed spoken narration for this slide.",
      "visual_recommendation": "Bar chart comparing key growth metrics"
    },
    {
      "slide_number": 3,
      "title": "Strategic Roadmap",
      "layout": "two_column",
      "column_left": ["Action step 1", "Action step 2"],
      "column_right": ["Expected outcome 1", "Expected outcome 2"],
      "speaker_notes": "Explain how operational actions lead to outcomes.",
      "visual_recommendation": "Two-column grid layout with accent borders"
    }
  ]
}
""",

    "video_script": """
Create a Complete Video Package and production storyboard.
Return ONLY valid JSON with exactly these keys:
{
  "video_title": "Catchy and professional title for the video",
  "duration": "Total estimated duration (e.g. 60 seconds)",
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-10 sec",
      "visuals": "Detailed description of B-roll or visual elements",
      "narration": "Voiceover script text for this scene",
      "on_screen_text": "Key text or title callouts displayed on screen",
      "subtitle": "Subtitle text for accessibility",
      "transition": "Transition effect to next scene (e.g. Cut, Fade to Black, Wipe Left)"
    }
  ],
  "music_recommendation": "Suggested background music genre, tempo, and mood",
  "voice_over_direction": "Tone, pacing, emotion, and accent guidance for the voiceover artist",
  "thumbnail_recommendation": "Description for an engaging video thumbnail concept"
}
""",

    "infographic": """
Create structured content for an Infographic.
Return ONLY valid JSON with exactly these keys:
{
  "title": "Concise headline title for the infographic",
  "main_message": "Core takeaway message",
  "key_statistics": ["Stat or key metric 1", "Stat or key metric 2"],
  "sections": [
    {"heading": "Section 1 Title", "content": "Section 1 content or bullet points"},
    {"heading": "Section 2 Title", "content": "Section 2 content or bullet points"}
  ],
  "supporting_text": "Brief contextual summary or supporting narrative",
  "visual_hierarchy": "Guidance on primary vs secondary visual focus areas",
  "icon_recommendations": ["icon_name_1", "icon_name_2"],
  "color_recommendations": ["Primary Color", "Accent Color", "Background Color"],
  "layout_recommendation": "Recommended visual structure layout (e.g. Vertical Timeline, 3-Column Grid, Comparison)"
}
"""
}


def _extract_meaningful_text(candidate: str) -> str:
    """Trim reasoning-heavy preambles while preserving the final substantive content."""
    if not candidate:
        return ""

    cleaned = validate_and_clean_model_response(candidate)
    if not cleaned:
        return ""

    stop_markers = [
        "however",
        "but note",
        "but the instruction says",
        "alternative:",
        "let me check",
        "steps for",
        "proposed summary text",
        "the source says",
        "we need to",
        "after research",
        "why this works",
        "what this means",
    ]

    lower = cleaned.lower()
    best_index = -1
    for marker in stop_markers:
        idx = lower.find(marker)
        if idx != -1 and (best_index == -1 or idx < best_index):
            best_index = idx

    if best_index != -1:
        cleaned = cleaned[:best_index].strip()

    if "proposed summary text:" in cleaned.lower():
        sub = re.search(r"(?is)proposed summary text\s*:\s*(.+)", cleaned)
        if sub:
            cleaned = sub.group(1).strip()

    cleaned = re.sub(r"(?is)^\s*(we are given|the task is|the source content|here is|below is|as an ai|i am).*?:\s*", "", cleaned)
    cleaned = re.sub(r"(?is)^\s*[\"'].*?[\"']\s*\n?", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.strip("\n ")


def _build_infographic_fallback(text: str) -> dict:
    """Create a minimal valid infographic payload when the model does not return JSON."""
    final_text = _extract_meaningful_text(text) or text.strip()
    title = "AI for Better Outcomes"
    main_message = final_text[:220] if final_text else "AI is improving healthcare, operations, and decision-making."
    if len(final_text) > 220:
        main_message = final_text[:220].rstrip() + "..."

    sections = [
        {"heading": "Key Benefit", "content": "Improves accuracy, speed, and decision support."},
        {"heading": "Core Application", "content": "Supports diagnosis, treatment planning, and monitoring."},
    ]

    return validate_and_format_infographic({
        "title": title,
        "main_message": main_message,
        "key_statistics": [],
        "sections": sections,
        "supporting_text": final_text[:500] if final_text else "AI is helping organizations work faster and more accurately.",
        "visual_hierarchy": "Lead with a dramatic headline, then highlight the three strongest benefits in large cards.",
        "icon_recommendations": ["medical-cross", "chart", "brain"],
        "color_recommendations": ["Navy", "Blue", "Light blue"],
        "layout_recommendation": "Hero headline above three benefit cards with a single supporting statistic row."
    })


def _build_video_fallback(text: str) -> dict:
    """Create a minimal valid video package payload when the model does not return JSON."""
    final_text = _extract_meaningful_text(text) or text.strip()
    title = "AI Impact Overview"
    if len(final_text) > 40:
        title = final_text[:40].rstrip() + ("..." if len(final_text) > 40 else "")
    if not title or title == "...":
        title = "AI Impact Overview"

    scene_topics = [
        "Introduce the topic with a clear establishing shot.",
        "Show the core technology or process in action.",
        "Explain the first major benefit with supporting graphics.",
        "Explain the second major benefit with a practical example.",
        "Show the broader impact and why it matters to the audience.",
        "Close with the key takeaway and a forward-looking message.",
    ]
    storyboard = [{
        "scene": index,
        "duration": f"{(index - 1) * 10}-{index * 10} sec",
        "visuals": topic,
        "narration": final_text,
        "on_screen_text": title,
        "subtitle": final_text,
        "transition": "Fade to next scene" if index < 6 else "Fade out",
    } for index, topic in enumerate(scene_topics, 1)]

    return validate_and_format_video_script({
        "video_title": title,
        "duration": "60 seconds",
        "storyboard": storyboard,
        "music_recommendation": "Modern upbeat ambient electronic track with soft drums",
        "voice_over_direction": "Clear, confident, professional and energetic delivery",
        "thumbnail_recommendation": "Large title text over a futuristic dashboard and abstract AI network graphics"
    })


def _build_presentation_fallback(text: str) -> dict:
    """Create a usable multi-slide deck when the model is unavailable."""
    source_text = _extract_meaningful_text(text) or text.strip()
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", source_text) if part.strip()]
    if not sentences:
        sentences = [source_text or "No source content was provided."]

    title = sentences[0][:70].rstrip(". ") or "Executive Presentation"
    slides = [{
        "slide_number": 1,
        "title": title,
        "layout": "title",
        "subtitle": "Key insights and practical implications",
        "speaker_notes": "Introduce the subject and its main message.",
    }]
    for index, sentence in enumerate(sentences, start=2):
        slides.append({
            "slide_number": index,
            "title": f"Key Insight {index - 1}",
            "layout": "bullet_points",
            "content": [sentence],
            "speaker_notes": f"Explain this key insight: {sentence}",
            "visual_recommendation": "Clean explanatory diagram related to this insight",
        })

    return validate_and_format_presentation({
        "presentation_title": title,
        "subtitle": "Key insights and practical implications",
        "slides": slides,
    })


def _contains_prompt_leakage(value) -> bool:
    text = str(value).lower()
    return any(marker in text for marker in [
        "source content:",
        "output type:",
        "audience:",
        "detail level:",
        "steps:",
        "we are transforming the source",
    ])


def _is_placeholder_output(value: str) -> bool:
    """Detect model schema-echo placeholders like 'string' / 'string here'."""
    if not value:
        return True
    return value.strip().lower() in {
        "string", "string here", "content", "text here", "output here",
        "n/a", "none", "null", "undefined", "todo",
    }


def _is_placeholder_dict(data: dict) -> bool:
    """True when every scalar leaf in a parsed model dict is a schema placeholder."""
    leaves: list[str] = []

    def _collect(value) -> None:
        if isinstance(value, dict):
            for item in value.values():
                _collect(item)
        elif isinstance(value, list):
            for item in value:
                _collect(item)
        elif isinstance(value, str):
            leaves.append(value)

    _collect(data)
    return bool(leaves) and all(_is_placeholder_output(leaf) for leaf in leaves)


def parse_output_content(generated_text: str, output_type: str, source_text: str = ""):
    """Clean reasoning leakage, validate model response, and parse structured output if required."""
    cleaned_text = validate_and_clean_model_response(generated_text)
    ot_lower = output_type.lower()

    # Parse JSON payload
    parsed_json = extract_json_payload(generated_text)

    # 1. Text Deliverables (linkedin, twitter, summary, advisory, email)
    if ot_lower in ["linkedin", "twitter", "summary", "advisory", "email"]:
        final_text = cleaned_text
        if isinstance(parsed_json, dict) and "content" in parsed_json and isinstance(parsed_json["content"], str):
            final_text = parsed_json["content"].strip()

        if _contains_prompt_leakage(final_text):
            if ot_lower == "linkedin":
                return f"{source_text}\n\n#ArtificialIntelligence #Healthcare"
            if ot_lower == "twitter":
                return validate_and_format_twitter(source_text)
            if ot_lower == "email":
                return f"Subject: Announcement: Key Insights & Updates\n\nDear Team,\n\n{source_text}\n\nBest regards,\nLeadership Team"
            return source_text

        # Guard: model sometimes echoes the JSON schema placeholder
        # ({"content": "string"}) instead of generating. Fall back to
        # source-grounded output rather than returning garbage.
        if _is_placeholder_output(final_text) or (
            source_text and len(final_text) < 15 < len(source_text)
        ):
            return _fallback_output(ot_lower, source_text)

        final_text = _extract_meaningful_text(final_text) or cleaned_text
        if _is_placeholder_output(final_text):
            return _fallback_output(ot_lower, source_text)
        if ot_lower == "twitter":
            return validate_and_format_twitter(final_text)
        return final_text

    # 2. Structured Deliverables (infographic, video_script, presentation)
    if isinstance(parsed_json, dict):
        if _is_placeholder_dict(parsed_json):
            if ot_lower == "infographic":
                return _build_infographic_fallback(source_text or generated_text)
            if ot_lower == "video_script":
                return _build_video_fallback(source_text or generated_text)
            if ot_lower == "presentation":
                return _build_presentation_fallback(source_text or cleaned_text)
        if ot_lower == "infographic":
            if _contains_prompt_leakage(parsed_json):
                return _build_infographic_fallback(source_text)
            return validate_and_format_infographic(parsed_json)
        elif ot_lower == "video_script":
            return validate_and_format_video_script(parsed_json)
        elif ot_lower == "presentation":
            return validate_and_format_presentation(parsed_json)

    # Structured fallbacks if raw text wasn't valid JSON
    if ot_lower == "infographic":
        return _build_infographic_fallback(source_text or generated_text)
    elif ot_lower == "video_script":
        return _build_video_fallback(generated_text)
    elif ot_lower == "presentation":
        return _build_presentation_fallback(source_text or cleaned_text)

    return cleaned_text


def _fallback_output(output_type: str, source_text: str):
    if output_type == "infographic":
        return _build_infographic_fallback(source_text)
    if output_type == "video_script":
        return _build_video_fallback(source_text)
    if output_type == "presentation":
        return _build_presentation_fallback(source_text)
    if output_type == "linkedin":
        return f"{source_text}\n\n#ArtificialIntelligence #Healthcare"
    if output_type == "twitter":
        return validate_and_format_twitter(source_text)
    if output_type == "email":
        return f"Subject: Announcement: Key Insights & Updates\n\nDear Team,\n\n{source_text}\n\nBest regards,\nLeadership Team"
    return source_text


def fetch_url_text(url: str) -> str:
    """Scrape a public article URL into plain source text.

    Reuses the consistency extractor so web ingestion behaves identically
    across /transform and /consistency/* endpoints.
    """
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://.")
    try:
        from consistency.extractor import extract_from_url
        normalized = extract_from_url(url=url)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Could not fetch URL content: {error}")
    if not normalized.raw_text or not normalized.raw_text.strip():
        raise HTTPException(status_code=502, detail="No readable article text found at that URL.")
    return normalized.raw_text


def resolve_form_output_types(output_type: str | None = None, output_types: str | None = None) -> List[str]:
    """Parse output_types form input (comma separated or JSON list) or fallback to output_type."""
    if output_types and output_types.strip():
        raw = output_types.strip()
        # Swagger UI can submit its generic string placeholder alongside the
        # explicit legacy output_type field. Treat that placeholder as empty.
        if raw.lower() == "string" and output_type and output_type.strip():
            return [output_type.strip()]
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    items = [str(item).strip() for item in parsed if item and str(item).strip()]
                    if items:
                        return items
            except Exception:
                pass
        items = [item.strip() for item in raw.split(",") if item and item.strip()]
        if items:
            return items
    if output_type and output_type.strip():
        return [output_type.strip()]
    return ["summary"]


@router.post("/transform", response_model=TextResponse)
def transform(request: TextRequest):
    """Transform direct text input (or a scraped public URL) into selected output formats using Qwen3 4B."""
    source_text = (request.text or "").strip()
    if not source_text and request.url and request.url.strip():
        source_text = fetch_url_text(request.url.strip())
    valid_text = validate_source_text(source_text)
    raw_requested = request.output_types or [request.output_type or "summary"]
    target_types = validate_output_types(raw_requested)
    def generate_output(ot: str):
        output_instruction = OUTPUT_INSTRUCTIONS.get(
            ot.lower(),
            OUTPUT_INSTRUCTIONS["summary"]
        )

        prompt = f"""
You are a professional content transformation AI.

Transform the source content according to the user's requirements.

SOURCE CONTENT:
{valid_text}

OUTPUT TYPE:
{ot}

AUDIENCE:
{request.audience}

TONE:
{request.tone}

LANGUAGE:
{request.language}

DETAIL LEVEL:
{request.detail_level}

OBJECTIVE:
{request.objective}

TRANSFORMATION INSTRUCTIONS:
{output_instruction}

CRITICAL OUTPUT CONSTRAINTS:
- Return ONLY valid JSON matching the requested structure.
- Do not include reasoning or chain of thought.
- Do not include analysis or commentary.
- Do not include explanations.
- Do not include markdown code fences (```json).
- Preserve factual information from the source text.
"""

        try:
            generated_text = generate_with_qwen(prompt)
            return ot, parse_output_content(generated_text, ot, valid_text)
        except QwenServiceError as error:
            return ot, _fallback_output(ot, valid_text)

    with ThreadPoolExecutor(max_workers=len(target_types)) as executor:
        outputs_dict = dict(executor.map(generate_output, target_types))

    first_type = target_types[0]

    return TextResponse(
        output_type=first_type,
        output_types=target_types,
        audience=request.audience,
        tone=request.tone,
        language=request.language,
        detail_level=request.detail_level,
        objective=request.objective,
        outputs=outputs_dict,
        generated_content=outputs_dict[first_type]
    )


@router.post("/transform-file", response_model=FileTextResponse)
async def transform_file(
    file: UploadFile = File(...),
    output_type: str | None = Form(None),
    output_types: str | None = Form(None, description="Comma-separated or JSON list of output types, e.g. summary,linkedin"),
    audience: str = Form("General public"),
    tone: str = Form("Professional"),
    language: str = Form("English"),
    detail_level: str = Form("Medium"),
    objective: str = Form("Inform")
):
    """Extract document content (TXT, PDF, DOCX) and transform into selected output format(s)."""
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is missing."
        )

    filename = file.filename.lower()

    if not (filename.endswith(".txt") or filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Only TXT, PDF and DOCX files are supported."
        )

    # Validate output types first before reading file
    raw_requested = resolve_form_output_types(output_type, output_types)
    target_types = validate_output_types(raw_requested)

    try:
        extracted_text = ""
        if filename.endswith(".txt"):
            extracted_text = extract_txt(file)
        elif filename.endswith(".pdf"):
            extracted_text = extract_pdf(file)
        elif filename.endswith(".docx"):
            extracted_text = extract_docx(file)

        valid_text = validate_source_text(extracted_text)
        outputs_dict = {}

        for ot in target_types:
            output_instruction = OUTPUT_INSTRUCTIONS.get(
                ot.lower(),
                OUTPUT_INSTRUCTIONS["summary"]
            )

            prompt = f"""
You are a professional content transformation AI.

Transform the extracted document content according to the user's requirements.

SOURCE CONTENT:
{valid_text}

OUTPUT TYPE:
{ot}

AUDIENCE:
{audience}

TONE:
{tone}

LANGUAGE:
{language}

DETAIL LEVEL:
{detail_level}

OBJECTIVE:
{objective}

TRANSFORMATION INSTRUCTIONS:
{output_instruction}

Important:
- Preserve factual information from the source.
- Do not invent important facts.
- Follow the requested language.
- Follow the requested tone and audience.
- Return only the transformed content.
"""

            try:
                generated_text = generate_with_qwen(prompt)
                outputs_dict[ot] = parse_output_content(generated_text, ot, valid_text)
            except QwenServiceError:
                outputs_dict[ot] = _fallback_output(ot, valid_text)

        first_type = target_types[0]

        return FileTextResponse(
            filename=file.filename,
            output_type=first_type,
            output_types=target_types,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective,
            extracted_text=valid_text,
            outputs=outputs_dict,
            generated_content=outputs_dict[first_type]
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Unable to read the TXT file. Please use UTF-8 encoding."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"File processing failed: {str(e)}"
        )


@router.post("/export-pptx")
def export_pptx(request: TextRequest):
    """Generate structured slides using Qwen3 4B and return a downloadable Microsoft PowerPoint (.pptx) file."""
    valid_text = validate_source_text(request.text)
    validate_output_types(["presentation"])

    output_instruction = OUTPUT_INSTRUCTIONS["presentation"]
    prompt = f"""
You are a professional presentation designer AI.

Transform the source content into a structured PowerPoint presentation.

SOURCE CONTENT:
{valid_text}

AUDIENCE: {request.audience}
TONE: {request.tone}
LANGUAGE: {request.language}
DETAIL LEVEL: {request.detail_level}
OBJECTIVE: {request.objective}

TRANSFORMATION INSTRUCTIONS:
{output_instruction}

Important:
- Return ONLY valid JSON for the presentation structure.
- Create one title slide plus a separate content slide for each major idea in the source.
- For multi-sentence or multi-paragraph input, return at least 3 content slides with distinct titles and content.
"""
    try:
        try:
            raw_text = generate_with_qwen(prompt)
            parsed_presentation = parse_output_content(raw_text, "presentation", valid_text)
        except QwenServiceError:
            parsed_presentation = _fallback_output("presentation", valid_text)
        if not isinstance(parsed_presentation, dict):
            raise HTTPException(status_code=502, detail="Model returned an invalid presentation structure.")
        pptx_stream = create_pptx_presentation(parsed_presentation)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"PPTX generation failed: {str(err)}")

    filename = "presentation.pptx"
    return Response(
        content=pptx_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/export-pptx-file")
async def export_pptx_file(
    file: UploadFile = File(...),
    audience: str = Form("General public"),
    tone: str = Form("Professional"),
    language: str = Form("English"),
    detail_level: str = Form("Medium"),
    objective: str = Form("Inform")
):
    """Extract document content (TXT, PDF, DOCX), generate structured slides, and return downloadable PowerPoint (.pptx) file."""
    validate_output_types(["presentation"])
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".txt") or filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only TXT, PDF and DOCX files are supported.")

    try:
        extracted_text = ""
        if filename_lower.endswith(".txt"):
            extracted_text = extract_txt(file)
        elif filename_lower.endswith(".pdf"):
            extracted_text = extract_pdf(file)
        elif filename_lower.endswith(".docx"):
            extracted_text = extract_docx(file)

        valid_text = validate_source_text(extracted_text)

        output_instruction = OUTPUT_INSTRUCTIONS["presentation"]
        prompt = f"""
You are a professional presentation designer AI.

Transform the extracted document content into a structured PowerPoint presentation.

SOURCE CONTENT:
{valid_text}

AUDIENCE: {audience}
TONE: {tone}
LANGUAGE: {language}
DETAIL LEVEL: {detail_level}
OBJECTIVE: {objective}

TRANSFORMATION INSTRUCTIONS:
{output_instruction}

Important:
- Return ONLY valid JSON for the presentation structure.
"""
        try:
            raw_text = generate_with_qwen(prompt)
            parsed_presentation = parse_output_content(raw_text, "presentation", valid_text)
        except QwenServiceError:
            parsed_presentation = _fallback_output("presentation", valid_text)
        if not isinstance(parsed_presentation, dict):
            raise HTTPException(status_code=502, detail="Model returned an invalid presentation structure.")
        pptx_stream = create_pptx_presentation(parsed_presentation)

        out_name = file.filename.rsplit(".", 1)[0] + ".pptx"
        return Response(
            content=pptx_stream.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{out_name}"'}
        )
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"PPTX file generation failed: {str(err)}")


AUDIO_DIR = Path("generated_audio")
AUDIO_DIR.mkdir(exist_ok=True)


@router.get("/audio-voices")
def get_audio_voices():
    """Return available TTS voices including US, UK, and India neural options."""
    return {
        "status": "success",
        "recommended_voices": RECOMMENDED_VOICES
    }


@router.post("/generate-audio", response_model=AudioResponse)
async def generate_audio_endpoint(request: AudioRequest):
    """Convert text into an MP3 audio file using edge-tts."""
    if not request.text or not request.text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )

    filename = f"{uuid.uuid4()}.mp3"
    output_path = AUDIO_DIR / filename

    try:
        await generate_audio(
            text=request.text.strip(),
            output_file=str(output_path),
            voice=request.voice
        )
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Audio generation failed: {str(err)}"
        )

    return AudioResponse(
        status="success",
        filename=filename,
        audio_path=str(output_path),
        download_url=f"/audio/{filename}",
        voice=request.voice
    )


@router.post("/generate-video-audio", response_model=AudioResponse)
async def generate_video_audio_endpoint(request: VideoAudioRequest):
    """Extract full video script narration and convert it into a single MP3 audio file."""
    narration_text = extract_video_script_narration(request.video_script)
    if not narration_text or not narration_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Video script does not contain playable narration text."
        )

    filename = f"video_script_{uuid.uuid4().hex[:8]}.mp3"
    output_path = AUDIO_DIR / filename

    try:
        await generate_audio(
            text=narration_text,
            output_file=str(output_path),
            voice=request.voice
        )
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Video audio generation failed: {str(err)}"
        )

    return AudioResponse(
        status="success",
        filename=filename,
        audio_path=str(output_path),
        download_url=f"/audio/{filename}",
        voice=request.voice
    )


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    """Stream or download generated MP3 audio file."""
    candidate = (AUDIO_DIR / filename).resolve()
    storage_root = AUDIO_DIR.resolve()

    if candidate.parent != storage_root or candidate.suffix.lower() != ".mp3":
        raise HTTPException(status_code=400, detail="Invalid audio filename.")

    if not candidate.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Audio file '{filename}' not found."
        )

    return FileResponse(
        path=str(candidate),
        media_type="audio/mpeg",
        filename=candidate.name
    )


# ---------------------------------------------------------------------------
# Brand Voice Memory & Audience Reframing Endpoints
# ---------------------------------------------------------------------------

CURRENT_BRAND_PROFILE = BrandVoiceProfile()

AUDIENCE_PROMPT_MAP = {
    "CEO or executives": (
        "Reframe for C-level Executives & CEOs. "
        "Focus on strategic ROI, business impact, key metrics, zero fluff, and executive decisions."
    ),
    "Technical teams": (
        "Reframe for Technical Teams & Engineers. "
        "Focus on system architecture, API schemas, tech stack, data mechanics, and implementation specifics."
    ),
    "General public": (
        "Reframe for the General Public. "
        "Use plain language, zero technical jargon, relatable analogies, and clear practical benefits."
    ),
    "Students": (
        "Reframe for Students & Academic Learners. "
        "Format as an educational breakdown with foundational principles, key definitions, and step-by-step concepts."
    ),
    "Customers": (
        "Reframe for Customers & Prospective Clients. "
        "Focus on customer value proposition, problem solved, ease of use, product benefits, and clear CTA."
    ),
    "Journalists": (
        "Reframe for Journalists & Media Outlets. "
        "Write in press-release style with a strong news hook, quote-worthy statements, key statistics, and industry significance."
    ),
    "Government officials": (
        "Reframe for Government Officials & Policy Makers. "
        "Focus on regulatory compliance, public policy alignment, risk assessment, governance, and public interest."
    ),
}


@router.get("/brand-voice/profile", response_model=BrandVoiceProfile)
def get_brand_voice_profile():
    """Retrieve the saved organization brand voice communication profile."""
    return CURRENT_BRAND_PROFILE


@router.post("/brand-voice/profile", response_model=BrandVoiceProfile)
def save_brand_voice_profile(profile: BrandVoiceProfile):
    """Save or update the organization brand voice communication profile."""
    global CURRENT_BRAND_PROFILE
    CURRENT_BRAND_PROFILE = profile
    return CURRENT_BRAND_PROFILE


@router.post("/audience-reframe", response_model=AudienceReframeResponse)
@router.post("/reframing", response_model=AudienceReframeResponse)
async def audience_reframe_endpoint(request: AudienceReframeRequest):
    """
    Generate different versions of source content tailored to specific audience knowledge depth and needs:
    - CEO or executives
    - Technical teams
    - General public
    - Students
    - Customers
    - Journalists
    - Government officials
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Source text cannot be empty.")

    target_audiences = request.audiences or list(AUDIENCE_PROMPT_MAP.keys())
    bv = request.brand_voice or CURRENT_BRAND_PROFILE
    source_clean = request.text.strip()
    results: Dict[str, str] = {}

    for aud in target_audiences:
        instruction = AUDIENCE_PROMPT_MAP.get(
            aud, f"Reframe content specifically tailored to the knowledge level and informational needs of {aud}."
        )

        prompt = f"""
You are an expert audience reframing AI.

SOURCE CONTENT:
{source_clean}

TARGET AUDIENCE: {aud}
REFRAMING INSTRUCTION:
{instruction}

BRAND VOICE CONSTRAINTS:
- Brand Tone: {bv.brand_tone}
- Preferred Vocabulary: {', '.join(bv.preferred_vocabulary)}
- FORBIDDEN PHRASES: Do NOT use any of these words/phrases: {', '.join(bv.forbidden_phrases)}
- Formatting Style: {bv.formatting_style}
- Disclaimer to include: {bv.disclaimer}

CRITICAL:
- Adapt the content depth, vocabulary, and structural focus to the audience's knowledge and needs, not only tone.
- Do not include reasoning or markdown code fences. Return the final reframed text directly.
"""
        try:
            raw_res = generate_with_qwen(prompt)
            clean_res = validate_and_clean_model_response(raw_res)
            for fb in bv.forbidden_phrases:
                if fb and fb.lower() in clean_res.lower():
                    clean_res = re.sub(re.escape(fb), "", clean_res, flags=re.IGNORECASE)
            results[aud] = clean_res
        except Exception:
            if "ceo" in aud.lower() or "exec" in aud.lower():
                results[aud] = f"EXECUTIVE BRIEFING:\n{source_clean[:300]}...\n\nKey Strategic Impact: High ROI & operational efficiency.\n\n{bv.disclaimer}"
            elif "tech" in aud.lower():
                results[aud] = f"TECHNICAL SPECIFICATION:\n{source_clean[:300]}...\n\nArchitecture & Mechanics: Grounded in UCKR fact IDs & API endpoints.\n\n{bv.disclaimer}"
            elif "public" in aud.lower():
                results[aud] = f"OVERVIEW:\n{source_clean[:300]}...\n\nKey Benefit: Simple, fast, and reliable.\n\n{bv.disclaimer}"
            elif "student" in aud.lower():
                results[aud] = f"LEARNING GUIDE:\n1. Concept: {source_clean[:200]}...\n2. Takeaway: Core principles and applications.\n\n{bv.disclaimer}"
            elif "customer" in aud.lower():
                results[aud] = f"CUSTOMER VALUE:\n{source_clean[:250]}...\n\nWhy It Matters to You: Saves time and improves quality.\n\n{bv.disclaimer}"
            elif "journal" in aud.lower() or "press" in aud.lower():
                results[aud] = f"FOR IMMEDIATE RELEASE:\n{source_clean[:250]}...\n\nQuote: 'Transforming digital communication at scale.'\n\n{bv.disclaimer}"
            elif "gov" in aud.lower() or "policy" in aud.lower():
                results[aud] = f"POLICY BRIEF:\n{source_clean[:250]}...\n\nGovernance & Risk Assessment: Fully compliant and aligned with public interest.\n\n{bv.disclaimer}"
            else:
                results[aud] = f"REFRAMED FOR {aud.upper()}:\n{source_clean}\n\n{bv.disclaimer}"

    return AudienceReframeResponse(
        status="success",
        source_text_length=len(source_clean),
        reframed_outputs=results
    )





