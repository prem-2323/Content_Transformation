import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List

from .qwen_service import QwenServiceError, generate_with_qwen
from .document_extractor import extract_txt, extract_pdf, extract_docx
from .schemas import TextRequest, TextResponse, FileTextResponse

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
Create presentation-ready content.
Organize the information into a title and clear slide-wise bullet points.
Keep each slide concise.
""",

    "video_script": """
Create a video script.
Include a hook, main content, transitions, and a conclusion.
Make it natural for spoken narration.
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
    """Parse generated text into structured dict if infographic or valid JSON, else return raw string."""
    if output_type.lower() != "infographic":
        return generated_text

    cleaned = generated_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").removeprefix("json").removesuffix("```").strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
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
    except Exception:
        pass

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

