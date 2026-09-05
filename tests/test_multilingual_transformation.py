import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from consistency.schemas import (
    UCKR,
    DocumentMetadata,
    FactItem,
    EntityItem,
    ClaimItem,
    StatisticItem,
    OutputGenerationConfig
)
from consistency.multilingual import (
    LANGUAGE_REGISTRY,
    normalize_language_name,
    get_voice_for_language,
    MultilingualTransformer
)
from consistency.engine import ConsistencyEngine

client = TestClient(app)


def test_language_registry_and_voices():
    assert "tamil" in LANGUAGE_REGISTRY
    assert "hindi" in LANGUAGE_REGISTRY
    assert "telugu" in LANGUAGE_REGISTRY

    assert normalize_language_name("Tamil") == "tamil"
    assert normalize_language_name("ta") == "tamil"
    assert normalize_language_name("Hindi") == "hindi"
    assert normalize_language_name("hi") == "hindi"

    assert get_voice_for_language("Tamil", "female") == "ta-IN-PallaviNeural"
    assert get_voice_for_language("Tamil", "male") == "ta-IN-ValluvarNeural"
    assert get_voice_for_language("Hindi", "female") == "hi-IN-SwaraNeural"
    assert get_voice_for_language("Hindi", "male") == "hi-IN-MadhurNeural"


def test_get_languages_endpoint():
    response = client.get("/consistency/languages")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "tamil" in data["languages"]
    assert "hindi" in data["languages"]
    assert data["languages"]["tamil"]["default_voice"] == "ta-IN-PallaviNeural"


def test_translate_uckr_preserves_fact_ids():
    uckr = UCKR(
        document=DocumentMetadata(id="SRC-LANG-001", title="Smart Cities AI", domain="Urban Planning"),
        core_topic="AI Smart Traffic",
        summary="AI optimizes traffic light timing by 35% in dense metropolitan regions.",
        facts=[
            FactItem(id="F001", statement="AI reduces peak congestion delay by 35% across 12 corridors.", importance=0.95),
            FactItem(id="F002", statement="Smart City IoT grid deployment costs $5.2 million.", importance=0.85)
        ],
        entities=[
            EntityItem(id="E001", name="Smart City IoT", type="Technology", description="Urban traffic sensor system")
        ],
        claims=[
            ClaimItem(id="C001", claim="AI traffic management reduces greenhouse emissions.")
        ],
        statistics=[
            StatisticItem(id="S001", value="35%", context="Reduction in peak congestion delay")
        ]
    )

    with patch("consistency.multilingual.generate_with_qwen") as mock_qwen:
        mock_qwen.side_effect = lambda prompt: f"மொழிபெயர்க்கப்பட்ட: {prompt.split('SOURCE TEXT (English):')[1].split('CRITICAL RULES:')[0].strip()}"
        translated_uckr = MultilingualTransformer.translate_uckr(uckr, "Tamil")

    assert translated_uckr.document.id == "SRC-LANG-001"
    assert len(translated_uckr.facts) == 2
    assert translated_uckr.facts[0].id == "F001"
    assert translated_uckr.facts[1].id == "F002"
    assert "மொழிபெயர்க்கப்பட்ட" in translated_uckr.facts[0].statement


def test_translate_deliverables_and_video_voice():
    sample_outputs = {
        "summary": {
            "text": "AI reduces peak congestion delay by 35%.",
            "key_takeaways": ["35% reduction in delay [F001]", "IoT grid deployed [F002]"],
            "source_facts": ["F001", "F002"]
        },
        "linkedin": {
            "headline": "Transforming Urban Mobility with AI 🚦",
            "post_content": "Our new deployment reduced traffic delays by 35% using smart IoT sensors.",
            "call_to_action": "Read our whitepaper."
        },
        "presentation": {
            "presentation_title": "Smart Cities AI Implementation",
            "slides": [
                {
                    "slide_number": 1,
                    "title": "Congestion Impact",
                    "bullet_points": ["35% delay reduction [F001]", "12 major corridors optimized [F001]"],
                    "speaker_notes": "Emphasize the 35% measured reduction."
                }
            ]
        },
        "video": {
            "video_title": "Urban AI Overview",
            "total_duration_seconds": 30,
            "storyboard": [
                {
                    "scene_number": 1,
                    "visual_prompt": "Cinematic aerial shot of city traffic moving smoothly at night",
                    "narration": "Artificial intelligence algorithms actively reduce traffic delays by 35% in smart cities.",
                    "on_screen_text": "35% Less Traffic Delay [F001]"
                }
            ]
        }
    }

    with patch("consistency.multilingual.generate_with_qwen") as mock_qwen:
        mock_qwen.side_effect = lambda prompt: f"[TAMIL] {prompt.split('SOURCE TEXT (English):')[1].split('CRITICAL RULES:')[0].strip()}"
        translated = MultilingualTransformer.translate_deliverables(sample_outputs, "Tamil")

    assert translated["summary"]["language"] == "Tamil"
    assert "[TAMIL]" in translated["summary"]["text"]
    assert translated["linkedin"]["language"] == "Tamil"
    assert translated["presentation"]["language"] == "Tamil"
    assert translated["video"]["language"] == "Tamil"
    assert translated["video"]["recommended_tts_voice"] == "ta-IN-PallaviNeural"
    assert "[TAMIL]" in translated["video"]["storyboard"][0]["narration"]


def test_translate_api_endpoint():
    payload = {
        "target_language": "Hindi",
        "outputs": {
            "summary": {
                "text": "AI reduces peak congestion by 35%.",
                "key_takeaways": ["35% traffic delay reduction [F001]"]
            }
        }
    }

    with patch("consistency.multilingual.generate_with_qwen", return_value="एआई ने ट्रैफिक जाम में 35% की कमी की।"):
        response = client.post("/consistency/translate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["target_language"] == "Hindi"
    assert data["recommended_voice"] == "hi-IN-SwaraNeural"
    assert data["translated_outputs"]["summary"]["language"] == "Hindi"
    assert "एआई ने ट्रैफिक जाम में 35% की कमी की।" in data["translated_outputs"]["summary"]["text"]


def test_pipeline_with_target_language_tamil():
    sample_text = """
    # AI Smart Traffic Project
    The city deployed an intelligent traffic signal optimization system across 12 major corridors.
    The real-time algorithmic control reduced peak congestion delay by 35%.
    The total implementation budget was $5.2 million in 2025.
    """

    payload = {
        "raw_text": sample_text,
        "title": "AI Smart Traffic",
        "output_types": "summary,video",
        "language": "Tamil"
    }

    with patch("consistency.multilingual.generate_with_qwen") as mock_qwen:
        mock_qwen.side_effect = lambda prompt: f"தமிழ்: {prompt.split('SOURCE TEXT (English):')[1].split('CRITICAL RULES:')[0].strip()}"
        response = client.post("/consistency/pipeline", json=payload)

    assert response.status_code == 200
    res_json = response.json()
    assert res_json["status"] == "success"
    assert "summary" in res_json["outputs"]
    assert "video" in res_json["outputs"]
    assert res_json["outputs"]["video"]["language"] == "Tamil"
    assert res_json["outputs"]["video"]["recommended_tts_voice"] == "ta-IN-PallaviNeural"
