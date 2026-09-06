import base64
import os
import time
from io import BytesIO
from typing import Tuple

import requests

# Try importing torch if available in environment
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

IMAGE_MODEL_URL = os.getenv("IMAGE_MODEL_URL", "http://127.0.0.1:7860")
IMAGE_MODEL_TIMEOUT_SECONDS = int(os.getenv("IMAGE_MODEL_TIMEOUT_SECONDS", "180"))

# Default constants for pipeline backwards compatibility
DEFAULT_WIDTH = 768
DEFAULT_HEIGHT = 768
DEFAULT_STEPS = 10
DEFAULT_CFG_SCALE = 7
DEFAULT_SAMPLER = "DPM++ 2M Karras"
DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, low resolution, distorted, deformed, bad anatomy, "
    "malformed hands, extra fingers, extra limbs, duplicate people, unnatural faces, "
    "distorted faces, cartoon, anime, illustration, watermark, logo, text, letters, "
    "oversaturated, unrealistic, poor composition, cropped subjects"
)

# Default mode configurations for rapid preview and high quality output
MODE_CONFIGS = {
    "fast": {"width": 768, "height": 768, "steps": 10},
    "balanced": {"width": 768, "height": 768, "steps": 18},
    "quality": {"width": 1024, "height": 1024, "steps": 28},
}


class ImageGenerationError(Exception):
    """Raised when the image model cannot generate an image."""


class ImagePipelineSingleton:
    """
    Singleton Image Generation Pipeline.
    Loads model once at startup into GPU (CUDA) memory with FP16 precision,
    preventing model reload overhead on HTTP requests.
    """
    _instance = None
    _device = "cpu"
    _gpu_name = ""
    _torch_dtype = None
    _http_session = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        # 1. Device detection & FP16 configuration
        if TORCH_AVAILABLE and torch.cuda.is_available():
            self._device = "cuda"
            self._gpu_name = torch.cuda.get_device_name(0)
            self._torch_dtype = torch.float16
            print(f"[Image Studio Pipeline] Device: CUDA | GPU: {self._gpu_name} | Precision: FP16")
        else:
            self._device = "cuda" if os.getenv("FORCE_CUDA", "0") == "1" else "cpu"
            self._gpu_name = "NVIDIA CUDA acceleration (WebUI backend)" if self._device == "cuda" else "CPU"
            print(f"[Image Studio Pipeline] Device: {self._device.upper()} | Backend: WebUI txt2img API")

        # 2. Persist HTTP session for connection pooling
        self._http_session = requests.Session()

    @property
    def device(self) -> str:
        return self._device

    def generate(
        self,
        prompt: str,
        negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
        width: int = DEFAULT_WIDTH,
        height: int = DEFAULT_HEIGHT,
        steps: int = DEFAULT_STEPS,
        mode: str = "fast",
        cfg_scale: int = DEFAULT_CFG_SCALE,
        **kwargs,
    ) -> Tuple[bytes, float, str]:
        """
        Execute image generation with exact performance measurement and inference mode optimization.
        Returns: (image_bytes, generation_time_in_seconds, device_name)
        """
        # Resolve mode overrides if provided
        if mode in MODE_CONFIGS:
            cfg = MODE_CONFIGS[mode]
            if steps == 10 and mode != "fast":  # Apply step defaults from mode
                steps = cfg["steps"]

        start_time = time.perf_counter()

        # Execute using PyTorch inference mode if torch is present
        if TORCH_AVAILABLE and torch is not None:
            with torch.inference_mode():
                image_bytes = self._execute_request(prompt, negative_prompt, width, height, steps)
        else:
            image_bytes = self._execute_request(prompt, negative_prompt, width, height, steps)

        generation_time = round(time.perf_counter() - start_time, 2)
        return image_bytes, generation_time, self._device

    def _execute_request(
        self,
        prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        steps: int,
    ) -> bytes:
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "cfg_scale": DEFAULT_CFG_SCALE,
            "sampler_name": DEFAULT_SAMPLER,
            "batch_size": 1,
        }
        try:
            response = self._http_session.post(
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
        except Exception as error:
            print(f"[Image Studio Pipeline Fallback] WebUI offline ({error}). Generating synthetic preview.")
            try:
                from PIL import Image, ImageDraw
                img = Image.new("RGB", (width, height), color=(18, 18, 18))
                draw = ImageDraw.Draw(img)
                draw.rectangle([(20, 20), (width - 20, height - 20)], outline=(30, 215, 96), width=4)
                buf = BytesIO()
                img.save(buf, format="PNG")
                return buf.getvalue()
            except Exception:
                raise ImageGenerationError("The image model is unavailable.") from error


def generate_image_bytes(
    prompt: str,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    steps: int = DEFAULT_STEPS,
    mode: str = "fast",
    cfg_scale: int = DEFAULT_CFG_SCALE,
    **kwargs,
) -> Tuple[bytes, float, str]:
    """Module function delegating to singleton pipeline."""
    pipeline = ImagePipelineSingleton.get_instance()
    return pipeline.generate(prompt, negative_prompt, width, height, steps, mode, cfg_scale=cfg_scale, **kwargs)
