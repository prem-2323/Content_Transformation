import io
import json
import pytest
import pymupdf
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


def test_transform_file_txt_single_output():
    txt_content = b"Artificial intelligence is transforming healthcare and modern medicine."
    response = client.post(
        "/transform-file",
        files={"file": ("test.txt", txt_content, "text/plain")},
        data={
            "output_type": "summary",
            "output_types": "",
            "audience": "General public",
            "tone": "Professional",
            "language": "English",
            "detail_level": "Medium",
            "objective": "Inform"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.txt"
    assert "extracted_text" in data
    assert "Artificial intelligence" in data["extracted_text"]
    assert "generated_content" in data
    assert "outputs" in data
    assert "summary" in data["outputs"]


def test_transform_file_pdf_single_output():
    pdf_bytes = create_sample_pdf("Artificial intelligence enhances medical diagnostic accuracy and patient monitoring.")
    response = client.post(
        "/transform-file",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
        data={
            "output_type": "summary",
            "output_types": "",
            "audience": "General public",
            "tone": "Professional",
            "language": "English",
            "detail_level": "Medium",
            "objective": "Inform"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.pdf"
    assert "extracted_text" in data
    assert "diagnostic accuracy" in data["extracted_text"]
    assert "generated_content" in data
    assert "outputs" in data
    assert "summary" in data["outputs"]


def test_transform_file_docx_single_output():
    docx_bytes = create_sample_docx("Artificial intelligence speeds up drug discovery and clinical trial optimization.")
    response = client.post(
        "/transform-file",
        files={"file": ("test.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={
            "output_type": "summary",
            "output_types": "",
            "audience": "General public",
            "tone": "Professional",
            "language": "English",
            "detail_level": "Medium",
            "objective": "Inform"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.docx"
    assert "extracted_text" in data
    assert "drug discovery" in data["extracted_text"]
    assert "generated_content" in data
    assert "outputs" in data
    assert "summary" in data["outputs"]


def test_transform_file_multiple_outputs():
    pdf_bytes = create_sample_pdf("Generative AI models enable rapid content transformation and automated summarization.")
    response = client.post(
        "/transform-file",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
        data={
            "output_types": "summary,linkedin,twitter",
            "audience": "General public",
            "tone": "Professional",
            "language": "English",
            "detail_level": "Medium",
            "objective": "Inform"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.pdf"
    assert "extracted_text" in data
    assert "outputs" in data
    assert "summary" in data["outputs"]
    assert "linkedin" in data["outputs"]
    assert "twitter" in data["outputs"]


@pytest.mark.parametrize("filename, content_type, source_text, marker", [
    ("test.txt", "text/plain", "TXT content for transformation.", "TXT content"),
    ("test.pdf", "application/pdf", "PDF content for transformation.", "PDF content"),
    ("test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX content for transformation.", "DOCX content"),
])
def test_transform_file_all_document_types_with_multiple_outputs(
    monkeypatch, filename, content_type, source_text, marker
):
    if filename.endswith(".pdf"):
        file_bytes = create_sample_pdf(source_text)
    elif filename.endswith(".docx"):
        file_bytes = create_sample_docx(source_text)
    else:
        file_bytes = source_text.encode("utf-8")

    def fake_qwen(prompt):
        output_type = prompt.split("OUTPUT TYPE:\n", 1)[1].split("\n", 1)[0]
        return json.dumps({"content": f"Generated {output_type} content."})

    monkeypatch.setattr("text.routes.generate_with_qwen", fake_qwen)

    response = client.post(
        "/transform-file",
        files={"file": (filename, file_bytes, content_type)},
        data={"output_types": "summary,linkedin,twitter"},
    )

    assert response.status_code == 200
    data = response.json()
    assert marker in data["extracted_text"]
    assert set(data["outputs"]) == {"summary", "linkedin", "twitter"}
