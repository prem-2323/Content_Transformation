import io
import re
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
import pymupdf
from docx import Document
from pypdf import PdfReader
from PIL import Image
import requests
from bs4 import BeautifulSoup

from .schemas import NormalizedSource, SourceSection, SourceType


def _generate_source_id() -> str:
    """Generate sequential or short unique source identifier like SRC-001."""
    short_id = uuid.uuid4().hex[:6].upper()
    return f"SRC-{short_id}"


def _clean_text(text: str) -> str:
    """Clean whitespace, trailing carriage returns, and normalize text."""
    if not text:
        return ""
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_from_raw_text(
    raw_text: str,
    title: Optional[str] = None,
    source_type: SourceType = SourceType.RAW_TEXT,
    metadata: Optional[Dict[str, Any]] = None
) -> NormalizedSource:
    """Extract and normalize raw text input."""
    clean_content = _clean_text(raw_text)
    if not clean_content:
        raise ValueError("Provided raw text is empty.")

    source_id = _generate_source_id()
    doc_title = title.strip() if title and title.strip() else f"Source {source_id}"

    # Break into logical paragraph sections
    paragraphs = [p.strip() for p in clean_content.split("\n\n") if p.strip()]
    sections: List[SourceSection] = []

    for idx, p in enumerate(paragraphs, 1):
        heading = None
        if len(p) < 80 and not p.endswith((".", "?", "!")):
            heading = p
        sections.append(SourceSection(
            section_id=f"sec_{idx}",
            heading=heading,
            page_number=1,
            text=p
        ))

    meta = metadata or {}
    meta.update({
        "character_count": len(clean_content),
        "word_count": len(clean_content.split()),
        "section_count": len(sections),
    })

    return NormalizedSource(
        source_id=source_id,
        title=doc_title,
        source_type=source_type,
        raw_text=clean_content,
        sections=sections,
        images=[],
        tables=[],
        metadata=meta,
        created_at=datetime.utcnow().isoformat()
    )


def extract_from_pdf_bytes(
    pdf_bytes: bytes,
    filename: str = "document.pdf",
    title: Optional[str] = None
) -> NormalizedSource:
    """Extract normalized source from PDF bytes using PyMuPDF and pypdf."""
    source_id = _generate_source_id()
    sections: List[SourceSection] = []
    images_meta: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []
    raw_chunks: List[str] = []

    doc_title = title or filename.rsplit(".", 1)[0]

    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        meta_dict = doc.metadata or {}
        if meta_dict.get("title") and not title:
            doc_title = meta_dict["title"]

        for page_idx, page in enumerate(doc, 1):
            page_text = page.get_text("text").strip()
            if page_text:
                clean_p = _clean_text(page_text)
                raw_chunks.append(clean_p)
                sections.append(SourceSection(
                    section_id=f"page_{page_idx}",
                    heading=f"Page {page_idx}",
                    page_number=page_idx,
                    text=clean_p
                ))

            # Extract image metadata
            image_list = page.get_images(full=True)
            for img_info in image_list:
                images_meta.append({
                    "page_number": page_idx,
                    "xref": img_info[0],
                    "width": img_info[2],
                    "height": img_info[3]
                })

            # Extract tables if pymupdf find_tables is available
            try:
                tabs = page.find_tables()
                if tabs and hasattr(tabs, "tables"):
                    for t_idx, t in enumerate(tabs.tables, 1):
                        extracted_table = t.extract()
                        if extracted_table:
                            tables.append({
                                "page_number": page_idx,
                                "table_index": t_idx,
                                "headers": extracted_table[0] if extracted_table else [],
                                "rows": extracted_table[1:] if len(extracted_table) > 1 else []
                            })
            except Exception:
                pass

    combined_text = "\n\n".join(raw_chunks).strip()
    if not combined_text:
        # Fallback to PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        fallback_chunks = [p.extract_text() for p in reader.pages if p.extract_text()]
        combined_text = "\n\n".join(fallback_chunks).strip()
        for idx, text_block in enumerate(fallback_chunks, 1):
            sections.append(SourceSection(
                section_id=f"page_{idx}",
                heading=f"Page {idx}",
                page_number=idx,
                text=text_block
            ))

    metadata = {
        "filename": filename,
        "page_count": len(sections),
        "image_count": len(images_meta),
        "table_count": len(tables),
        "word_count": len(combined_text.split())
    }

    return NormalizedSource(
        source_id=source_id,
        title=doc_title,
        source_type=SourceType.PDF,
        raw_text=combined_text,
        sections=sections,
        images=images_meta,
        tables=tables,
        metadata=metadata,
        created_at=datetime.utcnow().isoformat()
    )


