"""
video/routes.py
~~~~~~~~~~~~~~~
FastAPI router for the full video generation pipeline.

POST /generate-video
    text → Qwen3 scenes → Forge images → Edge TTS audio
         → FFmpeg scene videos → concat → SRT → subtitle burn
    Returns: VideoResponse with final MP4 path + metadata.

GET /video/{filename}
    Stream / download a generated MP4 by filename.
"""

import asyncio
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from image.generator import ImageGenerationError
from text.qwen_service import QwenServiceError

from .renderer import (
    burn_subtitles,
    concatenate_scene_videos,
    generate_srt,
    get_scene_duration,
    render_all_scene_videos,
)
from .scene_generator import generate_video_scenes
from .schemas import SceneSummary, VideoRequest, VideoResponse
from .service import generate_all_scene_audio, generate_all_scene_images


router = APIRouter(prefix="/video", tags=["Video Generation"])

VIDEO_DIR = Path(os.getenv("VIDEO_STORAGE", "generated_videos"))


# ── POST /video/generate-video ─────────────────────────────────────────────────

@router.post(
    "/generate-video",
    response_model=VideoResponse,
    summary="Generate a complete AI video from text",
    description=(
        "Full pipeline: text → Qwen3 scenes → Forge images → Edge TTS narration "
        "→ FFmpeg scene videos → concat → SRT subtitles → final subtitled MP4."
    ),
)
async def generate_video(request: VideoRequest):
    """End-to-end video generation endpoint."""

    # ── 1. Build an enriched prompt for Qwen ──────────────────────────────────
    enriched_content = (
        f"Language: {request.language}\n"
        f"Tone: {request.tone}\n"
        f"Target audience: {request.audience}\n\n"
        f"{request.text}"
    )

    # ── 2. Qwen3 → structured scene JSON ──────────────────────────────────────
    try:
        scene_plan = generate_video_scenes(enriched_content)
    except QwenServiceError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Qwen3 (Ollama) is unavailable: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Qwen3 returned invalid scene data: {exc}",
        ) from exc

    scenes = scene_plan.get("scenes", [])
    if not scenes:
        raise HTTPException(status_code=502, detail="Qwen3 produced zero scenes.")

    # ── 3. Forge → scene images (sequential) ──────────────────────────────────
    try:
        image_paths = generate_all_scene_images(
            scenes=scenes,
            width=request.width,
            height=request.height,
            steps=request.steps,
        )
    except ImageGenerationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Forge / Stable Diffusion is unavailable: {exc}",
        ) from exc

    # ── 4. Edge TTS → narration MP3s (concurrent) ─────────────────────────────
    audio_paths = await generate_all_scene_audio(
        scenes=scenes,
        voice=request.voice,
    )

    # ── 5. FFmpeg → per-scene MP4s ────────────────────────────────────────────
    try:
        scene_video_paths = render_all_scene_videos(
            image_paths=image_paths,
            audio_paths=audio_paths,
        )
    except (RuntimeError, FileNotFoundError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"FFmpeg scene render failed: {exc}",
        ) from exc

    # ── 6. SRT subtitle file ──────────────────────────────────────────────────
    srt_path = generate_srt(scenes=scenes, audio_paths=audio_paths)

    # ── 7. Concatenate scene MP4s → final_video.mp4 ───────────────────────────
    video_uid = uuid.uuid4().hex[:10]
    raw_video_path = str(VIDEO_DIR / f"video_{video_uid}_raw.mp4")

    try:
        concatenate_scene_videos(
            scene_video_paths=scene_video_paths,
            output_path=raw_video_path,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"FFmpeg concat failed: {exc}",
        ) from exc

    # ── 8. Burn subtitles → final_video_subtitled.mp4 ────────────────────────
    final_video_path = str(VIDEO_DIR / f"video_{video_uid}.mp4")

    try:
        burn_subtitles(
            video_path=raw_video_path,
            srt_path=srt_path,
            output_path=final_video_path,
        )
    except (RuntimeError, FileNotFoundError) as exc:
        # Subtitle burn failed — return the raw video instead of erroring out
        final_video_path = raw_video_path

    # Clean up raw (un-subtitled) intermediate video if different from final
    raw = Path(raw_video_path)
    if raw.exists() and raw_video_path != final_video_path:
        raw.unlink(missing_ok=True)

    # ── 9. Compute total duration + build scene summary ───────────────────────
    total_duration = round(
        sum(get_scene_duration(a) for a in audio_paths), 2
    )

    scene_details = [
        SceneSummary(
            scene_number=scene.get("scene_number", i + 1),
            duration=round(get_scene_duration(audio_paths[i]), 2),
            narration=scene.get("narration", ""),
            visual_prompt=scene.get("visual_prompt", ""),
            on_screen_text=scene.get("on_screen_text", ""),
            image_file=Path(image_paths[i]).name,
            audio_file=Path(audio_paths[i]).name,
        )
        for i, scene in enumerate(scenes)
    ]

    return VideoResponse(
        status="success",
        message="Video generated successfully",
        video_file=final_video_path,
        subtitle_file=srt_path,
        scenes=len(scenes),
        duration=total_duration,
        scene_details=scene_details,
    )


# ── GET /video/{filename} ──────────────────────────────────────────────────────

@router.get(
    "/{filename}",
    response_class=FileResponse,
    summary="Stream or download a generated video",
    description="Retrieve a generated MP4 by filename for playback or download.",
)
def get_video(filename: str):
    """Serve a generated MP4 file by filename."""
    # Security: only allow .mp4 files within VIDEO_DIR
    candidate = (VIDEO_DIR / filename).resolve()
    storage_root = VIDEO_DIR.resolve()

    if candidate.parent != storage_root or candidate.suffix.lower() != ".mp4":
        raise HTTPException(status_code=400, detail="Invalid video filename.")

    if not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"Video '{filename}' not found.")

    return FileResponse(
        path=str(candidate),
        media_type="video/mp4",
        filename=candidate.name,
    )
