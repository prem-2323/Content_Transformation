import io
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
