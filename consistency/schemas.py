from enum import Enum
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field


class SourceType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    RAW_TEXT = "raw_text"
    WEB = "web"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


class SourceSection(BaseModel):
    section_id: str
    heading: Optional[str] = None
    page_number: Optional[int] = None
    text: str


class NormalizedSource(BaseModel):
    source_id: str = Field(..., description="Unique source identifier (e.g. SRC-001)")
    title: str = Field(default="Untitled Source", description="Source document title")
    source_type: SourceType = Field(default=SourceType.RAW_TEXT)
    raw_text: str = Field(..., description="Full combined raw text")
    sections: List[SourceSection] = Field(default_factory=list, description="Parsed text sections with references")
    images: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted images metadata or analysis")
    tables: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted tabular data")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Source metadata like author, page count, url, etc.")
    created_at: Optional[str] = None


class FactItem(BaseModel):
    id: str = Field(..., description="Fact ID (e.g., F001)")
    statement: str = Field(..., description="Atomic factual statement extracted from source")
    importance: float = Field(default=0.8, ge=0.0, le=1.0, description="Significance score 0.0 - 1.0")
    source_reference: str = Field(default="source_text", description="Reference back to source (page, section, timestamp)")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Model confidence in fact extraction")
    category: Optional[str] = Field(default="General", description="Thematic category or domain")
    entities_mentioned: List[str] = Field(default_factory=list, description="Entities involved in this fact")


class EntityItem(BaseModel):
    id: str = Field(..., description="Entity ID (e.g., E001)")
    name: str = Field(..., description="Entity name")
    type: str = Field(default="Concept", description="Entity category (e.g., Technology, Organization, Metric, Person, Domain)")
    description: Optional[str] = Field(default="", description="Brief description or role of the entity")


class ClaimItem(BaseModel):
    id: str = Field(..., description="Claim ID (e.g., C001)")
    claim: str = Field(..., description="Asserted claim or hypothesis")
    support: str = Field(default="", description="Supporting evidence or source reference")
    status: Optional[str] = Field(default="Supported", description="Validation status: Supported, Speculative, Contested")


class StatisticItem(BaseModel):
    id: str = Field(..., description="Statistic ID (e.g., S001)")
    value: str = Field(..., description="Numeric or percentage value (e.g., 35%, $4.2B)")
    context: str = Field(..., description="Context for the metric")
    source_reference: Optional[str] = Field(default="", description="Source reference for verification")


class RelationshipItem(BaseModel):
    source: str = Field(..., description="Source entity or concept")
    relation: str = Field(..., description="Predicate/action (e.g. improves, drives, requires, reduces)")
    target: str = Field(..., description="Target entity or concept")


class DocumentMetadata(BaseModel):
    id: str = Field(..., description="Unique document ID (e.g., SRC-001)")
    title: str = Field(default="Untitled", description="Document Title")
    domain: str = Field(default="General", description="Knowledge Domain")
    author: Optional[str] = Field(default="", description="Author or source entity")
    created_date: Optional[str] = Field(default="", description="Creation date or timestamp")
    version: int = Field(default=1, description="UCKR schema version")


class UCKR(BaseModel):
    """Unified Content Knowledge Representation (UCKR) - Single Source of Truth."""
    document: DocumentMetadata
    core_topic: str = Field(..., description="Core subject / primary topic")
    summary: str = Field(..., description="Objective knowledge summary")
    facts: List[FactItem] = Field(default_factory=list, description="Catalog of atomic facts with unique IDs")
    entities: List[EntityItem] = Field(default_factory=list, description="Identified entities")
    claims: List[ClaimItem] = Field(default_factory=list, description="Identified claims")
    statistics: List[StatisticItem] = Field(default_factory=list, description="Extracted numerical & statistical metrics")
    key_concepts: List[str] = Field(default_factory=list, description="Key concepts and tags")
    relationships: List[RelationshipItem] = Field(default_factory=list, description="Entity/concept relationship triples")


