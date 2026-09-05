import base64
import os
from io import BytesIO

import requests


IMAGE_MODEL_URL = os.getenv("IMAGE_MODEL_URL", "http://127.0.0.1:7860")
IMAGE_MODEL_TIMEOUT_SECONDS = int(os.getenv("IMAGE_MODEL_TIMEOUT_SECONDS", "180"))
DEFAULT_WIDTH = 512
DEFAULT_HEIGHT = 512
DEFAULT_STEPS = 20
DEFAULT_CFG_SCALE = 7
DEFAULT_SAMPLER = "DPM++ 2M Karras"
DEFAULT_BATCH_SIZE = 1
DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, low resolution, distorted, deformed, bad anatomy, "
    "malformed hands, extra fingers, extra limbs, duplicate people, unnatural faces, "
    "distorted faces, cartoon, anime, illustration, watermark, logo, text, letters, "
    "oversaturated, unrealistic, poor composition, cropped subjects"
)


class ImageGenerationError(Exception):
    """Raised when the configured image model cannot generate an image."""


def generate_image_bytes(
    prompt: str,
    negative_prompt: str,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    steps: int = DEFAULT_STEPS,
    cfg_scale: int = DEFAULT_CFG_SCALE,
    sampler_name: str = DEFAULT_SAMPLER,
) -> bytes:
    """Generate an image through the Stable Diffusion WebUI txt2img API."""
    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "sampler_name": sampler_name,
        "batch_size": DEFAULT_BATCH_SIZE,
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
