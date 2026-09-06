from fastapi.testclient import TestClient

from image import routes
from main import app


client = TestClient(app)


def test_direct_image_generation_contract(monkeypatch):
    monkeypatch.setattr(routes, "generate_and_save_image", lambda **kwargs: ("image_123.png", 2.5, "cuda"))

    response = client.post(
        "/generate-image",
        json={"prompt": "A futuristic smart city using artificial intelligence", "mode": "fast"},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "success"
    assert res["filename"] == "image_123.png"
    assert res["image_path"] == "generated_images/image_123.png"
    assert res["generation_time"] == 2.5
    assert res["device"] == "cuda"
    assert res["steps"] == 10
    assert res["width"] == 768
    assert res["height"] == 768


def test_scene_generation_uses_qwen_prompts_and_scene_names(monkeypatch):
    captured = []

    monkeypatch.setattr(
        routes,
        "generate_scene_prompts",
        lambda script: [
            {"scene": 1, "prompt": "A modern hospital with an AI diagnostic system"},
            {"scene": 2, "prompt": "Doctors reviewing a glowing medical dashboard"},
        ],
    )

    def fake_generate(**kwargs):
        captured.append(kwargs.get("prompt", ""))
        return f"scene_{len(captured):02d}_abc.png", 1.8, "cuda"

    monkeypatch.setattr(routes, "generate_and_save_image", fake_generate)

    response = client.post(
        "/generate-scene-images",
        json={
            "script": {
                "video_title": "AI in healthcare",
                "storyboard": [{"scene": 1}, {"scene": 2}],
            }
        },
    )

    assert response.status_code == 200
    assert [item["filename"] for item in response.json()["images"]] == [
        "scene_01_abc.png",
        "scene_02_abc.png",
    ]
    assert captured[0].startswith("A modern hospital")
    assert captured[1].startswith("Doctors reviewing")