# ---------------------------------------------------------------------------
# Step 9: Constraint-Based Generation Config
# ---------------------------------------------------------------------------

class GenerationConstraint(BaseModel):
    required_facts: List[str] = Field(default_factory=list, description="Must-include Fact IDs")
    optional_facts: List[str] = Field(default_factory=list, description="Optional Fact IDs")
    forbidden_changes: List[str] = Field(
        default_factory=lambda: ["statistics", "dates", "percentages", "named_entities", "claims"],
        description="Dimensions that must remain strictly immutable"
    )


class OutputGenerationConfig(BaseModel):
    output_types: List[str] = Field(default=["summary", "linkedin", "presentation", "video"])
    audience: str = "Professional"
    tone: str = "Authoritative and engaging"
    language: str = "English"
    detail_level: str = "Comprehensive"
    slide_count: int = 4
    video_duration: int = 30
    constraints: Optional[GenerationConstraint] = None
    auto_repair: bool = True
    min_consistency_threshold: float = 85.0


# ---------------------------------------------------------------------------
# Step 11: Provenance Tracking Models
# ---------------------------------------------------------------------------

class ProvenanceItem(BaseModel):
    text_segment: str
    source_facts: List[str] = Field(default_factory=list)
    source_pages: List[int] = Field(default_factory=list)
    source_sections: List[str] = Field(default_factory=list)
    confidence: float = 0.95
    # Audit-grade evidence: verbatim source fact text + verification status.
    source_statements: List[str] = Field(
        default_factory=list,
        description="Verbatim source fact statements backing this segment"
    )
    verification: str = Field(
        default="verified",
        description="Match quality: verified, likely, or unmatched"
    )


# ---------------------------------------------------------------------------
# Step 11b: Statement-Level Evidence Traceability
# Every generated statement links back to: fact IDs, verbatim source
# statements, page/section references, match confidence, verification status.
# Built for government, cybersecurity, research, and enterprise audit needs.
# ---------------------------------------------------------------------------

class StatementEvidence(BaseModel):
    channel: str = Field(..., description="Deliverable channel (summary, linkedin, presentation, video, twitter, advisory)")
    container: str = Field(default="", description="Location inside the channel (e.g. slide_2, scene_3, tweet_1, headline)")
    statement_index: int = Field(default=0, description="Ordinal of the statement within its channel")
    statement_type: str = Field(default="sentence", description="Kind of statement: sentence, bullet, narration, caption, tweet, section, action")
    statement_text: str = Field(..., description="Verbatim generated statement")
    source_facts: List[str] = Field(default_factory=list, description="Grounded Fact IDs (F001, F002...)")
    source_statements: List[str] = Field(default_factory=list, description="Verbatim source fact statements")
    source_pages: List[int] = Field(default_factory=list, description="Source page numbers")
    source_sections: List[str] = Field(default_factory=list, description="Source section references")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Grounding match confidence 0.0-1.0")
    verification: str = Field(default="unmatched", description="verified, likely, or unmatched")


class EvidenceTraceReport(BaseModel):
    status: str = "success"
    source_id: str = Field(default="", description="UCKR document / source identifier")
    document_title: str = Field(default="")
    total_statements: int = Field(default=0, description="Total generated statements traced")
    verified_statements: int = Field(default=0, description="Statements with verified grounding")
    likely_statements: int = Field(default=0, description="Statements with likely (partial) grounding")
    unmatched_statements: int = Field(default=0, description="Statements with no source grounding")
    verification_rate: float = Field(default=0.0, description="Share of statements verified or likely (0-100)")
    channels: Dict[str, List[StatementEvidence]] = Field(default_factory=dict)
    fact_lookup: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Fact ID -> {statement, source_reference, importance} for instant audit"
    )
    uncovered_facts: List[str] = Field(
        default_factory=list,
        description="Registered Fact IDs cited by no generated statement"
    )


