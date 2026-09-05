import io
import os
import pytest
import pymupdf
from pathlib import Path
from docx import Document
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def create_sample_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_sample_docx(text: str) -> bytes:
    doc = Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_voices_endpoint():
    response = client.get("/audio-voices")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "en-IN-NeerjaNeural" in data["recommended_voices"]
    assert "en-US-AriaNeural" in data["recommended_voices"]


def test_simple_generate_audio_and_fetch():
    # Step 6 test
    response = client.post(
        "/generate-audio",
        json={
            "text": "Artificial intelligence is transforming healthcare and modern medicine.",
            "voice": "en-US-AriaNeural"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["filename"].endswith(".mp3")
    assert os.path.exists(data["audio_path"])
    assert os.path.getsize(data["audio_path"]) > 0

    # Step 9 test - GET /audio/{filename}
    filename = data["filename"]
    audio_response = client.get(f"/audio/{filename}")
    assert audio_response.status_code == 200
    assert audio_response.headers["content-type"] == "audio/mpeg"
    assert len(audio_response.content) > 0


def test_generate_video_audio_endpoint():
    # Step 8 test
    video_script = {
        "video_title": "AI in Healthcare",
        "duration": "60 seconds",
        "storyboard": [
            {
                "scene": 1,
                "narration": "Welcome to the future of healthcare. AI is helping doctors diagnose diseases faster."
            },
            {
                "scene": 2,
                "narration": "Machine learning algorithms analyze medical images with extraordinary accuracy."
            }
        ]
    }
    response = client.post(
        "/generate-video-audio",
        json={
            "video_script": video_script,
            "voice": "en-IN-NeerjaNeural"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["filename"].startswith("video_script_")
    assert os.path.exists(data["audio_path"])
    assert os.path.getsize(data["audio_path"]) > 0


def test_end_to_end_doc_to_video_script_to_mp3_pipeline():
    # Step 10: PDF -> /transform-file -> Video Script -> /generate-video-audio -> MP3
    pdf_bytes = create_sample_pdf("Generative AI models enable rapid content transformation and automated video script creation.")
    transform_resp = client.post(
        "/transform-file",
        files={"file": ("medical_report.pdf", pdf_bytes, "application/pdf")},
        data={"output_type": "video_script"}
    )
    assert transform_resp.status_code == 200
    transformed_data = transform_resp.json()
    assert transformed_data["filename"] == "medical_report.pdf"
    video_script_output = transformed_data["outputs"]["video_script"]

    # Now pass the generated video script directly to TTS endpoint
    audio_resp = client.post(
        "/generate-video-audio",
        json={
            "video_script": video_script_output,
            "voice": "en-IN-PrabhatNeural"
        }
    )
    assert audio_resp.status_code == 200
    audio_data = audio_resp.json()
    assert os.path.exists(audio_data["audio_path"])
    assert os.path.getsize(audio_data["audio_path"]) > 0

    # Stream/download audio
    dl_resp = client.get(f"/audio/{audio_data['filename']}")
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "audio/mpeg"