def extract_from_docx_bytes(
    docx_bytes: bytes,
    filename: str = "document.docx",
    title: Optional[str] = None
) -> NormalizedSource:
    """Extract normalized source from DOCX file bytes."""
    source_id = _generate_source_id()
    doc_stream = io.BytesIO(docx_bytes)
    doc = Document(doc_stream)

    doc_title = title or filename.rsplit(".", 1)[0]
    sections: List[SourceSection] = []
    tables: List[Dict[str, Any]] = []
    text_parts: List[str] = []

    current_heading = "Introduction"
    current_paragraphs: List[str] = []
    sec_idx = 1

    for p in doc.paragraphs:
        txt = p.text.strip()
        if not txt:
            continue

        if p.style and p.style.name.startswith("Heading"):
            if current_paragraphs:
                section_text = "\n".join(current_paragraphs)
                sections.append(SourceSection(
                    section_id=f"sec_{sec_idx}",
                    heading=current_heading,
                    text=section_text
                ))
                text_parts.append(section_text)
                sec_idx += 1
                current_paragraphs = []
            current_heading = txt
        else:
            current_paragraphs.append(txt)

    if current_paragraphs:
        section_text = "\n".join(current_paragraphs)
        sections.append(SourceSection(
            section_id=f"sec_{sec_idx}",
            heading=current_heading,
            text=section_text
        ))
        text_parts.append(section_text)

    # Extract tables from DOCX
    for t_idx, table in enumerate(doc.tables, 1):
        table_data = []
        for row in table.rows:
            row_data = [cell.text.strip() for cell in row.cells]
            table_data.append(row_data)
        if table_data:
            tables.append({
                "table_index": t_idx,
                "headers": table_data[0] if table_data else [],
                "rows": table_data[1:] if len(table_data) > 1 else []
            })

    combined_text = "\n\n".join(text_parts).strip()

    metadata = {
        "filename": filename,
        "section_count": len(sections),
        "table_count": len(tables),
        "word_count": len(combined_text.split())
    }

    return NormalizedSource(
        source_id=source_id,
        title=doc_title,
        source_type=SourceType.DOCX,
        raw_text=combined_text,
        sections=sections,
        images=[],
        tables=tables,
        metadata=metadata,
        created_at=datetime.utcnow().isoformat()
    )


def extract_from_txt_bytes(
    txt_bytes: bytes,
    filename: str = "document.txt",
    title: Optional[str] = None
) -> NormalizedSource:
    """Extract normalized source from plain TXT file bytes."""
    try:
        content = txt_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = txt_bytes.decode("latin-1", errors="ignore")

    doc_title = title or filename.rsplit(".", 1)[0]
    return extract_from_raw_text(
        raw_text=content,
        title=doc_title,
        source_type=SourceType.TXT,
        metadata={"filename": filename}
    )


def extract_from_url(url: str, title: Optional[str] = None) -> NormalizedSource:
    """Fetch website or article from URL and extract normalized source."""
    source_id = _generate_source_id()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove script and style tags
    for s in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        s.decompose()

    extracted_title = title
    if not extracted_title:
        title_tag = soup.find("title") or soup.find("h1")
        if title_tag:
            extracted_title = title_tag.get_text().strip()
        else:
            extracted_title = url

    # Extract article/main text or body paragraphs
    main_content = soup.find("article") or soup.find("main") or soup.find("body")
    paragraphs = []
    if main_content:
        for p in main_content.find_all(["p", "h2", "h3", "li"]):
            t = p.get_text().strip()
            if len(t) > 20:
                paragraphs.append(t)

    combined_text = "\n\n".join(paragraphs).strip()
    if not combined_text and main_content:
        combined_text = _clean_text(main_content.get_text())

    sections = [
        SourceSection(
            section_id=f"web_p_{i}",
            heading=None,
            page_number=1,
            text=p
        )
        for i, p in enumerate(paragraphs, 1)
    ]

    metadata = {
        "url": url,
        "status_code": response.status_code,
        "content_length": len(combined_text),
        "word_count": len(combined_text.split())
    }

    return NormalizedSource(
        source_id=source_id,
        title=extracted_title or "Web Document",
        source_type=SourceType.WEB,
        raw_text=combined_text,
        sections=sections,
        images=[],
        tables=[],
        metadata=metadata,
        created_at=datetime.utcnow().isoformat()
    )


def extract_from_image_bytes(
    img_bytes: bytes,
    filename: str = "image.png",
    title: Optional[str] = None
) -> NormalizedSource:
    """Extract source from image."""
    source_id = _generate_source_id()
    img = Image.open(io.BytesIO(img_bytes))
    doc_title = title or filename.rsplit(".", 1)[0]

    # Use basic image description metadata
    metadata = {
        "filename": filename,
        "format": img.format,
        "size": [img.width, img.height],
        "mode": img.mode
    }

    raw_text = f"Visual source document from image file {filename}. Dimensions: {img.width}x{img.height}."

    return NormalizedSource(
        source_id=source_id,
        title=doc_title,
        source_type=SourceType.IMAGE,
        raw_text=raw_text,
        sections=[SourceSection(section_id="img_1", heading="Image 1", text=raw_text)],
        images=[metadata],
        tables=[],
        metadata=metadata,
        created_at=datetime.utcnow().isoformat()
    )


def extract_source(
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    raw_text: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    source_type: Optional[SourceType] = None
) -> NormalizedSource:
    """Master extraction dispatcher capable of handling any source input."""
    if url:
        return extract_from_url(url=url, title=title)

    if file_bytes and filename:
        lower_fn = filename.lower()
        if lower_fn.endswith(".pdf"):
            return extract_from_pdf_bytes(file_bytes, filename=filename, title=title)
        elif lower_fn.endswith((".docx", ".doc")):
            return extract_from_docx_bytes(file_bytes, filename=filename, title=title)
        elif lower_fn.endswith(".txt"):
            return extract_from_txt_bytes(file_bytes, filename=filename, title=title)
        elif lower_fn.endswith((".png", ".jpg", ".jpeg", ".webp")):
            return extract_from_image_bytes(file_bytes, filename=filename, title=title)
        else:
            # Attempt plain text parse
            return extract_from_txt_bytes(file_bytes, filename=filename, title=title)

    if raw_text:
        return extract_from_raw_text(raw_text=raw_text, title=title, source_type=source_type or SourceType.RAW_TEXT)

    raise ValueError("No valid input source provided. Provide file_bytes, raw_text, or url.")
