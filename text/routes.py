import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from typing import Optional, List

from .qwen_service import QwenServiceError, generate_with_qwen
from .document_extractor import extract_txt, extract_pdf, extract_docx
from .schemas import TextRequest, TextResponse, FileTextResponse
from .pptx_generator import create_pptx_presentation

router = APIRouter(tags=["Text Transformation"])

OUTPUT_INSTRUCTIONS = {
    "linkedin": """
Create a professional LinkedIn post.
Use an engaging opening, clear paragraphs, and relevant hashtags.
Do not mention that you are an AI.
""",

    "twitter": """
Create a concise X/Twitter post or thread.
Keep the content short, engaging, and easy to read.
Use hashtags only when useful.
""",

    "summary": """
Create a clear executive summary.
Include the most important information, key points, and conclusions.
Avoid unnecessary details.
""",

    "advisory": """
Create a professional advisory.
Clearly explain the situation, important information, potential impact,
and recommended actions.
""",

    "presentation": """
Create structured content for a PowerPoint presentation.
Return ONLY valid JSON (no markdown formatting, no code fences) with exactly this structure:
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
Return ONLY valid JSON (no markdown formatting, no code fences) with exactly these keys:
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
Return ONLY valid JSON (no markdown formatting, no code fences) with exactly these keys:
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
    """Parse generated text into structured dict if infographic, video_script, presentation, or valid JSON, else return raw string."""
    ot_lower = output_type.lower()
    if ot_lower not in ["infographic", "video_script", "presentation"]:
        return generated_text

    cleaned = generated_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").removeprefix("json").removesuffix("```").strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            if ot_lower == "infographic":
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
                return data
            elif ot_lower == "video_script":
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
                if isinstance(data.get("storyboard"), list):
                    sb_keys = ["scene", "duration", "visuals", "narration", "on_screen_text", "subtitle", "transition"]
                    for idx, scene in enumerate(data["storyboard"], 1):
                        if isinstance(scene, dict):
                            for sb_k in sb_keys:
                                if sb_k not in scene:
                                    scene[sb_k] = idx if sb_k == "scene" else ""
                return data
            elif ot_lower == "presentation":
                if "presentation_title" not in data and "title" in data:
                    data["presentation_title"] = data["title"]
                if "slides" not in data or not isinstance(data["slides"], list):
                    data["slides"] = []
                for idx, s in enumerate(data["slides"], 1):
                    if isinstance(s, dict):
                        s.setdefault("slide_number", idx)
                        s.setdefault("title", f"Slide {idx}")
                        s.setdefault("layout", "bullet_points")
                        s.setdefault("content", [])
                        s.setdefault("speaker_notes", "")
                        s.setdefault("visual_recommendation", "")
                return data
    except Exception:
        pass

    if ot_lower == "infographic":
        return {
            "title": "Infographic Summary",
            "main_message": generated_text[:150] if len(generated_text) > 150 else generated_text,
            "key_statistics": [],
            "sections": [{"heading": "Key Highlights", "content": generated_text}],
            "supporting_text": generated_text,
            "visual_hierarchy": "Primary focus on Title and Main Message, followed by Key Highlights.",
            "icon_recommendations": ["chart", "lightbulb"],
            "color_recommendations": ["Primary", "Accent", "Background"],
            "layout_recommendation": "Single-column vertical stack layout with highlighted stats."
        }
    elif ot_lower == "video_script":
        return {
            "video_title": "Video Overview",
            "duration": "60 seconds",
            "storyboard": [
                {
                    "scene": 1,
                    "duration": "0-60 sec",
                    "visuals": "Presenter or dynamic graphics illustrating the content.",
                    "narration": generated_text,
                    "on_screen_text": "Key Highlights",
                    "subtitle": generated_text,
                    "transition": "Fade Out"
                }
            ],
            "music_recommendation": "Uplifting ambient background music",
            "voice_over_direction": "Professional, engaging, and clear delivery",
            "thumbnail_recommendation": "High contrast headline text with modern tech graphic"
        }
    elif ot_lower == "presentation":
        return {
            "presentation_title": "Executive Presentation",
            "subtitle": "Overview and Summary",
            "slides": [
                {
                    "slide_number": 1,
                    "title": "Executive Presentation",
                    "layout": "title",
                    "subtitle": "Overview and Summary",
                    "speaker_notes": "Welcome to the presentation."
                },
                {
                    "slide_number": 2,
                    "title": "Key Highlights",
                    "layout": "bullet_points",
                    "content": [line.strip() for line in generated_text.split("\n") if line.strip()][:5],
                    "speaker_notes": generated_text,
                    "visual_recommendation": "Bullet list with modern icon callouts"
                }
            ]
        }


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
    target_types = request.output_types or [request.output_type or "summary"]
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
{request.text}

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

Important:
- Preserve factual information from the source.
- Do not invent important facts.
- Follow the requested language.
- Follow the requested tone and audience.
- Return only the transformed content.
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

    try:
        if filename.endswith(".txt"):
            extracted_text = extract_txt(file)
        elif filename.endswith(".pdf"):
            extracted_text = extract_pdf(file)
        elif filename.endswith(".docx"):
            extracted_text = extract_docx(file)

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="The uploaded file contains no extractable text."
            )

        target_types = resolve_form_output_types(output_type, output_types)
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
{extracted_text}

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
            extracted_text=extracted_text,
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
    output_instruction = OUTPUT_INSTRUCTIONS["presentation"]
    prompt = f"""
You are a professional presentation designer AI.

Transform the source content into a structured PowerPoint presentation.

SOURCE CONTENT:
{request.text}

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

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="The uploaded file contains no extractable text.")

        output_instruction = OUTPUT_INSTRUCTIONS["presentation"]
        prompt = f"""
You are a professional presentation designer AI.

Transform the extracted document content into a structured PowerPoint presentation.

SOURCE CONTENT:
{extracted_text}

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


