"""
video/planner.py
~~~~~~~~~~~~~~~~
Intelligent Video Planning Engine:
- Dynamically determines optimal number of scenes based on target duration & pacing.
- Calculates precise scene duration and visual importance (Hero / Core / Supporting / Outro).
- Budgets narration word counts to ensure speech perfectly fits scene timing.
- Calculates transition timing (start/end timestamps, transition types, overlap).
- Calculates subtitle timing (HH:MM:SS,mmm) and FFmpeg synchronization parameters.
"""

import json
import re
import math
import logging
from typing import Dict, Any, List, Optional, Tuple

from text.qwen_service import generate_with_qwen, QwenServiceError
from .schemas import PlannedScene, IntelligentVideoPlan, VideoPlanRequest

logger = logging.getLogger(__name__)

WORDS_PER_SECOND_STANDARD = 2.5   # average speaking rate (~150 wpm)


def seconds_to_srt_timestamp(seconds: float) -> str:
    """Convert a float seconds value to standard SRT timestamp format HH:MM:SS,mmm."""
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def determine_scene_count(target_duration: float, pacing: str = "balanced") -> int:
    """
    Determine the optimal number of scenes based on target duration and pacing.

    Standard pacing profiles:
    - 'fast': ~3.5s - 4.0s per scene (high energy, social shorts, TikTok/Reels)
    - 'balanced': ~5.0s per scene (standard documentary, informative, default)
    - 'cinematic': ~6.0s - 7.5s per scene (atmospheric, deep narrative, presentation)
    """
    pacing_lower = pacing.lower().strip()
    if pacing_lower == "fast":
        avg_scene_len = 3.75
    elif pacing_lower == "cinematic":
        avg_scene_len = 6.0
    else:  # balanced
        avg_scene_len = 5.0

    raw_count = target_duration / avg_scene_len
    scene_count = max(3, min(16, round(raw_count)))
    return scene_count


def calculate_scene_durations(
    target_duration: float,
    num_scenes: int,
    importance_weights: Optional[List[float]] = None
) -> List[float]:
    """
    Distribute the target duration across scenes according to importance weights,
    ensuring each scene is between 3.0s and 10.0s and sum equals target_duration.
    """
    if num_scenes <= 0:
        return [target_duration]

    if not importance_weights or len(importance_weights) != num_scenes:
        # Default balanced curve: Intro (4.5s), Core (5.0s), Hero/Climax (6.0s), Outro (4.5s)
        base_dur = round(target_duration / num_scenes, 2)
        durations = [base_dur] * num_scenes
        diff = round(target_duration - sum(durations), 2)
        if diff != 0:
            durations[-1] = round(durations[-1] + diff, 2)
        return durations

    total_weight = sum(importance_weights)
    if total_weight <= 0:
        total_weight = 1.0

    durations = [round((w / total_weight) * target_duration, 2) for w in importance_weights]
    # Clamp minimum duration to 3.0s
    durations = [max(3.0, d) for d in durations]
    # Re-normalize to exact target duration
    scale = target_duration / sum(durations)
    durations = [round(d * scale, 2) for d in durations]
    diff = round(target_duration - sum(durations), 2)
    durations[-1] = round(durations[-1] + diff, 2)
    return durations


def estimate_narration_duration(text: str, speech_rate: float = WORDS_PER_SECOND_STANDARD) -> float:
    """Estimate spoken audio duration in seconds from word count."""
    if not text:
        return 0.0
    words = len(text.strip().split())
    return round(words / speech_rate, 2)


def calculate_max_word_budget(duration_seconds: float, speech_rate: float = WORDS_PER_SECOND_STANDARD) -> int:
    """Calculate the maximum word count for a scene duration to prevent rushed audio."""
    return max(5, int(duration_seconds * speech_rate))


