import base64
import os
from io import BytesIO

import requests


IMAGE_MODEL_URL = os.getenv("IMAGE_MODEL_URL", "http://127.0.0.1:7860")
IMAGE_MODEL_TIMEOUT_SECONDS = int(os.getenv("IMAGE_MODEL_TIMEOUT_SECONDS", "180"))


class ImageGenerationError(Exception):
    """Raised when the configured image model cannot generate an image."""


def generate_image_bytes(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    steps: int,
) -> bytes:
    """Generate an image through the Stable Diffusion WebUI txt2img API."""
    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "steps": steps,
        "batch_size": 1,
    }
    try:
        response = requests.post(
            f"{IMAGE_MODEL_URL.rstrip('/')}/sdapi/v1/txt2img",
            json=payload,
            timeout=(3.0, IMAGE_MODEL_TIMEOUT_SECONDS),
        )
        response.raise_for_status()
        images = response.json().get("images", [])
        if not images:
            raise ImageGenerationError("The image model returned no image data.")
        encoded_image = images[0].split(",", 1)[-1]
        return base64.b64decode(encoded_image)
    except ImageGenerationError:
        raise
    except (requests.exceptions.RequestException, ValueError, base64.binascii.Error) as error:
        raise ImageGenerationError(
            "The image model is unavailable. Start Stable Diffusion WebUI with its API enabled."
        ) from error
