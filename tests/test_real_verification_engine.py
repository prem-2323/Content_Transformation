import pytest
from consistency.schemas import UCKR, DocumentMetadata, FactItem, EntityItem, ClaimItem, StatisticItem
from consistency.validators import ConsistencyValidator
from consistency.repair import AutoRepairEngine
from consistency.fact_registry import get_or_create_registry


def create_sample_uckr() -> UCKR:
    return UCKR(
        document=DocumentMetadata(id="SRC-TEST-001", title="Enterprise Transformation Report", domain="Tech", version=1),
        core_topic="ContentForge AI UCKR Fact Grounding",
        summary="Unified multi-channel AI platform.",
        facts=[
            FactItem(id="F001", statement="Enterprise AI transformation confirmed in Q4 2026.", importance=0.95, source_reference="Sec 1"),
            FactItem(id="F002", statement="Automated multi-channel delivery reduces turnaround by 80%.", importance=0.90, source_reference="Sec 2"),
            FactItem(id="F003", statement="Fact-grounded consistency checking eliminates hallucinations.", importance=0.85, source_reference="Sec 3")
        ],
        entities=[
            EntityItem(id="E001", name="ContentForge AI", type="Product", description="AI Platform")
        ],
        claims=[
            ClaimItem(id="C001", claim="Automated multi-channel delivery reduces turnaround by 80%.", support="Sec 2")
        ],
        statistics=[
            StatisticItem(id="S001", value="80%", context="turnaround reduction", source_reference="Sec 2")
        ]
    )


def test_1_perfect_consistency():
    uckr = create_sample_uckr()
    outputs = {
        "summary": "Executive brief for ContentForge AI [F001, F002, F003]. Turnaround reduced by 80% in Q4 2026.",
        "email": "ContentForge AI reduces turnaround by 80% in Q4 2026 [F001, F002, F003].",
        "presentation": "ContentForge AI Deck: 80% turnaround reduction confirmed [F001, F002, F003] in Q4 2026.",
        "video": "Video script: ContentForge AI turnaround reduced by 80% [F001, F002, F003] in Q4 2026."
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert report.passed is True
    assert report.overall_score == 100.0
    assert report.breakdown.fact_consistency == 100.0
    assert report.breakdown.numeric_consistency == 100.0
    assert report.breakdown.temporal_consistency == 100.0
    assert report.breakdown.entity_consistency == 100.0
    assert report.total_facts == 3
    assert report.verified_facts == 3
    assert report.outputs_checked == 4
    assert len(report.violations) == 0


def test_2_numeric_conflict():
    uckr = create_sample_uckr()
    outputs = {
        "summary": "ContentForge AI reduces turnaround by 80% [F001, F002, F003].",
        "email": "ContentForge AI reduces turnaround by 60% in Q4 2026 [F001, F002, F003].", # 60% mismatch!
        "presentation": "ContentForge AI: 80% turnaround reduction [F001, F002, F003]."
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert report.passed is False
    assert report.overall_score < 100.0
    assert report.breakdown.numeric_consistency < 100.0
    
    numeric_violations = [v for v in report.violations if v.get("type") == "numeric_conflict"]
    assert len(numeric_violations) > 0
    assert numeric_violations[0]["expected"] == "80%"
    assert numeric_violations[0]["found"] == "60%"
    assert numeric_violations[0]["channel"] == "email"


def test_3_date_temporal_conflict():
    uckr = create_sample_uckr()
    outputs = {
        "summary": "ContentForge AI reduces turnaround by 80% in Q4 2026 [F001, F002, F003].",
        "email": "ContentForge AI reduces turnaround by 80% in Q3 2026 [F001, F002, F003]." # Q3 2026 mismatch!
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert report.passed is False
    assert report.breakdown.temporal_consistency < 100.0
    
    temporal_violations = [v for v in report.violations if v.get("type") == "temporal_conflict"]
    assert len(temporal_violations) > 0
    assert temporal_violations[0]["expected"] == "Q4 2026"
    assert temporal_violations[0]["found"] == "Q3 2026"


def test_4_entity_conflict():
    uckr = create_sample_uckr()
    outputs = {
        "summary": "ContentFlow AI reduces turnaround by 80% in Q4 2026 [F001, F002, F003]." # ContentFlow AI mutation!
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert report.passed is False
    assert report.breakdown.entity_consistency < 100.0
    
    entity_violations = [v for v in report.violations if v.get("type") == "entity_conflict"]
    assert len(entity_violations) > 0
    assert entity_violations[0]["expected"] == "ContentForge AI"
    assert entity_violations[0]["found"] == "ContentFlow AI"


def test_5_missing_fact():
    uckr = create_sample_uckr()
    # Outputs omit F003 completely
    outputs = {
        "summary": "ContentForge AI turnaround reduced by 80% [F001, F002]."
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert report.breakdown.fact_consistency < 100.0
    missing_violations = [v for v in report.violations if v.get("type") == "missing_fact"]
    assert len(missing_violations) > 0
    assert missing_violations[0]["fact_id"] == "F003"


def test_6_valid_paraphrase():
    uckr = create_sample_uckr()
    outputs = {
        "summary": "ContentForge AI platform enables automated content delivery, cutting turnaround time by 80% [F001, F002, F003] in Q4 2026."
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert report.breakdown.claim_consistency == 100.0
    assert report.breakdown.numeric_consistency == 100.0


def test_7_auto_fix_flow():
    uckr = create_sample_uckr()
    # Initial output contains 60% numeric mismatch
    outputs = {
        "summary": "ContentForge AI turnaround reduced by 80% in Q4 2026 [F001, F002, F003].",
        "email": "ContentForge AI turnaround reduced by 60% in Q4 2026 [F001, F002, F003]."
    }
    registry = get_or_create_registry(uckr)
    audit = registry.audit_deliverables(outputs)
    initial_report = ConsistencyValidator.validate_all(uckr, outputs, audit.traceability_matrix)

    assert initial_report.overall_score < 100.0

    # Auto-repair engine replaces 60% -> 80% and re-validates
    repaired_outputs, repair_res, final_report = AutoRepairEngine.repair_outputs(
        uckr=uckr,
        outputs=outputs,
        report=initial_report,
        fact_matrix=audit.traceability_matrix
    )

    assert repair_res.repairs_successful > 0
    assert final_report.overall_score == 100.0
    assert final_report.passed is True
    assert "80%" in repaired_outputs["email"]
