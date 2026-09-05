import io
import json
import pytest
from fastapi.testclient import TestClient

from main import app
from consistency.schemas import (
    UCKR,
    DocumentMetadata,
    FactItem,
    EntityItem,
    ClaimItem,
    StatisticItem,
    RelationshipItem,
    OutputGenerationConfig,
    DetailedValidationReport,
    UCKRDiff
)
from consistency.validators import (
    NumericValidator,
    EntityValidator,
    ClaimValidator,
    SemanticValidator,
    CrossOutputValidator,
    ConsistencyValidator,
    compute_semantic_similarity
)
from consistency.repair import AutoRepairEngine
from consistency.versioning import UCKRVersionManager
from consistency.provenance import ProvenanceTracker

client = TestClient(app)


@pytest.fixture
def sample_uckr() -> UCKR:
    return UCKR(
        document=DocumentMetadata(
            id="SRC-TEST-001",
            title="AI Smart Cities",
            domain="Artificial Intelligence",
            version=1
        ),
        core_topic="Artificial Intelligence in Smart Cities",
        summary="AI optimizes urban traffic and energy efficiency by up to 35%.",
        facts=[
            FactItem(
                id="F001",
                statement="AI can optimize traffic management across major corridors.",
                importance=0.95,
                source_reference="page_4",
                confidence=0.94,
                category="Traffic"
            ),
            FactItem(
                id="F002",
                statement="Energy efficiency improves by 35% through machine learning grid controls.",
                importance=0.91,
                source_reference="page_5",
                confidence=0.92,
                category="Energy"
            ),
            FactItem(
                id="F003",
                statement="AI supports urban infrastructure planning for 2035 targets.",
                importance=0.89,
                source_reference="page_7",
                confidence=0.90,
                category="Planning"
            )
        ],
        entities=[
            EntityItem(id="E001", name="Artificial Intelligence", type="Technology"),
            EntityItem(id="E002", name="Smart Cities", type="Domain"),
            EntityItem(id="E003", name="Qwen", type="Model")
        ],
        claims=[
            ClaimItem(id="C001", claim="AI improves traffic flow and reduces delay.", support="page_4", status="Supported")
        ],
        statistics=[
            StatisticItem(id="S001", value="35%", context="Energy efficiency improvement", source_reference="page_5"),
            StatisticItem(id="S002", value="2035", context="Target planning milestone year", source_reference="page_7")
        ],
        key_concepts=["AI", "Traffic Management", "Energy Efficiency", "Urban Planning"],
        relationships=[
            RelationshipItem(source="Artificial Intelligence", relation="improves", target="Traffic Management")
        ]
    )


# ---------------------------------------------------------------------------
# 1. Semantic Similarity Test (Step 13)
# ---------------------------------------------------------------------------

def test_semantic_similarity_conceptual_matching():
    s1 = "AI can optimize traffic management."
    s2 = "Artificial intelligence can improve the efficiency of urban traffic systems."
    sim = compute_semantic_similarity(s1, s2)
    assert sim >= 0.40  # Meaningful conceptual similarity detected


# ---------------------------------------------------------------------------
# 2. Numeric Validator Test (Step 14)
# ---------------------------------------------------------------------------

def test_numeric_validator_accurate_numbers(sample_uckr):
    outputs = {
        "summary": {"text": "Energy efficiency improves by 35% through machine learning by 2035."},
        "linkedin": {"post_content": "We observed a 35% boost in energy savings for 2035."}
    }
    result = NumericValidator.validate(sample_uckr, outputs)
    assert result.passed is True
    assert result.score == 100.0
    assert len(result.violations) == 0


def test_numeric_validator_detects_mismatch(sample_uckr):
    # Output mutated 35% to 53%
    outputs = {
        "linkedin": {"post_content": "We observed a 53% boost in energy savings."}
    }
    result = NumericValidator.validate(sample_uckr, outputs)
    assert result.passed is False
    assert result.score < 100.0
    assert len(result.violations) >= 1
    assert result.violations[0]["type"] == "numeric_mismatch"
    assert result.violations[0]["expected"] == "35%"
    assert result.violations[0]["found"] == "53%"


