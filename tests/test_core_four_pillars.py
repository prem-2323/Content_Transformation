import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from consistency.schemas import (
    UCKR,
    DocumentMetadata,
    FactItem,
    EntityItem,
    StatisticItem,
    OutputGenerationConfig
)
from consistency.validators import ConsistencyValidator
from consistency.repair import AutoRepairEngine
from consistency.fact_registry import get_or_create_registry
from consistency.multilingual import (
    LANGUAGE_REGISTRY,
    get_voice_for_language,
    MultilingualTransformer
)
from consistency.generators import (
    SummaryGenerator,
    LinkedInGenerator,
    VideoGenerator
)
from video.planner import (
    determine_scene_count,
    calculate_scene_durations,
    IntelligentVideoPlanner
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# ② Fact Validation Tests
# ---------------------------------------------------------------------------

def test_pillar_two_fact_validation_and_numeric_checks():
    uckr = UCKR(
        document=DocumentMetadata(id="SRC-VAL-001", title="Energy AI Systems"),
        core_topic="Energy Efficiency",
        summary="AI algorithms reduce energy consumption by 35% across municipal grids.",
        facts=[
            FactItem(id="F001", statement="AI algorithms reduce energy consumption by 35% across municipal grids.", importance=0.95),
            FactItem(id="F002", statement="Total solar battery storage capacity reaches 500 MWh in 2025.", importance=0.90)
        ],
        statistics=[
            StatisticItem(id="S001", value="35%", context="Reduction in energy consumption"),
            StatisticItem(id="S002", value="500 MWh", context="Solar battery storage capacity")
        ]
    )

    # 1. Valid outputs matching facts exactly
    valid_outputs = {
        "summary": {
            "text": "AI algorithms reduce energy consumption by 35% [F001] with 500 MWh capacity [F002].",
            "source_facts": ["F001", "F002"]
        },
        "linkedin": {
            "headline": "Energy AI Breakthrough ⚡",
            "post_content": "We measured a 35% reduction in grid energy use [F001] across 500 MWh storage assets.",
            "source_facts": ["F001"]
        }
    }

    report = ConsistencyValidator.validate_all(uckr, valid_outputs, {"F001": ["summary", "linkedin"], "F002": ["summary"]})
    assert report.passed is True
    assert report.breakdown.numeric_consistency >= 95.0
    assert report.breakdown.fact_consistency >= 95.0

    # 2. Inconsistent output (numeric mutation 35% -> 53%)
    invalid_outputs = {
        "summary": {
            "text": "AI algorithms reduce energy consumption by 53% across municipal grids.",
            "source_facts": ["F001"]
        }
    }
    report_invalid = ConsistencyValidator.validate_all(uckr, invalid_outputs, {"F001": ["summary"]})
    assert report_invalid.breakdown.numeric_consistency < 90.0

    # 3. Test Auto-Repair
    repaired, res, final_rep = AutoRepairEngine.repair_outputs(
        uckr=uckr,
        outputs=invalid_outputs,
        report=report_invalid,
        fact_matrix={"F001": ["summary"]}
    )
    assert res.repairs_successful >= 1
    assert "35%" in repaired["summary"]["text"]


# ---------------------------------------------------------------------------
# ③ Audience-Aware Transformation Tests
# ---------------------------------------------------------------------------

def test_pillar_three_audience_aware_transformation():
    uckr = UCKR(
        document=DocumentMetadata(id="SRC-AUD-001", title="Enterprise AI Optimization"),
        core_topic="Enterprise Autonomous AI",
        summary="Autonomous AI agents automate 45% of supply chain workflows, saving $12M annually.",
        facts=[
            FactItem(id="F001", statement="Autonomous AI agents automate 45% of supply chain workflows.", importance=0.95),
            FactItem(id="F002", statement="Annual municipal and enterprise cost savings exceed $12M.", importance=0.90)
        ],
        key_concepts=["Supply Chain", "Enterprise AI"]
    )

    # Executive Audience
    cfg_exec = OutputGenerationConfig(
        audience="Executive / C-Suite",
        tone="Strategic and Decisive"
    )
    summary_exec = SummaryGenerator.generate(uckr, cfg_exec)
    li_exec = LinkedInGenerator.generate(uckr, cfg_exec)

    assert "Executive Strategic Briefing" in summary_exec.text
    assert "C-Suite" in li_exec.headline or "Leaders" in li_exec.call_to_action

    # Technical Audience
    cfg_tech = OutputGenerationConfig(
        audience="Technical / Engineering",
        tone="Authoritative and Precise"
    )
    summary_tech = SummaryGenerator.generate(uckr, cfg_tech)
    li_tech = LinkedInGenerator.generate(uckr, cfg_tech)

    assert "Technical Implementation" in summary_tech.text
    assert "Engineering" in li_tech.headline or "Engineers" in li_tech.call_to_action


# ---------------------------------------------------------------------------
# ④ Multilingual Transformation Tests
# ---------------------------------------------------------------------------

def test_pillar_four_multilingual_transformation():
    # Verify Indian language registry and Edge TTS neural voice bindings
    assert get_voice_for_language("Tamil") == "ta-IN-PallaviNeural"
    assert get_voice_for_language("Hindi") == "hi-IN-SwaraNeural"
    assert get_voice_for_language("Telugu") == "te-IN-ShrutiNeural"
    assert get_voice_for_language("Malayalam") == "ml-IN-SobhanaNeural"
    assert get_voice_for_language("Kannada") == "kn-IN-SapnaNeural"
    assert get_voice_for_language("Bengali") == "bn-IN-TanishaaNeural"
    assert get_voice_for_language("Marathi") == "mr-IN-AarohiNeural"
    assert get_voice_for_language("Gujarati") == "gu-IN-DhwaniNeural"

    sample_outputs = {
        "summary": {
            "text": "AI reduces traffic congestion by 35% across 12 corridors.",
            "key_takeaways": ["35% reduction in delays [F001]"]
        },
        "video": {
            "video_title": "Traffic AI Overview",
            "storyboard": [
                {
                    "scene_number": 1,
                    "narration": "Artificial intelligence manages traffic flows smoothly.",
                    "on_screen_text": "35% Less Delay"
                }
            ]
        }
    }

    with patch("consistency.multilingual.generate_with_qwen") as mock_qwen:
        mock_qwen.side_effect = lambda prompt: f"தமிழ்: {prompt.split('SOURCE TEXT (English):')[1].split('CRITICAL RULES:')[0].strip()}"
        translated = MultilingualTransformer.translate_deliverables(sample_outputs, "Tamil")

    assert translated["summary"]["language"] == "Tamil"
    assert translated["video"]["language"] == "Tamil"
    assert translated["video"]["recommended_tts_voice"] == "ta-IN-PallaviNeural"
    assert "தமிழ்:" in translated["video"]["storyboard"][0]["narration"]


# ---------------------------------------------------------------------------
# ⑤ Intelligent Video Scene Planning Tests
# ---------------------------------------------------------------------------

def test_pillar_five_intelligent_video_planning():
    # 30-second video in balanced pacing -> 6 scenes of 5.0 seconds
    scene_count = determine_scene_count(30.0, "balanced")
    assert scene_count == 6

    durations = calculate_scene_durations(30.0, 6)
    assert len(durations) == 6
    assert sum(durations) == 30.0

    plan = IntelligentVideoPlanner.plan_video(
        content="AI algorithms optimize municipal transit and emergency response times by 35% across 12 corridors.",
        target_duration=30,
        pacing="balanced"
    )

    assert plan.target_duration == 30.0
    assert plan.num_scenes == 6
    assert len(plan.scenes) == 6

    # Verify transition and subtitle timing
    for i, sc in enumerate(plan.scenes):
        assert sc.scene_number == i + 1
        assert sc.duration > 0
        assert sc.visual_importance >= 0.5
        assert sc.visual_tier in ["HIGH", "MEDIUM", "LOW"]
        assert sc.transition_type in ["crossfade", "fade", "wipe", "cut"]
        assert sc.subtitle_start.startswith("00:")
        assert sc.subtitle_end.startswith("00:")
        assert sc.start_time < sc.end_time

    assert plan.ffmpeg_sync_metadata["scene_count"] == 6
    assert plan.ffmpeg_sync_metadata["target_duration_seconds"] == 30.0
