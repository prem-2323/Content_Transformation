from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from text.routes import router as text_router
from visual.routes import router as visual_router
from multimodal.routes import router as multimodal_router

app = FastAPI(
    title="Gen AI Platform for Automated Content Transformation",
    description="Unified AI platform integrating Qwen3 4B for text transformation, Gemma 3 4B for visual analysis, and Multimodal pipeline for PDF text+image extraction.",
    version="1.0.0",
    openapi_version="3.0.3",
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={
        "deepLinking": True,
        "displayRequestDuration": True,
        "defaultModelsExpandDepth": 1,
    }
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


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "Gen AI Content Transformation Platform is active",
        "models": {
            "text": "Qwen3 4B (via Ollama)",
            "visual": "Gemma 3 4B (via Ollama)"
        },
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