# ---------------------------------------------------------------------------
# 3. Entity Validator Test (Step 15)
# ---------------------------------------------------------------------------

def test_entity_validator_preservation(sample_uckr):
    outputs = {
        "summary": {"text": "Artificial Intelligence is transforming Smart Cities with Qwen models."}
    }
    result = EntityValidator.validate(sample_uckr, outputs)
    assert result.passed is True
    assert result.score >= 80.0
    assert "Artificial Intelligence" in result.found


# ---------------------------------------------------------------------------
# 4. Claim Validator & Exaggeration Test
# ---------------------------------------------------------------------------

def test_claim_validator_exaggeration_check(sample_uckr):
    outputs = {
        "linkedin": {"post_content": "Our AI completely solves traffic problems everywhere!"}
    }
    result = ClaimValidator.validate(sample_uckr, outputs)
    assert result.passed is False
    assert len(result.violations) >= 1
    assert result.violations[0]["type"] == "exaggerated_claim"


# ---------------------------------------------------------------------------
# 5. Cross-Output Consistency & Detailed Report (Steps 16 & 17)
# ---------------------------------------------------------------------------

def test_consistency_validator_overall_score_breakdown(sample_uckr):
    outputs = {
        "summary": {
            "text": "Artificial Intelligence optimizes traffic and enhances energy efficiency by 35% in Smart Cities.",
            "source_facts": ["F001", "F002"]
        },
        "linkedin": {
            "post_content": "Smart Cities use Artificial Intelligence to optimize traffic and cut energy by 35%.",
            "source_facts": ["F001", "F002"]
        },
        "presentation": {
            "slides": [
                {"title": "Traffic AI", "bullet_points": ["Optimize traffic"], "source_facts": ["F001"]},
                {"title": "Energy AI", "bullet_points": ["35% efficiency"], "source_facts": ["F002"]}
            ],
            "source_facts": ["F001", "F002"]
        },
        "video": {
            "storyboard": [
                {"narration": "Artificial Intelligence optimizes city traffic.", "source_facts": ["F001"]},
                {"narration": "Achieving 35% energy savings.", "source_facts": ["F002"]}
            ],
            "source_facts": ["F001", "F002"]
        }
    }

    fact_matrix = {
        "F001": ["summary", "linkedin", "presentation", "video"],
        "F002": ["summary", "linkedin", "presentation", "video"],
        "F003": []
    }

    report = ConsistencyValidator.validate_all(sample_uckr, outputs, fact_matrix)
    assert report.overall_score >= 85.0
    assert report.breakdown.numeric_consistency == 100.0
    assert report.breakdown.entity_consistency >= 60.0
    assert "summary" in report.channel_scores
    assert "linkedin" in report.channel_scores
    assert "presentation" in report.channel_scores
    assert "video" in report.channel_scores


# ---------------------------------------------------------------------------
# 6. Provenance Tracking Test (Step 11)
# ---------------------------------------------------------------------------

def test_provenance_tracking(sample_uckr):
    text = "AI can optimize traffic management across major corridors. Energy efficiency improves by 35%."
    provenance = ProvenanceTracker.extract_provenance(text, sample_uckr)
    assert len(provenance) >= 2
    assert "F001" in provenance[0].source_facts or "F002" in provenance[0].source_facts
    assert len(provenance[0].source_pages) >= 1


# ---------------------------------------------------------------------------
# 7. Automatic Repair Engine Test (Step 18)
# ---------------------------------------------------------------------------

def test_auto_repair_engine_fixes_numeric_mismatch(sample_uckr):
    # LinkedIn post has corrupted 30% instead of 35%
    outputs = {
        "summary": {
            "text": "Energy efficiency improves by 35%.",
            "source_facts": ["F002"]
        },
        "linkedin": {
            "post_content": "Energy efficiency improves by 30%.",
            "source_facts": ["F002"]
        }
    }

    fact_matrix = {"F001": [], "F002": ["summary", "linkedin"], "F003": []}

    initial_report = ConsistencyValidator.validate_all(sample_uckr, outputs, fact_matrix)
    assert initial_report.passed is False
    assert len(initial_report.violations) >= 1

    # Run auto repair
    repaired_outputs, repair_res, final_report = AutoRepairEngine.repair_outputs(
        uckr=sample_uckr,
        outputs=outputs,
        report=initial_report,
        fact_matrix=fact_matrix
    )

    assert repair_res.repairs_attempted >= 1
    assert "35%" in repaired_outputs["linkedin"]["post_content"]
    assert "30%" not in repaired_outputs["linkedin"]["post_content"]
    assert final_report.numeric_check.passed is True