# ---------------------------------------------------------------------------
# Grounded Deliverables
# ---------------------------------------------------------------------------

class GroundedSummary(BaseModel):
    text: str = Field(..., description="Executive summary text")
    key_takeaways: List[str] = Field(default_factory=list, description="Key takeaway bullets")
    source_facts: List[str] = Field(default_factory=list, description="List of Fact IDs used")
    provenance: List[ProvenanceItem] = Field(default_factory=list)


class GroundedLinkedIn(BaseModel):
    headline: str = Field(..., description="Engaging LinkedIn headline")
    post_content: str = Field(..., description="Full formatted post body")
    hashtags: List[str] = Field(default_factory=list, description="Recommended hashtags")
    call_to_action: Optional[str] = Field(default="", description="Closing engagement CTA")
    source_facts: List[str] = Field(default_factory=list, description="List of Fact IDs used")
    provenance: List[ProvenanceItem] = Field(default_factory=list)


class SlideItem(BaseModel):
    slide_number: int
    title: str
    layout: str = Field(default="bullet_points")
    bullet_points: List[str] = Field(default_factory=list)
    speaker_notes: Optional[str] = Field(default="")
    visual_recommendation: Optional[str] = Field(default="")
    source_facts: List[str] = Field(default_factory=list)
    source_pages: List[int] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Per-statement evidence for title, bullets, and speaker notes"
    )


class GroundedPresentation(BaseModel):
    presentation_title: str
    subtitle: Optional[str] = ""
    slides: List[SlideItem] = Field(default_factory=list)
    source_facts: List[str] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Flattened per-statement evidence across all slides"
    )


class SceneItem(BaseModel):
    scene_number: int
    duration_seconds: int = Field(default=5)
    visual_importance: float = Field(default=0.8, ge=0.0, le=1.0, description="Visual importance score")
    visual_tier: str = Field(default="MEDIUM", description="Importance category: HIGH, MEDIUM, LOW")
    visual_prompt: str = Field(..., description="Prompt for visual/image generation")
    narration: str = Field(..., description="Voiceover narration grounded in facts")
    estimated_narration_duration: float = Field(default=4.5, description="Estimated narration duration in seconds")
    max_word_count: int = Field(default=15, description="Maximum word count quota")
    on_screen_text: Optional[str] = ""
    start_time: float = Field(default=0.0, description="Start timestamp in seconds")
    end_time: float = Field(default=5.0, description="End timestamp in seconds")
    transition_type: str = Field(default="crossfade", description="Transition type: crossfade, fade, wipe, cut")
    transition_duration: float = Field(default=0.5, description="Transition duration in seconds")
    subtitle_start: Optional[str] = Field(default="00:00:00,000", description="SRT formatted start time")
    subtitle_end: Optional[str] = Field(default="00:00:05,000", description="SRT formatted end time")
    source_facts: List[str] = Field(default_factory=list)
    source_pages: List[int] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Per-statement evidence for narration and on-screen text"
    )


class GroundedVideo(BaseModel):
    video_title: str
    total_duration_seconds: int = Field(default=30)
    storyboard: List[SceneItem] = Field(default_factory=list)
    source_facts: List[str] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    ffmpeg_sync_metadata: Dict[str, Any] = Field(default_factory=dict)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Flattened per-statement evidence across all scenes"
    )


class TweetItem(BaseModel):
    tweet_number: int
    text: str
    source_facts: List[str] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Per-statement evidence for this tweet"
    )


class GroundedTwitter(BaseModel):
    thread: List[TweetItem] = Field(default_factory=list)
    source_facts: List[str] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Flattened per-statement evidence across the thread"
    )


class AdvisorySection(BaseModel):
    heading: str
    content: str
    source_facts: List[str] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Per-statement evidence for this section"
    )


