from PIL import Image
from io import BytesIO
from typing import Optional

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/pjpeg",
    "image/x-png",
    "application/octet-stream"
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def validate_image(content_type: Optional[str] = None, filename: Optional[str] = None):
    """Check whether uploaded file is a supported image format by content_type and/or filename."""
    valid_mime = content_type and content_type.lower() in ALLOWED_IMAGE_TYPES
    valid_ext = filename and any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)

    if not valid_mime and not valid_ext:
        raise ValueError(
            "Unsupported image format. Only JPG, JPEG and PNG are allowed."
        )


def load_image(image_bytes: bytes) -> Image.Image:
    """Convert uploaded bytes into a PIL Image in RGB format."""
    try:
        image_stream = BytesIO(image_bytes)
        image = Image.open(image_stream)
        image.verify()

        # Reopen after verify because verify() leaves the image unusable.
        image = Image.open(BytesIO(image_bytes))
        image = image.convert("RGB")
        return image
    except Exception as e:
        raise ValueError(f"Invalid image file or corrupted image data: {str(e)}")
