from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

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
"""
}


@router.post("/transform", response_model=TextResponse)
def transform(request: TextRequest):
    """Transform direct text input into selected output format using Qwen3 4B."""
    output_instruction = OUTPUT_INSTRUCTIONS.get(
        request.output_type.lower(),
        OUTPUT_INSTRUCTIONS["summary"]
    )

    prompt = f"""
You are a professional content transformation AI.

Transform the source content according to the user's requirements.

SOURCE CONTENT:
{request.text}

OUTPUT TYPE:
{request.output_type}

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
    except QwenServiceError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error

    return TextResponse(
        output_type=request.output_type,
        audience=request.audience,
        tone=request.tone,
        language=request.language,
        detail_level=request.detail_level,
        objective=request.objective,
        generated_content=generated_text
    )


@router.post("/transform-file", response_model=FileTextResponse)
async def transform_file(
    file: UploadFile = File(...),
    output_type: str = Form("summary"),
    audience: str = Form("General public"),
    tone: str = Form("Professional"),
    language: str = Form("English"),
    detail_level: str = Form("Medium"),
    objective: str = Form("Inform")
):
    """Extract document content (TXT, PDF, DOCX) and transform into selected output format."""
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

        output_instruction = OUTPUT_INSTRUCTIONS.get(
            output_type.lower(),
            OUTPUT_INSTRUCTIONS["summary"]
        )

        prompt = f"""
You are a professional content transformation AI.

Transform the extracted document content according to the user's requirements.

SOURCE CONTENT:
{extracted_text}

OUTPUT TYPE:
{output_type}

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

        return FileTextResponse(
            filename=file.filename,
            output_type=output_type,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective,
            extracted_text=extracted_text,
            generated_content=generated_text
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