class GroundedAdvisory(BaseModel):
    executive_summary: str
    situation_analysis: str
    recommended_actions: List[str] = Field(default_factory=list)
    sections: List[AdvisorySection] = Field(default_factory=list)
    source_facts: List[str] = Field(default_factory=list)
    evidence: List[ProvenanceItem] = Field(
        default_factory=list,
        description="Flattened per-statement evidence across the advisory"
    )


# ---------------------------------------------------------------------------
# Steps 12-17: Detailed Consistency Breakdown & Validation
# ---------------------------------------------------------------------------

class ValidationCheckDetail(BaseModel):
    passed: bool
    score: float = Field(..., ge=0.0, le=100.0)
    expected: List[str] = Field(default_factory=list)
    found: List[str] = Field(default_factory=list)
    violations: List[Dict[str, Any]] = Field(default_factory=list)


class ConsistencyScoreBreakdown(BaseModel):
    fact_consistency: float = Field(..., description="Score for fact preservation (0-100)")
    numeric_consistency: float = Field(..., description="Score for numbers/percentages (0-100)")
    temporal_consistency: float = Field(default=100.0, description="Score for dates, years, quarters, deadlines (0-100)")
    entity_consistency: float = Field(..., description="Score for named entities preservation (0-100)")
    claim_consistency: float = Field(..., description="Score for claim preservation & no exaggeration (0-100)")
    semantic_consistency: float = Field(..., description="Score for semantic similarity (0-100)")
    cross_output_consistency: float = Field(..., description="Score for alignment across modalities (0-100)")
    overall_score: float = Field(..., description="Weighted aggregate consistency score (0-100)")


class ChannelConsistencyScore(BaseModel):
    channel: str
    score: float
    status: str = "PASS"
    violations: List[str] = Field(default_factory=list)


class DetailedValidationReport(BaseModel):
    passed: bool
    overall_score: float
    breakdown: ConsistencyScoreBreakdown
    channel_scores: Dict[str, ChannelConsistencyScore]
    numeric_check: ValidationCheckDetail
    temporal_check: Optional[ValidationCheckDetail] = Field(default=None)
    entity_check: ValidationCheckDetail
    claim_check: ValidationCheckDetail
    semantic_check: ValidationCheckDetail
    fact_check: ValidationCheckDetail
    cross_output_check: ValidationCheckDetail
    total_facts: int = Field(default=0, description="Total facts in UCKR registry")
    verified_facts: int = Field(default=0, description="Facts verified across deliverables")
    outputs_checked: int = Field(default=0, description="Number of generated deliverable channels checked")
    violations: List[Dict[str, Any]] = Field(default_factory=list)
    traceability_matrix: Dict[str, List[str]] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Step 18: Automatic Repair Request/Result
# ---------------------------------------------------------------------------

class RepairAttempt(BaseModel):
    channel: str
    target_item: str
    problematic_text: str
    fact_id: str
    expected_value: str
    repaired_text: str
    success: bool


class AutoRepairResult(BaseModel):
    repairs_attempted: int
    repairs_successful: int
    repair_log: List[RepairAttempt] = Field(default_factory=list)
    final_score: float
    passed: bool


# ---------------------------------------------------------------------------
# Step 19: UCKR Versioning & Diff
# ---------------------------------------------------------------------------

class UCKRDiff(BaseModel):
    old_version: int
    new_version: int
    added_facts: List[FactItem] = Field(default_factory=list)
    changed_facts: List[Dict[str, Any]] = Field(default_factory=list)
    deleted_facts: List[str] = Field(default_factory=list)
    unchanged_facts: List[str] = Field(default_factory=list)
    affected_fact_ids: List[str] = Field(default_factory=list)


class SelectiveRegenerationResponse(BaseModel):
    status: str = "success"
    diff: UCKRDiff
    affected_channels: List[str]
    affected_fact_ids: List[str]
    updated_outputs: Dict[str, Any]
    new_consistency_score: float


