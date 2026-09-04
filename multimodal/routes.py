from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from .schemas import MultimodalResponse
from .extractor import extract_pdf_text_and_images
from .service import process_multimodal_content
from text.qwen_service import QwenServiceError

router = APIRouter(
    prefix="/multimodal",
    tags=["Multimodal Transformation"]
)


@router.post("/transform-pdf", response_model=MultimodalResponse)
async def transform_multimodal_pdf(
    file: UploadFile = File(..., description="PDF document containing text and/or embedded images"),
    output_type: str = Form("summary", description="Target output type: linkedin, twitter, summary, advisory, presentation, video_script"),
    audience: str = Form("General public"),
    tone: str = Form("Professional"),
    language: str = Form("English"),
    detail_level: str = Form("Medium"),
    objective: str = Form("Inform")
):
    """Extract both text and embedded images from a PDF, run Qwen3 + Gemma3, and produce a unified content output."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported by /multimodal/transform-pdf.")

    try:
        text, images = extract_pdf_text_and_images(file)

        if not text.strip() and not images:
            raise HTTPException(status_code=400, detail="Uploaded PDF contains neither readable text nor embedded images.")

        results = await process_multimodal_content(
            text=text,
            images=images,
            output_type=output_type,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective
        )

        return MultimodalResponse(
            filename=file.filename,
            output_type=output_type,
            audience=audience,
            tone=tone,
            language=language,
            detail_level=detail_level,
            objective=objective,
            extracted_text=text,
            extracted_images_count=len(images),
            text_analysis_qwen=results["text_analysis_qwen"],
            image_analysis_gemma=results["image_analysis_gemma"],
            final_combined_output=results["final_combined_output"]
        )

    except QwenServiceError as err:
        raise HTTPException(status_code=504, detail=str(err)) from err
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Multimodal transformation failed: {str(err)}")
