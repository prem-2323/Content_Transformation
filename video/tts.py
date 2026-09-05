import os
import edge_tts

RECOMMENDED_VOICES = {
    "en-US-AriaNeural": "English (US) - Female (Aria)",
    "en-US-GuyNeural": "English (US) - Male (Guy)",
    "en-GB-SoniaNeural": "English (UK) - Female (Sonia)",
    "en-IN-NeerjaNeural": "English (India) - Female (Neerja)",
    "en-IN-PrabhatNeural": "English (India) - Male (Prabhat)",
}

DEFAULT_VOICE = "en-US-AriaNeural"


async def generate_narration(
    text: str,
    output_file: str,
    voice: str = DEFAULT_VOICE,
) -> str:
    """Convert narration text to MP3 using Edge TTS.

    Args:
        text: The narration text to synthesize.
        output_file: Absolute path for the output .mp3 file.
        voice: Edge TTS voice name (default: en-US-AriaNeural).

    Returns:
        The output_file path on success.
    """
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
    )

    await communicate.save(output_file)

    return output_file


async def generate_scene_narrations(
    scenes: list,
    output_dir: str,
    voice: str = DEFAULT_VOICE,
    prefix: str = "scene",
) -> list[str]:
    """Generate one MP3 per scene and return list of output file paths.

    Args:
        scenes: List of scene dicts, each containing a 'narration' key.
        output_dir: Directory to save MP3 files into.
        voice: Edge TTS voice name.
        prefix: Filename prefix (e.g. "scene" → scene_01.mp3).

    Returns:
        Ordered list of MP3 file paths matching the input scenes.
    """
    os.makedirs(output_dir, exist_ok=True)
    audio_files = []

    for i, scene in enumerate(scenes, start=1):
        narration_text = scene.get("narration", "").strip()
        if not narration_text:
            narration_text = f"Scene {i}."

        output_file = os.path.join(output_dir, f"{prefix}_{i:02d}.mp3")
        await generate_narration(narration_text, output_file, voice)
        audio_files.append(output_file)

    return audio_files
