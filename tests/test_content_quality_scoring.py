import pytest
from fastapi.testclient import TestClient
from main import app
from consistency.quality_scorer import (
    count_syllables,
    grade_from_score,
    ContentQualityScorer
)
from consistency.schemas import UCKR, DocumentMetadata, FactItem, EntityItem, QualityScoreRequest

client = TestClient(app)


def test_syllable_counter_and_grades():
    assert count_syllables("AI") == 1
    assert count_syllables("smart") == 1
    assert count_syllables("transformation") >= 4
    assert count_syllables("infrastructure") >= 4

    assert grade_from_score(95.0) == "A+"
    assert grade_from_score(85.0) == "A"
    assert grade_from_score(75.0) == "B"
    assert grade_from_score(65.0) == "C"
    assert grade_from_score(45.0) == "Needs Improvement"


def test_readability_scoring():
    clear_text = (
        "Artificial intelligence improves modern smart city management. "
        "Intelligent signal synchronization reduces traffic delays by 35%. "
        "City engineers deployed IoT sensors across major transit corridors."
    )
    res = ContentQualityScorer._score_readability(clear_text)
    assert res.score >= 80.0
    assert res.grade in ["A+", "A"]
    assert "flesch_reading_ease" in res.details
    assert "flesch_kincaid_grade" in res.details


def test_engagement_and_hook_scoring():
    engaging_text = (
        "🚀 Transforming urban mobility: AI reduces peak congestion delays by 35% across 12 corridors! "
        "What are your thoughts on smart transit automation? Join the conversation below."
    )
    res = ContentQualityScorer._score_engagement(engaging_text, "linkedin")
    assert res.score >= 85.0
    assert res.details["has_hook_statistics"] is True
    assert res.details["has_call_to_action"] is True


def test_density_and_filler_detection():
    filler_text = (
        "It goes without saying that in order to achieve success, it is important to note that "
        "at the end of the day each and every city needs technology."
    )
    res_filler = ContentQualityScorer._score_density(filler_text)
    assert len(res_filler.details["filler_phrases_detected"]) >= 3
    assert res_filler.score < 80.0

    dense_text = (
        "The project deployed 500 IoT sensors across 12 corridors, reducing congestion by 35% "
        "and saving $5.2M in annual municipal operational costs."
    )
    res_dense = ContentQualityScorer._score_density(dense_text)
    assert res_dense.details["metric_count"] >= 3
    assert res_dense.score > res_filler.score


def test_tone_and_audience_alignment():
    informal_text = "This AI stuff is super cool and gonna be a huge deal for cities."
    res_informal = ContentQualityScorer._score_tone_and_audience(
        informal_text,
        target_audience="Executive / Enterprise",
        target_tone="Authoritative and Professional"
    )
    assert res_informal.score < 85.0

    formal_text = "Artificial intelligence enables municipal authorities to optimize infrastructure operations systematically."
    res_formal = ContentQualityScorer._score_tone_and_audience(
        formal_text,
        target_audience="Executive / Enterprise",
        target_tone="Authoritative and Professional"
    )
    assert res_formal.score >= 88.0


def test_fact_grounding_scoring():
    uckr = UCKR(
        document=DocumentMetadata(id="SRC-001", title="Smart Traffic AI"),
        core_topic="Traffic AI",
        summary="AI systems optimize traffic light control reducing congestion by 35%.",
        facts=[
            FactItem(id="F001", statement="AI algorithms reduced peak congestion delays by 35% across 12 corridors.", importance=0.95),
            FactItem(id="F002", statement="IoT sensor grid deployment cost $5.2 million.", importance=0.85)
        ],
        entities=[
            EntityItem(id="E001", name="Smart City IoT Grid", type="Technology")
        ]
    )

    grounded_text = "According to [F001], AI reduced congestion by 35% utilizing the Smart City IoT Grid [F002]."
    res = ContentQualityScorer._score_grounding(grounded_text, uckr)
    assert res.score >= 90.0
    assert "F001" in res.details["matched_fact_ids"]


def test_evaluate_text_end_to_end():
    text = (
        "🚀 Transforming urban infrastructure: Real-time traffic AI reduced peak delays by 35% [F001]. "
        "Furthermore, the Smart City IoT Grid deployment saved $5.2M in municipal costs. "
        "What are your key takeaways? Share your perspective below!"
    )
    report = ContentQualityScorer.evaluate_text(text, channel="linkedin")
    assert report.overall_score >= 80.0
    assert report.overall_grade in ["A+", "A"]
    assert len(report.strengths) > 0
    assert len(report.recommendations) > 0


def test_evaluate_deliverables():
    outputs = {
        "summary": {
            "text": "Real-time AI reduces peak traffic congestion by 35% across 12 corridors.",
            "key_takeaways": ["35% reduction in delay [F001]", "IoT grid deployed [F002]"]
        },
        "linkedin": {
            "headline": "Transforming Urban Mobility with AI 🚦",
            "post_content": "Our new deployment reduced traffic delays by 35% using smart IoT sensors.",
            "call_to_action": "Read our whitepaper."
        },
        "video": {
            "video_title": "Smart Cities AI",
            "storyboard": [
                {
                    "scene_number": 1,
                    "narration": "Artificial intelligence algorithms actively reduce traffic delays by 35% in smart cities.",
                    "on_screen_text": "35% Less Traffic Delay"
                }
            ]
        }
    }

    report = ContentQualityScorer.evaluate_deliverables(outputs)
    assert report.overall_average_score >= 80.0
    assert "summary" in report.channels
    assert "linkedin" in report.channels
    assert "video" in report.channels


def test_quality_score_api_endpoint():
    payload = {
        "text": (
            "🚀 Breakthrough in municipal AI: Intelligent traffic signals reduce peak congestion delays by 35%. "
            "Consequently, emergency vehicle transit times improved across 12 major corridors. "
            "Share your thoughts on smart transit below!"
        ),
        "target_audience": "Professional",
        "target_tone": "Authoritative and engaging"
    }

    response = client.post("/consistency/quality-score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_score"] >= 80.0
    assert data["overall_grade"] in ["A+", "A"]
    assert "readability" in data
    assert "engagement_and_hook" in data
    assert "information_density" in data
