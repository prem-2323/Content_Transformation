"""
video/service.py
~~~~~~~~~~~~~~~~
Orchestrates Step 7 (scene images via Forge) and Step 8 (narration MP3s via TTS)
for every scene produced by the scene generator.

Pipeline per scene:
    visual_prompt  → Forge /sdapi/v1/txt2img → scene_XX.png   (generated_images/)
    narration text → Edge TTS               → scene_XX.mp3   (generated_audio/)
"""

import asyncio
import os
from pathlib import Path
from io import BytesIO

from PIL import Image

from image.generator import (
    DEFAULT_CFG_SCALE,
    DEFAULT_HEIGHT,
    DEFAULT_NEGATIVE_PROMPT as IMAGE_DEFAULT_NEGATIVE_PROMPT,
    DEFAULT_SAMPLER,
    DEFAULT_STEPS,
    DEFAULT_WIDTH,
    ImageGenerationError,
    generate_image_bytes,
)
from video.tts import generate_narration, DEFAULT_VOICE


# ── Storage paths ──────────────────────────────────────────────────────────────

IMAGES_DIR = Path(os.getenv("IMAGE_STORAGE", "generated_images"))
AUDIO_DIR  = Path(os.getenv("AUDIO_STORAGE", "generated_audio"))

# Shared negative prompt for all scene images
DEFAULT_IMAGE_STYLE = (
    "Photorealistic cinematic documentary style, realistic modern environment, "
    "professional visual storytelling, natural realistic lighting, realistic colors, "
    "highly detailed, sharp focus, realistic human anatomy, realistic architecture, "
    "cinematic composition, wide shot"
)
DEFAULT_NEGATIVE_PROMPT = IMAGE_DEFAULT_NEGATIVE_PROMPT


# ── Step 7: Scene Image Generation ────────────────────────────────────────────

def generate_scene_image(
    scene: dict,
    index: int,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    steps: int = DEFAULT_STEPS,
    cfg_scale: int = DEFAULT_CFG_SCALE,
    sampler_name: str = DEFAULT_SAMPLER,
) -> str:
    """Generate and save one scene image via Forge API.

    Args:
        scene:           Scene dict with at least a 'visual_prompt' key.
        index:           1-based scene index (used for the filename).
        negative_prompt: Negative prompt forwarded to Stable Diffusion.
        width / height:  Image dimensions (512×512 default for RTX 3050).
        steps:           Diffusion steps.

    Returns:
        Absolute path to the saved PNG file.

    Raises:
        ImageGenerationError: If Forge/SD is unreachable or returns no image.
    """
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    visual_prompt = scene.get("visual_prompt", "cinematic scene, highly detailed")
    prompt = f"{DEFAULT_IMAGE_STYLE}, {visual_prompt.strip()}"
    filename = f"scene_{index:02d}.png"
    output_path = IMAGES_DIR / filename

    raw_res = generate_image_bytes(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        steps=steps,
        cfg_scale=cfg_scale,
        sampler_name=sampler_name,
    )
    image_bytes = raw_res[0] if isinstance(raw_res, tuple) else raw_res

    # Validate + normalise to RGB PNG
    with Image.open(BytesIO(image_bytes)) as img:
        img.load()
        img.convert("RGB").save(output_path, format="PNG", optimize=True)

    return str(output_path)


def generate_all_scene_images(
    scenes: list,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    steps: int = DEFAULT_STEPS,
    cfg_scale: int = DEFAULT_CFG_SCALE,
    sampler_name: str = DEFAULT_SAMPLER,
) -> list[str]:
    """Generate one PNG per scene (sequential — Forge handles one job at a time).

    Args:
        scenes: List of scene dicts from scene_generator.generate_video_scenes().

    Returns:
        Ordered list of PNG file paths, matching the input scene order.

    Raises:
        ImageGenerationError: On first scene that fails.
    """
    image_paths = []
    for i, scene in enumerate(scenes, start=1):
        path = generate_scene_image(
            scene=scene,
            index=i,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg_scale=cfg_scale,
            sampler_name=sampler_name,
        )
        image_paths.append(path)
    return image_paths


# ── Step 8: Scene Narration (TTS) ─────────────────────────────────────────────

async def generate_scene_audio(
    scene: dict,
    index: int,
    voice: str = DEFAULT_VOICE,
) -> str:
    """Generate and save one MP3 narration for a scene via Edge TTS.

    Args:
        scene: Scene dict with at least a 'narration' key.
        index: 1-based scene index (used for the filename).
        voice: Edge TTS voice name.

    Returns:
        Absolute path to the saved MP3 file.
    """
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    narration_text = scene.get("narration", "").strip() or f"Scene {index}."
    output_file = str(AUDIO_DIR / f"scene_{index:02d}.mp3")

    await generate_narration(text=narration_text, output_file=output_file, voice=voice)
    return output_file


async def generate_all_scene_audio(
    scenes: list,
    voice: str = DEFAULT_VOICE,
) -> list[str]:
    """Generate all scene narration MP3s concurrently via Edge TTS.

    Args:
        scenes: List of scene dicts from scene_generator.generate_video_scenes().
        voice:  Edge TTS voice name.

    Returns:
        Ordered list of MP3 file paths matching the input scene order.
    """
    tasks = [
        generate_scene_audio(scene=scene, index=i, voice=voice)
        for i, scene in enumerate(scenes, start=1)
    ]
    return list(await asyncio.gather(*tasks))


# ── Combined: Steps 7 + 8 together ────────────────────────────────────────────

async def generate_scene_assets(
    scenes: list,
    voice: str = DEFAULT_VOICE,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
    width: int = 512,
    height: int = 512,
    steps: int = 20,
) -> dict:
    """Run Steps 7 and 8 together: images (Forge) + audio (TTS) for all scenes.

    Images are generated sequentially (Forge limitation).
    Audio files are generated concurrently (Edge TTS is async-friendly).

    Returns:
        {
          "image_paths": ["generated_images/scene_01.png", ...],
          "audio_paths": ["generated_audio/scene_01.mp3", ...],
        }
    """
    # Step 7 — Scene images (sequential, Forge processes one at a time)
    image_paths = generate_all_scene_images(
        scenes=scenes,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        steps=steps,
    )

    # Step 8 — Narration MP3s (concurrent, TTS is fast)
    audio_paths = await generate_all_scene_audio(scenes=scenes, voice=voice)

    return {
        "image_paths": image_paths,
        "audio_paths": audio_paths,
    }
