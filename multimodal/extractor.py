import io
from typing import Tuple, List
from PIL import Image
from pypdf import PdfReader


def extract_pdf_text_and_images(file) -> Tuple[str, List[Image.Image]]:
    """Extract both raw text and embedded PIL images from uploaded PDF file."""
    file.file.seek(0)
    pdf_bytes = file.file.read()
    pdf_stream = io.BytesIO(pdf_bytes)

    reader = PdfReader(pdf_stream)
    text_chunks = []
    images = []

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_chunks.append(page_text)

        # Extract embedded images from page
        for image_file in page.images:
            try:
                img_stream = io.BytesIO(image_file.data)
                pil_img = Image.open(img_stream).convert("RGB")
                images.append(pil_img)
            except Exception as e:
                # Log or skip unparseable embedded image streams
                continue

    combined_text = "\n".join(text_chunks).strip()
    return combined_text, images
