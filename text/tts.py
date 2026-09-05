import json
import edge_tts
from typing import Dict, Any, Union

RECOMMENDED_VOICES: Dict[str, str] = {
    "en-US-AriaNeural": "English (US) - Female (Aria)",
    "en-US-GuyNeural": "English (US) - Male (Guy)",
    "en-GB-SoniaNeural": "English (UK) - Female (Sonia)",
    "en-IN-NeerjaNeural": "English (India) - Female (Neerja)",
    "en-IN-PrabhatNeural": "English (India) - Male (Prabhat)"
}


async def generate_audio(
    text: str,
    output_file: str,
    voice: str = "en-US-AriaNeural"
) -> str:
    """Generate MP3 audio file from text using edge-tts."""
    communicate = edge_tts.Communicate(
        text=text,
        voice=voice
    )
    await communicate.save(output_file)
    return output_file


def extract_video_script_narration(video_script_input: Union[Dict[str, Any], str]) -> str:
    """
    Extract readable narration/voiceover text from a video script data structure.
    Works with raw string inputs or structured JSON/dict payloads containing storyboards.
    """
    data = video_script_input
    if isinstance(video_script_input, str):
        try:
            data = json.loads(video_script_input)
        except Exception:
            return video_script_input.strip()

    if isinstance(data, dict):
        # 1. If storyboard list is present, concatenate scene narrations
        if "storyboard" in data and isinstance(data["storyboard"], list):
            narrations = []
            for scene in data["storyboard"]:
                if isinstance(scene, dict):
                    scene_num = scene.get("scene", "")
                    narration = scene.get("narration") or scene.get("subtitle") or scene.get("on_screen_text", "")
                    if narration:
                        prefix = f"Scene {scene_num}: " if scene_num else ""
                        narrations.append(f"{prefix}{narration.strip()}")
            if narrations:
                intro = f"Video Title: {data.get('video_title', 'Video Package')}.\n" if "video_title" in data else ""
                return intro + "\n".join(narrations)

        # 2. Fallbacks for other dictionary keys
        if "narration" in data and isinstance(data["narration"], str):
            return data["narration"].strip()
        if "content" in data and isinstance(data["content"], str):
            return data["content"].strip()

    return str(video_script_input).strip()
