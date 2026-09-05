import logging
from typing import Dict, Any, Optional, List, Union

from .schemas import (
    NormalizedSource,
    UCKR,
    OutputGenerationConfig,
    ConsistencyAuditResult,
    DetailedValidationReport,
    AutoRepairResult
)
from .extractor import extract_source
from .analyzer import analyze_source_and_build_uckr
from .fact_registry import get_or_create_registry, FactRegistry
from .validators import ConsistencyValidator
from .repair import AutoRepairEngine
from .versioning import get_version_manager
from .generators import (
    SummaryGenerator,
    LinkedInGenerator,
    PresentationGenerator,
    VideoGenerator,
    TwitterGenerator,
    AdvisoryGenerator
)

logger = logging.getLogger(__name__)


class ConsistencyEngine:
    """
    Full Content Consistency Engine Process (Steps 1 through 22):
    - Multi-source Extraction Layer (PDF/DOCX/TXT/Web/Image/Raw text)
    - Content Understanding via Qwen3 4B
    - Unified Content Knowledge Representation (UCKR) with Versioning
    - Atomic Fact ID indexing (F001, F002, ...)
    - Central Fact Registry
    - Grounded Multi-Channel Generators with Sentence-Level Provenance
    - Deep Consistency Validation (Numeric, Entity, Semantic, Claim, Cross-Output)
    - Automated Repair Loop
    - Traceability & Audit Matrix
    """

    @classmethod
    def extract(
        cls,
        file_bytes: Optional[bytes] = None,
        filename: Optional[str] = None,
        raw_text: Optional[str] = None,
        url: Optional[str] = None,
        title: Optional[str] = None
    ) -> NormalizedSource:
        """Stage 1 & 2: Ingestion & Extraction Layer -> NormalizedSource."""
        return extract_source(
            file_bytes=file_bytes,
            filename=filename,
            raw_text=raw_text,
            url=url,
            title=title
        )

    @classmethod
    def analyze(cls, source: NormalizedSource) -> UCKR:
        """Stage 3 & 4: Content Understanding & Common Knowledge Representation (UCKR)."""
        uckr = analyze_source_and_build_uckr(source)
        # Save version
        get_version_manager().save_version(uckr)
        # Register in central fact registry
        get_or_create_registry(uckr)
        return uckr

    @classmethod
    def generate_deliverables(
        cls,
        uckr: UCKR,
        config: Optional[OutputGenerationConfig] = None
    ) -> Dict[str, Any]:
        """
        Stage 5 through 18:
        Fact-Grounded Generation -> Provenance -> Multi-Validator -> Auto Repair.
        """
        cfg = config or OutputGenerationConfig()
        registry = get_or_create_registry(uckr)

        outputs: Dict[str, Any] = {}

        for ot in cfg.output_types:
            ot_lower = ot.lower().strip()
            if ot_lower in ["summary", "executive_summary"]:
                outputs["summary"] = SummaryGenerator.generate(uckr, cfg).model_dump()
            elif ot_lower in ["linkedin", "linkedin_post"]:
                outputs["linkedin"] = LinkedInGenerator.generate(uckr, cfg).model_dump()
            elif ot_lower in ["presentation", "slides", "pptx"]:
                outputs["presentation"] = PresentationGenerator.generate(uckr, cfg).model_dump()
            elif ot_lower in ["video", "video_script", "storyboard"]:
                outputs["video"] = VideoGenerator.generate(uckr, cfg).model_dump()
            elif ot_lower in ["twitter", "x", "thread"]:
                outputs["twitter"] = TwitterGenerator.generate(uckr, cfg).model_dump()
            elif ot_lower in ["advisory", "briefing"]:
                outputs["advisory"] = AdvisoryGenerator.generate(uckr, cfg).model_dump()

        # Perform initial consistency audit & traceability matrix
        audit_result: ConsistencyAuditResult = registry.audit_deliverables(outputs)

        # Deep Validation across all dimensions (Numeric, Entity, Semantic, Claim, Cross-Output)
        validation_report: DetailedValidationReport = ConsistencyValidator.validate_all(
            uckr=uckr,
            outputs=outputs,
            fact_matrix=audit_result.traceability_matrix
        )

        repair_result = None
        # Step 18: Automatic Repair if validation found violations or score < threshold
        if cfg.auto_repair and (not validation_report.passed or validation_report.violations):
            repaired_outputs, repair_res, updated_report = AutoRepairEngine.repair_outputs(
                uckr=uckr,
                outputs=outputs,
                report=validation_report,
                fact_matrix=audit_result.traceability_matrix
            )
            outputs = repaired_outputs
            validation_report = updated_report
            repair_result = repair_res.model_dump()
            # Update audit
            audit_result = registry.audit_deliverables(outputs)

        # Step 20: Multilingual Transformation if target language != English
        if cfg.language and cfg.language.strip().lower() not in ["english", "en"]:
            from .multilingual import MultilingualTransformer
            outputs = MultilingualTransformer.translate_deliverables(
                outputs=outputs,
                target_language=cfg.language,
                uckr=uckr
            )

        # Step 22: AI Content Quality Scoring across 6 dimensions
        from .quality_scorer import ContentQualityScorer
        quality_report = ContentQualityScorer.evaluate_deliverables(
            outputs=outputs,
            uckr=uckr,
            target_audience=cfg.audience,
            target_tone=cfg.tone
        ).model_dump()

        return {
            "source_id": uckr.document.id,
            "document_title": uckr.document.title,
            "language": cfg.language,
            "outputs": outputs,
            "consistency_audit": audit_result.model_dump(),
            "validation_report": validation_report.model_dump(),
            "repair_result": repair_result,
            "quality_report": quality_report
        }

    @classmethod
    def process_pipeline(
        cls,
        file_bytes: Optional[bytes] = None,
        filename: Optional[str] = None,
        raw_text: Optional[str] = None,
        url: Optional[str] = None,
        title: Optional[str] = None,
        config: Optional[OutputGenerationConfig] = None
    ) -> Dict[str, Any]:
        """Full end-to-end processing pipeline."""
        # 1 & 2: Extract
        normalized_source = cls.extract(
            file_bytes=file_bytes,
            filename=filename,
            raw_text=raw_text,
            url=url,
            title=title
        )

        # 3 & 4: Understand & Build UCKR
        uckr = cls.analyze(normalized_source)

        # 5 through 22: Registry, Grounded Generation, Deep Validation, Auto Repair & Quality Scoring
        generation_results = cls.generate_deliverables(uckr=uckr, config=config)

        return {
            "status": "success",
            "source": normalized_source.model_dump(),
            "uckr": uckr.model_dump(),
            "outputs": generation_results["outputs"],
            "consistency_audit": generation_results["consistency_audit"],
            "validation_report": generation_results.get("validation_report"),
            "repair_result": generation_results.get("repair_result"),
            "quality_report": generation_results.get("quality_report")
        }