# ---------------------------------------------------------------------------
# 8. UCKR Versioning & Incremental Selective Regeneration Test (Step 19)
# ---------------------------------------------------------------------------

def test_uckr_versioning_and_diff(sample_uckr):
    v1 = sample_uckr
    v2 = sample_uckr.model_copy(deep=True)
    v2.document.version = 2
    # Modify fact F002 (e.g. 35% -> 40%)
    v2.facts[1].statement = "Energy efficiency improves by 40% through next-gen machine learning."
    # Add fact F004
    v2.facts.append(FactItem(
        id="F004",
        statement="Water distribution optimization saves 15% municipal water.",
        importance=0.85,
        source_reference="page_9",
        confidence=0.91,
        category="Water"
    ))

    diff = UCKRVersionManager.diff_uckr(v1, v2)
    assert diff.old_version == 1
    assert diff.new_version == 2
    assert len(diff.changed_facts) == 1
    assert diff.changed_facts[0]["id"] == "F002"
    assert len(diff.added_facts) == 1
    assert diff.added_facts[0].id == "F004"
    assert "F002" in diff.affected_fact_ids
    assert "F004" in diff.affected_fact_ids


def test_selective_regeneration_regenerates_only_affected(sample_uckr):
    v1 = sample_uckr
    v2 = sample_uckr.model_copy(deep=True)
    v2.document.version = 2
    v2.facts[1].statement = "Energy efficiency improves by 40% through next-gen machine learning."

    diff = UCKRVersionManager.diff_uckr(v1, v2)

    previous_outputs = {
        "summary": {
            "text": "Summary text using F001 and F002.",
            "source_facts": ["F001", "F002"]
        },
        "presentation": {
            "slides": [
                {"title": "Planning", "bullet_points": ["Target 2035"], "source_facts": ["F003"]}
            ],
            "source_facts": ["F003"]
        }
    }

    res = UCKRVersionManager.selective_regenerate(
        uckr_v2=v2,
        diff=diff,
        previous_outputs=previous_outputs
    )

    # Summary used F002 (affected), so summary should be regenerated
    assert "summary" in res.affected_channels
    # Presentation only used F003 (unaffected), so presentation was NOT in affected_channels
    assert "presentation" not in res.affected_channels
    assert res.updated_outputs["presentation"] == previous_outputs["presentation"]


# ---------------------------------------------------------------------------
# 9. API Endpoint Tests for Advanced Validation, Repair & Diff
# ---------------------------------------------------------------------------

def test_api_validate_endpoint(sample_uckr):
    outputs = {
        "summary": {
            "text": "Artificial Intelligence improves Smart Cities traffic and energy by 35%.",
            "source_facts": ["F001", "F002"]
        }
    }
    response = client.post(
        "/consistency/validate",
        json={
            "uckr": sample_uckr.model_dump(),
            "outputs": outputs
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data
    assert "breakdown" in data
    assert data["breakdown"]["numeric_consistency"] == 100.0


def test_api_repair_endpoint(sample_uckr):
    outputs = {
        "summary": {
            "text": "Energy efficiency improves by 30%.",
            "source_facts": ["F002"]
        }
    }
    response = client.post(
        "/consistency/repair",
        json={
            "uckr": sample_uckr.model_dump(),
            "outputs": outputs
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "35%" in data["repaired_outputs"]["summary"]["text"]


def test_api_diff_endpoint(sample_uckr):
    v1 = sample_uckr
    v2 = sample_uckr.model_copy(deep=True)
    v2.document.version = 2
    v2.facts[0].statement = "Updated traffic optimization statement."

    response = client.post(
        "/consistency/diff",
        json={
            "v1": v1.model_dump(),
            "v2": v2.model_dump()
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["changed_facts"]) == 1
    assert data["changed_facts"][0]["id"] == "F001"
