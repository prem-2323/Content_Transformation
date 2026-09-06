from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from .image_processor import validate_image, load_image
from .gemma_model import GemmaModel
from .schemas import VisualResponse, VisualTask

router = APIRouter(
    prefix="/visual",
    tags=["Visual AI"]
)

gemma = GemmaModel()
SUPPORTED_TASKS = {task.value for task in VisualTask}


@router.post("/analyze", response_model=VisualResponse)
async def analyze_image(
    image: UploadFile = File(..., description="Uploaded image file (JPG, JPEG, PNG)"),
    prompt: str = Form("Analyze this image", description="Prompt or query for image analysis"),
    task: VisualTask = Form(VisualTask.description, description="Analysis task (description, ocr, objects, summary, caption, qa, chart, scene)")
):
    """Analyze image using Gemma 3 4B (OCR, Object detection, Scene description, Summary, Caption, QA, Chart parse, Scene+sentiment)."""
    try:
        task_str = task.value

        if task_str not in SUPPORTED_TASKS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported task. Choose one of: {', '.join(sorted(SUPPORTED_TASKS))}."
            )

        # 1. Validate image format
        validate_image(image.content_type, image.filename)

        # 2. Read image bytes
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Empty image file."
            )

        # 3. Convert to PIL image
        pil_image = load_image(image_bytes)

        # 4. Process image with Gemma
        res = await gemma.analyze_image(
            pil_image,
            prompt,
            task_str
        )

        # 5. Return structured response conforming to Visual AI Extraction Rules
        return VisualResponse(
            success=res.get("success", True),
            task=task_str,
            result=res.get("result", res),
            evidence=res.get("evidence", []),
            warnings=res.get("warnings", []),
            status="success",
            message="Image analyzed successfully."
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