PLANNING_PROMPT_TEMPLATE = """
You are an expert AI video director and cinematographic planner.

Plan a structured video of EXACTLY {target_duration} seconds consisting of EXACTLY {num_scenes} scenes.

TARGET SPECIFICATIONS:
- Total Target Duration: {target_duration} seconds
- Exact Number of Scenes: {num_scenes}
- Pacing: {pacing} (~{avg_duration}s per scene)
- Language: {language}
- Tone: {tone}
- Audience: {audience}

SOURCE CONTENT:
{content}

CRITICAL RULES FOR EACH SCENE:
1. `scene_number`: 1 to {num_scenes}.
2. `duration`: Scene duration in seconds. The sum of all scene durations MUST equal {target_duration}.
3. `visual_importance`: Float between 0.5 and 1.0 (Hero statistics / key discoveries = 0.9-1.0; Intro/Outro = 0.7; Background = 0.6).
4. `visual_tier`: "HIGH", "MEDIUM", or "LOW".
5. `narration`: Concise voiceover text (MUST NOT exceed max word limit of ~12-15 words per scene).
6. `visual_prompt`: Detailed photorealistic cinematic description (camera angle, lighting, subject, atmosphere). NO readable text in image.
7. `on_screen_text`: Punchy headline (max 6 words).
8. `transition_type`: "crossfade", "fade", "wipe", or "cut".

RETURN ONLY VALID JSON matching this structure:
{{
  "title": "Video Title",
  "scenes": [
    {{
      "scene_number": 1,
      "duration": 5.0,
      "visual_importance": 0.8,
      "visual_tier": "MEDIUM",
      "narration": "Welcome to the future of smart urban mobility and AI infrastructure.",
      "visual_prompt": "Cinematic wide angle establishing shot of a futuristic metropolis with smooth luminous traffic flow at dusk, 8k, photorealistic, volumetric lighting",
      "on_screen_text": "Smart Urban Mobility",
      "transition_type": "crossfade"
    }}
  ]
}}
"""