# ---------------------------------------------------------------------------
# API Requests & Responses
# ---------------------------------------------------------------------------

class ExtractionRequest(BaseModel):
    raw_text: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    source_type: Optional[SourceType] = None


class ExtractionResponse(BaseModel):
    status: str = "success"
    normalized_source: NormalizedSource


class AnalyzeRequest(BaseModel):
    normalized_source: Optional[NormalizedSource] = None
    raw_text: Optional[str] = None
    title: Optional[str] = None
    # When True (default) the engine tries Qwen3 then falls back on failure.
    # Set to False (or ?fast=true) to use instant deterministic extraction.
    use_llm: bool = True


class AnalyzeResponse(BaseModel):
    status: str = "success"
    uckr: UCKR


class GenerateDeliverablesRequest(BaseModel):
    uckr: UCKR
    config: Optional[OutputGenerationConfig] = None
    use_llm: bool = True


class GenerateDeliverablesResponse(BaseModel):
    status: str = "success"
    source_id: str
    outputs: Dict[str, Any]
    consistency_audit: Dict[str, Any]
    validation_report: Optional[DetailedValidationReport] = None
    repair_result: Optional[AutoRepairResult] = None
    quality_report: Optional[Dict[str, Any]] = None
    evidence_trace: Optional[EvidenceTraceReport] = None


class ConsistencyAuditResult(BaseModel):
    total_registered_facts: int
    total_cited_facts: int
    fact_coverage_percentage: float
    citation_integrity_score: float
    invalid_fact_citations: List[str] = Field(default_factory=list)
    unreferenced_critical_facts: List[FactItem] = Field(default_factory=list)
    traceability_matrix: Dict[str, List[str]] = Field(default_factory=dict)
    cross_channel_consistency_score: float


# ---------------------------------------------------------------------------
# AI Content Quality Scoring Models
# ---------------------------------------------------------------------------

class QualityDimensionScore(BaseModel):
    name: str = Field(..., description="Name of the quality dimension")
    score: float = Field(..., ge=0.0, le=100.0, description="Dimension score 0-100")
    grade: str = Field(default="A", description="Letter grade: A+, A, B, C, D")
    feedback: str = Field(default="", description="Detailed qualitative feedback")
    details: Dict[str, Any] = Field(default_factory=dict, description="Underlying quantitative metrics")


class ContentQualityReport(BaseModel):
    channel: str = Field(default="text", description="Channel or document evaluated")
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Weighted composite quality score 0-100")
    overall_grade: str = Field(..., description="Overall letter grade: A+, A, B, C, Needs Improvement")
    readability: QualityDimensionScore
    engagement_and_hook: QualityDimensionScore
    information_density: QualityDimensionScore
    tone_and_audience: QualityDimensionScore
    structural_coherence: QualityDimensionScore
    fact_grounding: QualityDimensionScore
    strengths: List[str] = Field(default_factory=list, description="Key positive attributes")
    recommendations: List[str] = Field(default_factory=list, description="Actionable improvement suggestions")


class DeliverablesQualityReport(BaseModel):
    status: str = "success"
    overall_average_score: float = Field(..., ge=0.0, le=100.0)
    overall_grade: str = Field(..., description="Composite grade across all deliverables")
    channels: Dict[str, ContentQualityReport] = Field(default_factory=dict)
    summary: str = Field(default="", description="High level summary of quality assessment")


class QualityScoreRequest(BaseModel):
    text: Optional[str] = None
    outputs: Optional[Dict[str, Any]] = None
    uckr: Optional[UCKR] = None
    target_audience: str = "Professional"
    target_tone: str = "Authoritative and engaging"


class EvidenceRequest(BaseModel):
    uckr: UCKR = Field(..., description="Unified Content Knowledge Representation to trace against")
    outputs: Dict[str, Any] = Field(..., description="Generated deliverables to trace statement by statement")
    source_id: Optional[str] = Field(default=None, description="Override source identifier in the report")
