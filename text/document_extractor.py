import io
from pypdf import PdfReader
from docx import Document


def extract_txt(file) -> str:
    """Extract text from uploaded TXT file safely."""
    file.file.seek(0)
    content = file.file.read()
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1", errors="ignore")


def extract_pdf(file) -> str:
    """Extract text from uploaded PDF file safely using BytesIO."""
    file.file.seek(0)
    pdf_bytes = file.file.read()
    pdf_stream = io.BytesIO(pdf_bytes)

    reader = PdfReader(pdf_stream)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def extract_docx(file) -> str:
    """Extract text from uploaded DOCX file safely using BytesIO."""
    file.file.seek(0)
    docx_bytes = file.file.read()
    docx_stream = io.BytesIO(docx_bytes)

    document = Document(docx_stream)
    text = ""
    for paragraph in document.paragraphs:
        if paragraph.text.strip():
            text += paragraph.text + "\n"
    return text

