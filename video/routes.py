"""
video/routes.py
~~~~~~~~~~~~~~~
FastAPI router for the full video generation and intelligent video planning pipeline.

POST /video/plan
    Content → IntelligentVideoPlanner → scenes count, scene duration, visual importance,
    narration quota, transition timing, subtitle timing, and FFmpeg sync metadata.

POST /video/generate-video
    text → Intelligent Video Planning → Forge images → Edge TTS audio
         → FFmpeg scene videos → concat → SRT → subtitle burn
    Returns: VideoResponse with final MP4 path + intelligent video plan metadata.

GET /video/{filename}
    Stream / download a generated MP4 by filename.
"""

import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

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
from .schemas import SceneSummary, VideoRequest, VideoResponse, VideoPlanRequest, IntelligentVideoPlan
from .service import generate_all_scene_audio, generate_all_scene_images
from .planner import IntelligentVideoPlanner


router = APIRouter(prefix="/video", tags=["Video Generation"])

VIDEO_DIR = Path(os.getenv("VIDEO_STORAGE", "generated_videos"))


# ── POST /video/plan ───────────────────────────────────────────────────────────

@router.post(
    "/plan",
    response_model=IntelligentVideoPlan,
    summary="Intelligent Video Planning Engine",
    description=(
        "Calculates optimal number of scenes, scene durations, visual importance tiers, "
        "narration word quotas, transition timing, and subtitle synchronization from source content."
    ),
)
async def plan_video_endpoint(request: VideoPlanRequest):
    """Calculates intelligent video timeline and synchronization metadata."""
    try:
        plan = IntelligentVideoPlanner.plan_video(
            content=request.text,
            target_duration=request.target_duration,
            pacing=request.pacing,
            language=request.language,
            tone=request.tone,
            audience=request.audience
        )
        return plan
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Intelligent video planning failed: {str(exc)}"
        )


# ── POST /video/generate-video ─────────────────────────────────────────────────

@router.post(
    "/generate-video",
    response_model=VideoResponse,
    summary="Generate a complete AI video from text",
    description=(
        "Full pipeline: Intelligent Video Planning → Forge images → Edge TTS narration "
        "→ FFmpeg scene videos → concat → SRT subtitles → final subtitled MP4."
    ),
)
async def generate_video(request: VideoRequest):
    """End-to-end video generation endpoint with Intelligent Video Planning."""

    # ── 1. Intelligent Video Planning (Scene count, duration, importance, transitions) ──
    try:
        video_plan = IntelligentVideoPlanner.plan_video(
            content=request.text,
            target_duration=request.target_duration,
            pacing=request.pacing,
            language=request.language,
            tone=request.tone,
            audience=request.audience
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Video planning failed: {exc}"
        )

    planned_scenes = video_plan.scenes
    if not planned_scenes:
        raise HTTPException(status_code=502, detail="Video planner produced zero scenes.")

    # Convert to scene dicts for image/audio generators
    scenes = [
        {
            "scene_number": s.scene_number,
            "duration": s.duration,
            "visual_importance": s.visual_importance,
            "visual_tier": s.visual_tier,
            "narration": s.narration,
            "visual_prompt": s.visual_prompt,
            "on_screen_text": s.on_screen_text,
            "transition_type": s.transition_type,
            "transition_duration": s.transition_duration,
            "subtitle_start": s.subtitle_start,
            "subtitle_end": s.subtitle_end
        }
        for s in planned_scenes
    ]

    # ── 2. Forge → scene images (sequential) ──────────────────────────────────
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

    # ── 3. Edge TTS → narration MP3s (concurrent) ─────────────────────────────
    audio_paths = await generate_all_scene_audio(
        scenes=scenes,
        voice=request.voice,
    )

    # ── 4. FFmpeg → per-scene MP4s ────────────────────────────────────────────
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

    # ── 5. SRT subtitle file with precise timings ─────────────────────────────
    srt_path = generate_srt(scenes=scenes, audio_paths=audio_paths)

    # ── 6. Concatenate scene MP4s → final_video.mp4 ───────────────────────────
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

    # ── 7. Burn subtitles → final_video_subtitled.mp4 ────────────────────────
    final_video_path = str(VIDEO_DIR / f"video_{video_uid}.mp4")

    try:
        burn_subtitles(
            video_path=raw_video_path,
            srt_path=srt_path,
            output_path=final_video_path,
        )
    except (RuntimeError, FileNotFoundError) as exc:
        # Subtitle burn fallback
        final_video_path = raw_video_path

    # Clean up raw (un-subtitled) intermediate video if different from final
    raw = Path(raw_video_path)
    if raw.exists() and raw_video_path != final_video_path:
        raw.unlink(missing_ok=True)

    # ── 8. Compute total duration + build scene summary ───────────────────────
    total_duration = round(
        sum(get_scene_duration(a) for a in audio_paths), 2
    )

    scene_details = [
        SceneSummary(
            scene_number=scene.get("scene_number", i + 1),
            duration=round(get_scene_duration(audio_paths[i]), 2),
            visual_importance=scene.get("visual_importance", 0.8),
            visual_tier=scene.get("visual_tier", "MEDIUM"),
            narration=scene.get("narration", ""),
            visual_prompt=scene.get("visual_prompt", ""),
            on_screen_text=scene.get("on_screen_text", ""),
            start_time=planned_scenes[i].start_time if i < len(planned_scenes) else 0.0,
            end_time=planned_scenes[i].end_time if i < len(planned_scenes) else 5.0,
            transition_type=scene.get("transition_type", "crossfade"),
            subtitle_start=planned_scenes[i].subtitle_start if i < len(planned_scenes) else None,
            subtitle_end=planned_scenes[i].subtitle_end if i < len(planned_scenes) else None,
            image_file=Path(image_paths[i]).name,
            audio_file=Path(audio_paths[i]).name,
        )
        for i, scene in enumerate(scenes)
    ]

    return VideoResponse(
        status="success",
        message="Video generated successfully with intelligent planning",
        video_file=final_video_path,
        subtitle_file=srt_path,
        scenes=len(scenes),
        duration=total_duration,
        video_plan=video_plan,
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
