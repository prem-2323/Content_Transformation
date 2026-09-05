import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from typing import Optional, List

from .qwen_service import QwenServiceError, generate_with_qwen
from .document_extractor import extract_txt, extract_pdf, extract_docx
from .schemas import TextRequest, TextResponse, FileTextResponse
from .pptx_generator import create_pptx_presentation
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


def parse_output_content(generated_text: str, output_type: str):
    """Clean reasoning leakage, validate model response, and parse structured output if required."""
    cleaned_text = validate_and_clean_model_response(generated_text)
    ot_lower = output_type.lower()

    # Parse JSON payload
    parsed_json = extract_json_payload(generated_text)

    # 1. Text Deliverables (linkedin, twitter, summary, advisory)
    if ot_lower in ["linkedin", "twitter", "summary", "advisory"]:
        final_text = cleaned_text
        if isinstance(parsed_json, dict) and "content" in parsed_json and isinstance(parsed_json["content"], str):
            final_text = parsed_json["content"].strip()
            
        final_text = validate_and_clean_model_response(final_text)
        if ot_lower == "twitter":
            return validate_and_format_twitter(final_text)
        return final_text

    # 2. Structured Deliverables (infographic, video_script, presentation)
    if isinstance(parsed_json, dict):
        if ot_lower == "infographic":
            return validate_and_format_infographic(parsed_json)
        elif ot_lower == "video_script":
            return validate_and_format_video_script(parsed_json)
        elif ot_lower == "presentation":
            return validate_and_format_presentation(parsed_json)

    # Structured fallbacks if raw text wasn't valid JSON
    if ot_lower == "infographic":
        return validate_and_format_infographic({"main_message": cleaned_text[:150], "supporting_text": cleaned_text})
    elif ot_lower == "video_script":
        return validate_and_format_video_script({"video_title": "Video Overview", "storyboard": [{"scene": 1, "duration": "0-60 sec", "visuals": "Overview", "narration": cleaned_text, "on_screen_text": "Overview", "subtitle": cleaned_text, "transition": "Fade Out"}]})
    elif ot_lower == "presentation":
        return validate_and_format_presentation({"presentation_title": "Executive Presentation", "slides": [{"slide_number": 1, "title": "Overview", "layout": "bullet_points", "content": [cleaned_text]}]})

    return cleaned_text


def resolve_form_output_types(output_type: Optional[str] = None, output_types: Optional[str] = None) -> List[str]:
    """Parse output_types form input (comma separated or JSON list) or fallback to output_type."""
    if output_types:
        raw = output_types.strip()
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if item]
            except Exception:
                pass
        return [item.strip() for item in raw.split(",") if item.strip()]
    if output_type:
        return [output_type.strip()]
    return ["summary"]


@router.post("/transform", response_model=TextResponse)
def transform(request: TextRequest):
    """Transform direct text input into selected output formats using Qwen3 4B."""
    valid_text = validate_source_text(request.text)
    raw_requested = request.output_types or [request.output_type or "summary"]
    target_types = validate_output_types(raw_requested)
    outputs_dict = {}

    for ot in target_types:
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
            outputs_dict[ot] = parse_output_content(generated_text, ot)
        except QwenServiceError as error:
            raise HTTPException(status_code=504, detail=str(error)) from error

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
    output_type: Optional[str] = Form(None),
    output_types: Optional[str] = Form(None, description="Comma-separated or JSON list of output types, e.g. summary,linkedin"),
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

            generated_text = generate_with_qwen(prompt)
            outputs_dict[ot] = parse_output_content(generated_text, ot)

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
"""
    try:
        raw_text = generate_with_qwen(prompt)
        parsed_presentation = parse_output_content(raw_text, "presentation")
        pptx_stream = create_pptx_presentation(parsed_presentation)
    except QwenServiceError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
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
        raw_text = generate_with_qwen(prompt)
        parsed_presentation = parse_output_content(raw_text, "presentation")
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



