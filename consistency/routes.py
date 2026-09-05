import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Body, Request
from fastapi.responses import JSONResponse

from .schemas import (
    NormalizedSource,
    UCKR,
    OutputGenerationConfig,
    ExtractionRequest,
    ExtractionResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    GenerateDeliverablesRequest,
    GenerateDeliverablesResponse,
    ConsistencyAuditResult,
    DetailedValidationReport,
    UCKRDiff,
    SelectiveRegenerationResponse,
    QualityScoreRequest,
    ContentQualityReport,
    DeliverablesQualityReport
)
from .engine import ConsistencyEngine
from .fact_registry import get_registry, get_or_create_registry, FactRegistry
from .validators import ConsistencyValidator
from .repair import AutoRepairEngine
from .versioning import UCKRVersionManager
from .multilingual import LANGUAGE_REGISTRY, normalize_language_name, get_voice_for_language, MultilingualTransformer
from .quality_scorer import ContentQualityScorer

router = APIRouter(prefix="/consistency", tags=["Content Consistency Engine"])


@router.post("/extract", response_model=ExtractionResponse)
async def extract_endpoint(
    request: Request
):
    """
    Stage 1 & 2: Source Extraction Layer.
    Accepts PDF, DOCX, TXT, Image, Web URL, or Raw Text (JSON or Multipart Form)
    and converts it into a Normalized Source. Nothing is generated yet at this stage.
    """
    try:
        content_type = request.headers.get("content-type", "").lower()

        # Handle application/json
        if "application/json" in content_type:
            body = await request.json()
            raw_text = body.get("raw_text")
            url = body.get("url")
            title = body.get("title")

            if not raw_text and not url:
                raise HTTPException(status_code=400, detail="JSON body must contain 'raw_text' or 'url'.")

            normalized = ConsistencyEngine.extract(
                raw_text=raw_text,
                url=url,
                title=title
            )
            return ExtractionResponse(normalized_source=normalized)

        # Handle multipart/form-data or form-urlencoded
        form = await request.form()
        uploaded_file = form.get("file")
        raw_text = form.get("raw_text")
        url = form.get("url")
        title = form.get("title")

        if uploaded_file and hasattr(uploaded_file, "read"):
            file_bytes = await uploaded_file.read()
            filename = getattr(uploaded_file, "filename", "document")
            normalized = ConsistencyEngine.extract(
                file_bytes=file_bytes,
                filename=filename,
                title=str(title) if title else None
            )
            return ExtractionResponse(normalized_source=normalized)

        if raw_text or url:
            normalized = ConsistencyEngine.extract(
                raw_text=str(raw_text) if raw_text else None,
                url=str(url) if url else None,
                title=str(title) if title else None
            )
            return ExtractionResponse(normalized_source=normalized)

        raise HTTPException(
            status_code=400,
            detail="Must provide an uploaded file, raw_text, or url in request."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Source extraction failed: {str(e)}")


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    request: AnalyzeRequest
):
    """
    Stage 3 & 4: Content Understanding & Common Knowledge Representation Creation.
    Constructs the Unified Content Knowledge Representation (UCKR) containing atomic
    facts with IDs (F001, F002...), entities, claims, statistics, and relationships.
    """
    try:
        if request.normalized_source:
            uckr = ConsistencyEngine.analyze(request.normalized_source)
            return AnalyzeResponse(uckr=uckr)

        if request.raw_text:
            normalized = ConsistencyEngine.extract(raw_text=request.raw_text, title=request.title)
            uckr = ConsistencyEngine.analyze(normalized)
            return AnalyzeResponse(uckr=uckr)

        raise HTTPException(status_code=400, detail="Must provide either normalized_source or raw_text.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"UCKR knowledge analysis failed: {str(e)}")


@router.get("/registry/{source_id}/facts")
async def get_registry_facts_endpoint(
    source_id: str,
    q: Optional[str] = Query(None, description="Search term for filtering facts"),
    min_importance: Optional[float] = Query(None, description="Filter by minimum importance (e.g. 0.85)")
):
    """
    Stage 5 & 6: Central Fact Registry Query.
    Look up facts, verify integrity, or search atomic facts by ID, keyword, or importance.
    """
    registry = get_registry(source_id)
    if not registry:
        raise HTTPException(
            status_code=404,
            detail=f"No Fact Registry found for source_id '{source_id}'. Analyze a source first."
        )

    if q:
        facts = registry.search_facts(q)
    elif min_importance is not None:
        facts = registry.get_critical_facts(min_importance)
    else:
        facts = registry.list_facts()

    return {
        "source_id": source_id,
        "total_facts": len(registry.list_facts()),
        "returned_facts_count": len(facts),
        "facts": [f.model_dump() for f in facts]
    }


@router.post("/generate", response_model=GenerateDeliverablesResponse)
async def generate_deliverables_endpoint(
    request: GenerateDeliverablesRequest
):
    """
    Stage 7: Fact-Grounded Output Generation.
    Generates multi-channel deliverables (Summary, LinkedIn, Presentation, Video, etc.)
    with explicit attribution to UCKR fact IDs and performs a consistency audit.
    """
    try:
        results = ConsistencyEngine.generate_deliverables(
            uckr=request.uckr,
            config=request.config or OutputGenerationConfig()
        )
        return GenerateDeliverablesResponse(
            source_id=results["source_id"],
            outputs=results["outputs"],
            consistency_audit=results["consistency_audit"],
            validation_report=results.get("validation_report"),
            repair_result=results.get("repair_result"),
            quality_report=results.get("quality_report")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deliverable generation failed: {str(e)}")


@router.post("/pipeline")
async def full_pipeline_endpoint(
    request: Request
):
    """
    Full 7-Step Content Consistency Pipeline (End-to-End):
    1. Ingestion (File/Text/URL via JSON or Multipart Form)
    2. Source Extraction Layer -> NormalizedSource
    3. Content Understanding Layer via LLM
    4. Unified Content Knowledge Representation (UCKR) Construction
    5. Fact ID Attribution System (F001, F002...)
    6. Central Fact Registry Integration
    7. Multi-Channel Grounded Generation (Summary, LinkedIn, Presentation, Video) + Consistency Audit
    """
    try:
        content_type = request.headers.get("content-type", "").lower()

        file_bytes = None
        filename = None
        raw_text = None
        url = None
        title = None
        output_types = "summary,linkedin,presentation,video"
        audience = "Professional"
        tone = "Authoritative"
        language = "English"
        slide_count = 4
        video_duration = 30

        if "application/json" in content_type:
            body = await request.json()
            raw_text = body.get("raw_text")
            url = body.get("url")
            title = body.get("title")
            output_types = body.get("output_types", output_types)
            audience = body.get("audience", audience)
            tone = body.get("tone", tone)
            language = body.get("language") or body.get("target_language") or language
            slide_count = int(body.get("slide_count", slide_count))
            video_duration = int(body.get("video_duration", video_duration))
        else:
            form = await request.form()
            uploaded_file = form.get("file")
            raw_text = form.get("raw_text")
            url = form.get("url")
            title = form.get("title")
            output_types = form.get("output_types", output_types)
            audience = form.get("audience", audience)
            tone = form.get("tone", tone)
            if form.get("language") or form.get("target_language"):
                language = str(form.get("language") or form.get("target_language"))
            if form.get("slide_count"):
                slide_count = int(form.get("slide_count"))
            if form.get("video_duration"):
                video_duration = int(form.get("video_duration"))

            if uploaded_file and hasattr(uploaded_file, "read"):
                file_bytes = await uploaded_file.read()
                filename = getattr(uploaded_file, "filename", "document")

        if not file_bytes and not raw_text and not url:
            raise HTTPException(status_code=400, detail="Must provide a file, raw_text, or url.")

        types_list = [t.strip() for t in (output_types or "summary,linkedin").split(",") if t.strip()]
        config = OutputGenerationConfig(
            output_types=types_list,
            audience=str(audience),
            tone=str(tone),
            language=str(language),
            slide_count=slide_count,
            video_duration=video_duration
        )

        result = ConsistencyEngine.process_pipeline(
            file_bytes=file_bytes,
            filename=filename,
            raw_text=str(raw_text) if raw_text else None,
            url=str(url) if url else None,
            title=str(title) if title else None,
            config=config
        )
        return JSONResponse(status_code=200, content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {str(e)}")


@router.get("/languages")
async def list_supported_languages():
    """
    Step 20: Multilingual Transformation Language Registry.
    Lists all supported Indian & global languages, native scripts, and default Edge TTS neural voices.
    """
    return {
        "status": "success",
        "supported_languages_count": len(LANGUAGE_REGISTRY),
        "languages": LANGUAGE_REGISTRY
    }


@router.post("/translate")
async def translate_endpoint(
    target_language: str = Body(..., embed=True),
    uckr: Optional[UCKR] = Body(None, embed=True),
    outputs: Optional[Dict[str, Any]] = Body(None, embed=True)
):
    """
    Step 20: Multi-Language Deliverables & UCKR Translation.
    Transforms grounded deliverables (Summary, LinkedIn, Slides, Video storyboard/narration)
    and/or UCKR into Indian languages (Tamil, Hindi, Telugu, Malayalam, etc.) while preserving
    atomic Fact IDs (F001, F002) and numeric precision.
    """
    try:
        norm_lang = normalize_language_name(target_language)
        translated_uckr = None
        translated_outputs = None

        if uckr:
            translated_uckr = MultilingualTransformer.translate_uckr(uckr, target_language).model_dump()

        if outputs:
            translated_outputs = MultilingualTransformer.translate_deliverables(
                outputs=outputs,
                target_language=target_language,
                uckr=uckr
            )

        return {
            "status": "success",
            "target_language": target_language,
            "normalized_language": norm_lang,
            "recommended_voice": get_voice_for_language(target_language),
            "translated_uckr": translated_uckr,
            "translated_outputs": translated_outputs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multilingual translation failed: {str(e)}")


@router.post("/audit")
async def audit_endpoint(
    source_id: str = Body(..., embed=True),
    outputs: Dict[str, Any] = Body(..., embed=True)
):
    """
    Audit arbitrary outputs against the Fact Registry for a given source_id.
    """
    registry = get_registry(source_id)
    if not registry:
        raise HTTPException(status_code=404, detail=f"Fact Registry for '{source_id}' not found.")

    audit_result = registry.audit_deliverables(outputs)
    return audit_result.model_dump()


@router.post("/validate", response_model=DetailedValidationReport)
async def validate_endpoint(
    uckr: UCKR = Body(...),
    outputs: Dict[str, Any] = Body(...)
):
    """
    Steps 12-17: Detailed Multi-Dimensional Consistency Validation.
    Computes Fact, Numeric, Entity, Semantic, Claim, and Cross-Output breakdown scores.
    """
    try:
        registry = get_or_create_registry(uckr)
        audit = registry.audit_deliverables(outputs)
        report = ConsistencyValidator.validate_all(
            uckr=uckr,
            outputs=outputs,
            fact_matrix=audit.traceability_matrix
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.post("/repair")
async def repair_endpoint(
    uckr: UCKR = Body(...),
    outputs: Dict[str, Any] = Body(...)
):
    """
    Step 18: Automatic Repair Engine.
    Detects numeric, entity, or claim inconsistencies and performs automated targeted repairs.
    """
    try:
        registry = get_or_create_registry(uckr)
        audit = registry.audit_deliverables(outputs)
        initial_report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

        repaired_outputs, repair_res, final_report = AutoRepairEngine.repair_outputs(
            uckr=uckr,
            outputs=outputs,
            report=initial_report,
            fact_matrix=audit.traceability_matrix
        )

        return {
            "status": "success",
            "repaired_outputs": repaired_outputs,
            "repair_result": repair_res.model_dump(),
            "final_validation_report": final_report.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Repair failed: {str(e)}")


@router.post("/diff", response_model=UCKRDiff)
async def diff_endpoint(
    v1: UCKR = Body(...),
    v2: UCKR = Body(...)
):
    """
    Step 19: Diffs two versions of UCKR to detect added, changed, and deleted facts.
    """
    try:
        diff_result = UCKRVersionManager.diff_uckr(v1, v2)
        return diff_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diff calculation failed: {str(e)}")


@router.post("/regenerate-affected", response_model=SelectiveRegenerationResponse)
async def regenerate_affected_endpoint(
    uckr_v2: UCKR = Body(...),
    diff: UCKRDiff = Body(...),
    previous_outputs: Dict[str, Any] = Body(...),
    config: Optional[OutputGenerationConfig] = Body(None)
):
    """
    Step 19: Incremental Selective Regeneration.
    Regenerates only the deliverables affected by changed/added facts without touching unaffected outputs.
    """
    try:
        return UCKRVersionManager.selective_regenerate(
            uckr_v2=uckr_v2,
            diff=diff,
            previous_outputs=previous_outputs,
            config=config
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Selective regeneration failed: {str(e)}")


@router.post("/quality-score")
async def quality_score_endpoint(
    request: QualityScoreRequest
):
    """
    AI Content Quality Scoring Engine:
    Evaluates text or generated multi-channel deliverables across 6 quantitative dimensions:
    - Readability & Clarity (Flesch Reading Ease & Grade Level)
    - Engagement & Hook Strength
    - Information Density & Conciseness (metric ratio & filler reduction)
    - Tone & Audience Alignment
    - Structural Coherence & Flow
    - Fact Grounding & Attribution Index
    Outputs numerical scores (0-100), letter grades (A+, A, B, C), key strengths, and improvement suggestions.
    """
    try:
        if request.outputs:
            report = ContentQualityScorer.evaluate_deliverables(
                outputs=request.outputs,
                uckr=request.uckr,
                target_audience=request.target_audience,
                target_tone=request.target_tone
            )
            return report.model_dump()

        if request.text:
            report = ContentQualityScorer.evaluate_text(
                text=request.text,
                channel="text",
                uckr=request.uckr,
                target_audience=request.target_audience,
                target_tone=request.target_tone
            )
            return report.model_dump()

        raise HTTPException(
            status_code=400,
            detail="Must provide either 'text' or 'outputs' in the QualityScoreRequest."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content quality scoring failed: {str(e)}")
