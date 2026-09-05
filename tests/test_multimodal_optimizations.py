import asyncio
import json

from PIL import Image

from multimodal import routes as multimodal_routes
from multimodal import service as multimodal_service
from multimodal.job_store import create_job
from visual.gemma_model import resize_image_for_gemma


def test_new_multimodal_job_starts_queued():
    job = create_job()

    assert job.status == "queued"
    assert job.progress == 0
    assert job.current_step == "queued"


def test_pdf_job_extracts_text_and_images_once(monkeypatch):
    calls = {"extract": 0, "process": 0}
    image = Image.new("RGB", (4, 4), "green")

    def fake_extract(upload):
        calls["extract"] += 1
        return "document text", [image]

    async def fake_process(**kwargs):
        calls["process"] += 1
        return {
            "text_analysis_qwen": "document summary",
            "image_analysis_gemma": [],
            "outputs": {"summary": {"content": "summary"}},
            "final_combined_output": {"content": "summary"},
        }

    updates = []
    monkeypatch.setattr(multimodal_routes, "extract_pdf_text_and_images", fake_extract)
    monkeypatch.setattr(multimodal_routes, "process_multimodal_content", fake_process)
    monkeypatch.setattr(multimodal_routes, "update_job", lambda *args, **kwargs: updates.append(kwargs))

    asyncio.run(multimodal_routes._run_job(
        job_id="job-1",
        filename="document.pdf",
        pdf_bytes=b"pdf bytes",
        output_types=["summary"],
        audience="General public",
        tone="Professional",
        language="English",
        detail_level="Medium",
        objective="Inform",
    ))

    assert calls == {"extract": 1, "process": 1}
    assert updates[-1]["status"] == "completed"
    assert updates[-1]["result"]["extracted_images_count"] == 1


def test_pdf_job_reports_ordered_processing_states(monkeypatch):
    image = Image.new("RGB", (4, 4), "green")
    updates = []

    async def fake_process(**kwargs):
        progress_callback = kwargs["progress_callback"]
        progress_callback(10, "analyzing_images")
        progress_callback(60, "analyzing_text")
        progress_callback(70, "building_context")
        progress_callback(75, "generating_output")
        progress_callback(95, "parsing_results")
        return {
            "text_analysis_qwen": "document summary",
            "image_analysis_gemma": [],
            "outputs": {"summary": {"content": "summary"}},
            "final_combined_output": {"content": "summary"},
        }

    monkeypatch.setattr(
        multimodal_routes,
        "extract_pdf_text_and_images",
        lambda upload: ("document text", [image]),
    )
    monkeypatch.setattr(multimodal_routes, "process_multimodal_content", fake_process)
    monkeypatch.setattr(
        multimodal_routes,
        "update_job",
        lambda *args, **kwargs: updates.append(kwargs),
    )

    asyncio.run(multimodal_routes._run_job(
        job_id="job-states",
        filename="document.pdf",
        pdf_bytes=b"pdf bytes",
        output_types=["summary"],
        audience="General public",
        tone="Professional",
        language="English",
        detail_level="Medium",
        objective="Inform",
    ))

    assert [update["current_step"] for update in updates] == [
        "extracting_pdf",
        "analyzing_images",
        "analyzing_text",
        "building_context",
        "generating_output",
        "parsing_results",
        "completed",
    ]
    assert all(update["status"] == "processing" for update in updates[:-1])
    assert updates[-1]["status"] == "completed"


def test_pdf_job_reports_failed_terminal_state(monkeypatch):
    updates = []

    def failing_extract(upload):
        raise RuntimeError("bad PDF")

    monkeypatch.setattr(multimodal_routes, "extract_pdf_text_and_images", failing_extract)
    monkeypatch.setattr(
        multimodal_routes,
        "update_job",
        lambda *args, **kwargs: updates.append(kwargs),
    )

    asyncio.run(multimodal_routes._run_job(
        job_id="job-failed",
        filename="document.pdf",
        pdf_bytes=b"pdf bytes",
        output_types=["summary"],
        audience="General public",
        tone="Professional",
        language="English",
        detail_level="Medium",
        objective="Inform",
    ))

    assert updates[0]["current_step"] == "extracting_pdf"
    assert updates[-1]["status"] == "failed"
    assert updates[-1]["current_step"] == "failed"
    assert "bad PDF" in updates[-1]["error"]


def test_multiple_outputs_analyze_each_image_once(monkeypatch):
    async def run_test():
        gemma_calls = []
        qwen_calls = []

        async def fake_gemma(image, prompt, task):
            gemma_calls.append(image)
            return {
                "description": "A visible object",
                "objects": ["object"],
                "visible_text": [],
                "important_details": [],
            }

        def fake_qwen(prompt):
            qwen_calls.append(prompt)
            if len(qwen_calls) == 1:
                return "shared document analysis"
            return json.dumps({"summary": "summary", "linkedin": "linkedin post"})

        monkeypatch.setattr(multimodal_service.gemma_model, "analyze_image", fake_gemma)
        monkeypatch.setattr(multimodal_service, "generate_with_qwen", fake_qwen)
        monkeypatch.setattr(
            multimodal_service,
            "parse_output_content",
            lambda content, output_type, source_text: content,
        )

        images = [
            Image.new("RGB", (4, 4), "green"),
            Image.new("RGB", (4, 4), "blue"),
        ]
        result = await multimodal_service.process_multimodal_content(
            text="document text",
            images=images,
            output_types=["summary", "linkedin"],
            audience="General public",
            tone="Professional",
            language="English",
            detail_level="Medium",
            objective="Inform",
        )

        assert len(gemma_calls) == len(images)
        assert len(qwen_calls) == 2
        assert set(result["outputs"]) == {"summary", "linkedin"}

    asyncio.run(run_test())


def test_gemma_resize_preserves_small_images_and_bounds_large_images():
    small_image = Image.new("RGB", (800, 600), "green")
    large_image = Image.new("RGB", (4000, 3000), "blue")

    assert resize_image_for_gemma(small_image) is small_image
    assert resize_image_for_gemma(large_image).size == (1024, 768)
