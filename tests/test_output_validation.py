import json

from fastapi import HTTPException
from fastapi.testclient import TestClient

from validation import (
    clean_reasoning_and_leakage,
    validate_and_format_infographic,
    validate_and_format_video_script,
    validate_output_types,
)
from text.routes import resolve_form_output_types
from main import app


client = TestClient(app)


def test_video_alias_is_normalized_to_video_script():
    assert validate_output_types(["video"]) == ["video_script"]



def test_unknown_output_type_is_rejected():
    try:
        validate_output_types(["abcdef"])
        assert False, "Expected HTTPException for unsupported output type"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Unsupported output type" in str(exc.detail)


def test_swagger_string_placeholder_uses_explicit_output_type():
    assert resolve_form_output_types("summary", "string") == ["summary"]


def test_qwen_supports_every_canonical_output_type(monkeypatch):
    output_types = [
        "summary", "linkedin", "twitter", "advisory",
        "presentation", "video_script", "infographic",
    ]

    def fake_qwen(prompt):
        output_type = next(
            output for output in output_types
            if f"OUTPUT TYPE:\n{output}" in prompt or f"TRANSFORMATION TYPE:\n{output}" in prompt
        )
        if output_type in {"summary", "linkedin", "twitter", "advisory"}:
            return json.dumps({"content": f"Generated {output_type} content."})
        if output_type == "presentation":
            return json.dumps({"presentation_title": "AI Overview", "slides": []})
        if output_type == "infographic":
            return json.dumps({"title": "AI Overview", "main_message": "A clear takeaway."})
        return json.dumps({
            "video_title": "AI Overview",
            "duration": "60 seconds",
            "storyboard": [{"narration": "A useful scene."}],
        })

    monkeypatch.setattr("text.routes.generate_with_qwen", fake_qwen)

    response = client.post(
        "/transform",
        json={
            "text": "Artificial intelligence improves healthcare outcomes.",
            "output_types": output_types,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["output_types"] == output_types
    assert set(data["outputs"]) == set(output_types)
    assert len(data["outputs"]["presentation"]["slides"]) == 1
    assert len(data["outputs"]["video_script"]["storyboard"]) == 6
    assert data["outputs"]["infographic"]["title"] == "AI Overview"


def test_think_blocks_are_removed_from_model_output():
    raw = "<think>We should reason step by step.</think>\n\nRenewable energy reduces dependence on fossil fuels."
    cleaned = clean_reasoning_and_leakage(raw)
    assert "<think>" not in cleaned.lower()
    assert "Renewable energy reduces dependence on fossil fuels." in cleaned


def test_infographic_payload_is_not_downgraded_to_summary_shape():
    result = validate_and_format_infographic({
        "heading": "Key Transformations",
        "content": ["AI improves diagnostic accuracy", "AI supports personalized treatment"],
    })

    assert result["title"] == "Key Transformations"
    assert result["main_message"] == "AI improves diagnostic accuracy"
    assert len(result["sections"]) == 2
    assert result["supporting_text"]


def test_sixty_second_video_has_six_timed_scenes():
    result = validate_and_format_video_script({
        "video_title": "Solar Energy",
        "duration": "60 seconds",
        "storyboard": [{"visuals": "Solar panels in sunlight"}],
    })

    assert len(result["storyboard"]) == 6
    assert [scene["duration"] for scene in result["storyboard"]] == [
        "0-10 sec", "10-20 sec", "20-30 sec", "30-40 sec", "40-50 sec", "50-60 sec"
    ]


def test_video_validator_expands_truncated_single_scene_payload():
    narration = "Artificial intelligence is transforming healthcare by improving diagnosis, patient monitoring, drug discovery, and personalized treatment."
    result = validate_and_format_video_script({
        "video_title": "Artificial intelligence is transforming...",
        "duration": "60 seconds",
        "storyboard": [{
            "scene": 1,
            "duration": "0-10 sec",
            "visuals": "Clean modern visuals with data graphics and a presenter overlay.",
            "narration": narration,
            "on_screen_text": "Artificial intelligence is transforming...",
            "subtitle": narration[:110],
            "transition": "Fade to next scene",
        }],
    })

    assert len(result["storyboard"]) == 6
    assert all(scene["subtitle"] == scene["narration"] for scene in result["storyboard"])
    assert len({scene["narration"] for scene in result["storyboard"]}) == 6


def test_video_validator_divides_repeated_healthcare_narration_into_meaningful_scenes():
    narration = "Artificial intelligence is transforming healthcare by improving diagnosis, patient monitoring, drug discovery, and personalized treatment."
    result = validate_and_format_video_script({
        "video_title": "Artificial intelligence is transforming...",
        "duration": "60 seconds",
        "storyboard": [{
            "scene": index,
            "duration": f"{(index - 1) * 10}-{index * 10} sec",
            "visuals": "Healthcare visuals",
            "narration": narration,
            "on_screen_text": "Healthcare AI",
            "subtitle": narration,
            "transition": "Fade to next scene",
        } for index in range(1, 7)],
    })

    scene_narrations = [scene["narration"] for scene in result["storyboard"]]
    assert len(set(scene_narrations)) == 6
    assert "diagnosis" in scene_narrations[1].lower()
    assert "monitoring" in scene_narrations[2].lower()
    assert "drug discovery" in scene_narrations[3].lower()
    assert "personalized" in scene_narrations[4].lower()


def test_video_script_thirty_second_duration_constraint():
    result = validate_and_format_video_script({
        "video_title": "Tamil Nadu AI Service Platform",
        "duration": "30 seconds",
        "storyboard": [{"visuals": "Digital portal interface"}],
    }, target_duration=30, source_text="Tamil Nadu is deploying an AI digital service platform to streamline citizen requests.")

    assert result["duration"] == "30 seconds"
    assert len(result["storyboard"]) == 6
    assert [scene["duration"] for scene in result["storyboard"]] == [
        "0-5 sec", "5-10 sec", "10-15 sec", "15-20 sec", "20-25 sec", "25-30 sec"
    ]


def test_video_script_strips_meta_phrases_and_ellipses():
    result = validate_and_format_video_script({
        "video_title": "Tamil Nadu Platform",
        "duration": "30 seconds",
        "storyboard": [{
            "scene": 1,
            "duration": "0-5 sec",
            "visuals": "Digital portal for C-Suite & Enterprise Executives",
            "narration": "We are creating a video script for Tamil Nadu AI platform.",
            "on_screen_text": "Tamil Nadu Platform...",
            "subtitle": "We are creating a video script for Tamil Nadu AI platform.",
            "transition": "Fade to next scene",
        }],
    }, target_duration=30, source_text="Tamil Nadu is deploying an AI digital service platform to streamline citizen requests.")

    narration = result["storyboard"][0]["narration"]
    on_screen = result["storyboard"][0]["on_screen_text"]
    assert "we are creating a video script" not in narration.lower()
    assert "..." not in on_screen
    assert "c-suite" not in result["storyboard"][0]["visuals"].lower()
