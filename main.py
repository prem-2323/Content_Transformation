from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from text.routes import router as text_router
from visual.routes import router as visual_router
from visual.routes import gemma as visual_gemma
from multimodal.routes import router as multimodal_router
from multimodal.service import gemma_model as multimodal_gemma
from image.routes import router as image_router
from video.routes import router as video_router
from consistency.routes import router as consistency_router
from results.routes import router as results_router
from ai_chat.routes import router as ai_chat_router


async def close_gemma_clients():
    await visual_gemma.close()
    if multimodal_gemma is not visual_gemma:
        await multimodal_gemma.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await close_gemma_clients()


app = FastAPI(
    title="Gen AI Platform for Automated Content Transformation",
    description=(
        "Unified AI platform integrating Qwen3 4B for text transformation, "
        "Gemma 3 4B for visual analysis, Multimodal pipeline for PDF text+image extraction, "
        "Video generation pipeline (Qwen3 → Forge SD1.5 → Edge TTS → FFmpeg), "
        "and a Full Content Consistency Engine (UCKR + Atomic Fact IDs + Registry + Grounded Generators)."
    ),
    version="1.2.0",
    openapi_version="3.0.3",
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={
        "deepLinking": True,
        "displayRequestDuration": True,
        "defaultModelsExpandDepth": 1,
    },
    lifespan=lifespan,
)

# Enable CORS for frontend / dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(text_router)
app.include_router(visual_router)
app.include_router(multimodal_router)
app.include_router(image_router)
app.include_router(video_router)
app.include_router(consistency_router)
app.include_router(results_router)
app.include_router(ai_chat_router)


MODEL_NAMES = ("qwen3:4b", "gemma3:4b", "stable-diffusion", "edge-tts")


@app.get("/models")
@app.get("/v1/models")
def list_models():
    """Expose the locally configured models for client discovery."""
    return {
        "object": "list",
        "data": [
            {
                "id": model_name,
                "object": "model",
                "owned_by": "ollama",
            }
            for model_name in MODEL_NAMES
        ],
    }


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "Gen AI Content Transformation Platform is active",
        "models": {
            "text": "Qwen3 4B (via Ollama)",
            "visual": "Gemma 3 4B (via Ollama)",
            "image_generation": "Stable Diffusion (via Forge WebUI API)",
            "tts": "Edge TTS (Microsoft)",
            "video": "FFmpeg + SD1.5 + Edge TTS pipeline",
            "consistency_engine": "UCKR + Fact Registry + Grounded Multi-Channel Generators"
        },
        "endpoints": {
            "consistency_pipeline": "POST /consistency/pipeline",
            "consistency_extract": "POST /consistency/extract",
            "consistency_analyze": "POST /consistency/analyze",
            "consistency_generate": "POST /consistency/generate",
            "consistency_quality_score": "POST /consistency/quality-score",
            "consistency_evidence": "POST /consistency/evidence",
            "consistency_health": "GET /consistency/health",
            "consistency_registry": "GET /consistency/registry/{source_id}/facts",
            "generate_video": "POST /video/generate-video",
            "get_video": "GET /video/{filename}",
            "generate_image": "POST /generate-image",
            "docs": "/docs",
        },
        "consistency_architecture": "SOURCE -> Common Knowledge Representation (UCKR) -> LinkedIn/Slides/Video -> Consistency Check -> Quality Score",
        "consistency_fast_mode": "Append ?fast=true to /consistency/analyze, /generate, /pipeline for instant deterministic fallback (no LLM wait)",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
