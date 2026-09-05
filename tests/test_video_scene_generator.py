import pytest

from video import scene_generator


def make_scene(scene_number: int) -> dict:
    return {
        "scene_number": scene_number,
        "duration": 5,
        "narration": f"Narration for scene {scene_number}.",
        "visual_prompt": "cinematic smart city at sunrise",
        "on_screen_text": "Smarter cities",
    }


def test_extract_json_object_handles_fenced_prose():
    raw = "Here is the plan:\n```json\n{\"title\":\"Cities\",\"scenes\":" \
        + str([make_scene(number) for number in range(1, 6)]).replace("'", '"') \
        + "}\n```"

    result = scene_generator._extract_json_object(raw)

    assert result["title"] == "Cities"
    assert len(result["scenes"]) == 5


def test_validate_scenes_rejects_missing_fields_and_invalid_counts():
    with pytest.raises(ValueError, match="Qwen returned only 1 scenes"):
        scene_generator._validate_scenes({"scenes": [make_scene(1)]})

    incomplete = [make_scene(number) for number in range(1, 6)]
    del incomplete[0]["visual_prompt"]
    with pytest.raises(ValueError, match="missing field: visual_prompt"):
        scene_generator._validate_scenes({"scenes": incomplete})


def test_generate_video_scenes_requests_json_mode(monkeypatch):
    scenes = [make_scene(number) for number in range(1, 7)]
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": '{"title":"Cities","scenes":' + str(scenes).replace("'", '"') + "}"}

    def fake_post(url, **kwargs):
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(scene_generator.requests, "post", fake_post)

    result = scene_generator.generate_video_scenes("Artificial intelligence transforms cities.")

    assert captured["json"]["format"] == "json"
    assert f"exactly {scene_generator.DEFAULT_SCENE_COUNT} scenes" in captured["json"]["prompt"]
    assert "Impact or real-world example" in captured["json"]["prompt"]
    assert len(result["scenes"]) == 6
    assert result["total_duration"] == 30
    assert all(
        set(scene_generator.REQUIRED_SCENE_FIELDS) <= set(scene)
        for scene in result["scenes"]
    )