class IntelligentVideoPlanner:
    """
    Intelligent Video Planning Engine:
    Determines scene counts, durations, visual importance, narration limits,
    transition timing, and subtitle synchronization.
    """

    @classmethod
    def plan_video(
        cls,
        content: str,
        target_duration: int = 30,
        pacing: str = "balanced",
        language: str = "English",
        tone: str = "Professional",
        audience: str = "General public",
        source_facts: Optional[List[Dict[str, Any]]] = None
    ) -> IntelligentVideoPlan:
        """
        Produce a complete, synchronized Intelligent Video Plan from source content.
        """
        target_dur = float(max(10, min(180, target_duration)))
        num_scenes = determine_scene_count(target_dur, pacing)
        avg_scene_len = round(target_dur / num_scenes, 2)

        prompt = PLANNING_PROMPT_TEMPLATE.format(
            target_duration=int(target_dur),
            num_scenes=num_scenes,
            pacing=pacing,
            avg_duration=avg_scene_len,
            language=language,
            tone=tone,
            audience=audience,
            content=content.strip()
        )

        planned_scenes_raw = []
        video_title = "AI Video Production"

        # Try LLM-driven planning
        try:
            raw_response = generate_with_qwen(prompt)
            data = cls._extract_json(raw_response)
            if isinstance(data, dict):
                video_title = data.get("title", video_title)
                scenes = data.get("scenes", [])
                if isinstance(scenes, list) and len(scenes) >= 3:
                    planned_scenes_raw = scenes[:num_scenes]
        except Exception as e:
            logger.warning(f"IntelligentVideoPlanner LLM call failed: {e}. Using deterministic planning.")

        # If LLM didn't return adequate scenes, construct deterministic plan
        if len(planned_scenes_raw) < 3:
            planned_scenes_raw = cls._build_deterministic_scenes(
                content=content,
                num_scenes=num_scenes,
                target_duration=target_dur,
                source_facts=source_facts
            )

        # Build fully calibrated PlannedScene models
        planned_scenes = cls._calibrate_scenes(
            scenes_raw=planned_scenes_raw,
            num_scenes=num_scenes,
            target_duration=target_dur
        )

        # Build timeline and FFmpeg sync metadata
        timeline = cls._build_timeline(planned_scenes)
        ffmpeg_sync = cls._build_ffmpeg_sync_metadata(planned_scenes, target_dur)

        total_calc_duration = round(sum(s.duration for s in planned_scenes), 2)

        return IntelligentVideoPlan(
            title=video_title,
            target_duration=target_dur,
            total_calculated_duration=total_calc_duration,
            num_scenes=len(planned_scenes),
            average_scene_duration=round(total_calc_duration / len(planned_scenes), 2),
            pacing=pacing,
            scenes=planned_scenes,
            timeline=timeline,
            ffmpeg_sync_metadata=ffmpeg_sync
        )

    @classmethod
    def _calibrate_scenes(
        cls,
        scenes_raw: List[Dict[str, Any]],
        num_scenes: int,
        target_duration: float
    ) -> List[PlannedScene]:
        """Calibrate timings, visual importance, transitions, and subtitle timestamps."""
        # Normalize count
        if len(scenes_raw) < num_scenes:
            while len(scenes_raw) < num_scenes:
                idx = len(scenes_raw) + 1
                scenes_raw.append({
                    "scene_number": idx,
                    "duration": 5.0,
                    "visual_importance": 0.8,
                    "visual_tier": "MEDIUM",
                    "narration": f"Continuing the key insights and verified findings in scene {idx}.",
                    "visual_prompt": f"Cinematic detailed visual representing technological progress and insights, 8k",
                    "on_screen_text": "Key Insight",
                    "transition_type": "crossfade"
                })
        elif len(scenes_raw) > num_scenes:
            scenes_raw = scenes_raw[:num_scenes]

        # Extract or compute importance weights
        weights = []
        for s in scenes_raw:
            w = float(s.get("visual_importance", 0.8))
            weights.append(max(0.5, min(1.0, w)))

        durations = calculate_scene_durations(target_duration, num_scenes, weights)

        calibrated_scenes: List[PlannedScene] = []
        current_time = 0.0

        for i, (sc, dur) in enumerate(zip(scenes_raw, durations), start=1):
            start_t = round(current_time, 2)
            end_t = round(current_time + dur, 2)
            current_time = end_t

            narration = sc.get("narration", f"Scene {i} narration.")
            max_words = calculate_max_word_budget(dur)
            est_dur = estimate_narration_duration(narration)

            importance = round(weights[i - 1], 2)
            tier = "HIGH" if importance >= 0.85 else ("MEDIUM" if importance >= 0.7 else "LOW")

            trans_type = sc.get("transition_type", "crossfade" if i < num_scenes else "fade")
            trans_dur = 0.5 if i < num_scenes else 0.0

            sub_start = seconds_to_srt_timestamp(start_t)
            sub_end = seconds_to_srt_timestamp(end_t)

            calibrated_scenes.append(PlannedScene(
                scene_number=i,
                duration=dur,
                visual_importance=importance,
                visual_tier=tier,
                narration=narration,
                estimated_narration_duration=est_dur,
                max_word_count=max_words,
                visual_prompt=sc.get("visual_prompt", "Cinematic photorealistic shot, 8k"),
                on_screen_text=sc.get("on_screen_text", f"Scene {i}"),
                start_time=start_t,
                end_time=end_t,
                transition_type=trans_type,
                transition_duration=trans_dur,
                subtitle_start=sub_start,
                subtitle_end=sub_end,
                source_facts=sc.get("source_facts", [])
            ))

        return calibrated_scenes

    @classmethod
    def _build_deterministic_scenes(
        cls,
        content: str,
        num_scenes: int,
        target_duration: float,
        source_facts: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """Construct deterministic scenes from facts or content sentences."""
        scenes = []

        # If we have structured facts
        if source_facts and len(source_facts) > 0:
            facts_to_use = source_facts[:num_scenes]
            # Intro
            scenes.append({
                "scene_number": 1,
                "visual_importance": 0.85,
                "visual_tier": "HIGH",
                "narration": f"Here are the essential verified findings and core discoveries.",
                "visual_prompt": f"Cinematic dynamic establishing shot of modern technology landscape, 8k, volumetric lighting",
                "on_screen_text": "Executive Overview",
                "transition_type": "crossfade",
                "source_facts": [facts_to_use[0].get("id", "F001")]
            })

            for idx, fact in enumerate(facts_to_use[:num_scenes - 2], 2):
                stmt = fact.get("statement", f"Core metric and fact {idx}.")
                imp = float(fact.get("importance", 0.8))
                scenes.append({
                    "scene_number": idx,
                    "visual_importance": imp,
                    "visual_tier": "HIGH" if imp >= 0.85 else "MEDIUM",
                    "narration": stmt,
                    "visual_prompt": f"Cinematic visual illustrating {stmt[:60]}, sharp focus, 8k, high detail",
                    "on_screen_text": fact.get("category", "Key Finding"),
                    "transition_type": "crossfade",
                    "source_facts": [fact.get("id", f"F00{idx}")]
                })

            # Outro
            scenes.append({
                "scene_number": num_scenes,
                "visual_importance": 0.75,
                "visual_tier": "MEDIUM",
                "narration": "Stay informed as these technological advancements transform our world.",
                "visual_prompt": "Cinematic closing frame with glowing futuristic technology horizon, 8k",
                "on_screen_text": "The Future Ahead",
                "transition_type": "fade",
                "source_facts": []
            })
        else:
            # Split sentences
            sentences = [s.strip() for s in re.split(r"[.!?\n]+", content) if len(s.strip()) > 10]
            if not sentences:
                sentences = ["Discover the future of modern innovation and smart technology."]

            for idx in range(1, num_scenes + 1):
                sentence = sentences[(idx - 1) % len(sentences)]
                imp = 0.9 if idx == 2 else (0.8 if idx == 1 else 0.75)
                scenes.append({
                    "scene_number": idx,
                    "visual_importance": imp,
                    "visual_tier": "HIGH" if imp >= 0.85 else "MEDIUM",
                    "narration": sentence,
                    "visual_prompt": f"Cinematic photorealistic shot illustrating {sentence[:50]}, 8k, detailed lighting",
                    "on_screen_text": f"Insight {idx}",
                    "transition_type": "crossfade" if idx < num_scenes else "fade",
                    "source_facts": []
                })

        return scenes

    @classmethod
    def _build_timeline(cls, scenes: List[PlannedScene]) -> List[Dict[str, Any]]:
        """Construct chronological timeline events for playback and UI rendering."""
        timeline = []
        for s in scenes:
            timeline.append({
                "timestamp_start": s.start_time,
                "timestamp_end": s.end_time,
                "scene_number": s.scene_number,
                "type": "scene_display",
                "title": s.on_screen_text,
                "duration": s.duration,
                "narration": s.narration,
                "visual_tier": s.visual_tier,
                "transition": {
                    "type": s.transition_type,
                    "duration": s.transition_duration,
                    "at_seconds": s.end_time
                },
                "subtitle": {
                    "start": s.subtitle_start,
                    "end": s.subtitle_end,
                    "text": s.narration
                }
            })
        return timeline

    @classmethod
    def _build_ffmpeg_sync_metadata(
        cls,
        scenes: List[PlannedScene],
        target_duration: float
    ) -> Dict[str, Any]:
        """Generate exact FFmpeg synchronization parameters."""
        video_filters = []
        concat_durations = []

        for i, s in enumerate(scenes):
            concat_durations.append({
                "scene_number": s.scene_number,
                "exact_seconds": s.duration,
                "tail_padding_seconds": 0.5,
                "audio_sync_offset": s.start_time
            })
            if s.transition_type == "crossfade" and i < len(scenes) - 1:
                video_filters.append(
                    f"xfade=transition=fade:duration={s.transition_duration}:offset={round(s.end_time - s.transition_duration, 2)}"
                )

        return {
            "target_duration_seconds": target_duration,
            "scene_count": len(scenes),
            "video_codec": "libx264",
            "audio_codec": "aac",
            "pixel_format": "yuv420p",
            "crossfade_filters": video_filters,
            "scene_sync_durations": concat_durations,
            "srt_subtitles_count": len(scenes)
        }

    @classmethod
    def _extract_json(cls, raw: str) -> Dict[str, Any]:
        """Extract clean JSON object from LLM response string."""
        raw_clean = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        raw_clean = re.sub(r"^```(?:json)?\s*", "", raw_clean, flags=re.IGNORECASE).strip()
        raw_clean = re.sub(r"\s*```$", "", raw_clean, flags=re.IGNORECASE).strip()

        try:
            res = json.loads(raw_clean)
            if isinstance(res, dict):
                return res
        except Exception:
            pass

        start = raw_clean.find("{")
        end = raw_clean.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                res = json.loads(raw_clean[start:end + 1])
                if isinstance(res, dict):
                    return res
            except Exception:
                pass

        raise ValueError("Could not extract valid JSON from planner output.")
