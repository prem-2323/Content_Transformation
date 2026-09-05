import asyncio
import json
import logging
from typing import Callable, List, Dict, Any, Optional

logger = logging.getLogger(__name__)

from PIL import Image

from text.qwen_service import generate_with_qwen, QwenServiceError
from visual.gemma_model import GemmaModel
from text.routes import OUTPUT_INSTRUCTIONS, parse_output_content

gemma_model = GemmaModel()

# ---------------------------------------------------------------------------
# Concurrency guard — at most 2 Gemma requests run simultaneously so we don't
# overload the RTX 3050 4 GB VRAM with too many parallel vision model calls.
# ---------------------------------------------------------------------------
MAX_CONCURRENT_IMAGES = 2
_gemma_semaphore = asyncio.Semaphore(MAX_CONCURRENT_IMAGES)

# Type alias for the optional progress hook
ProgressCallback = Optional[Callable[[int, str], None]]


def _noop(progress: int, step: str) -> None:  # noqa: ARG001
    """Default no-op callback used when no progress hook is provided."""


async def _generate_with_qwen_async(prompt: str) -> str:
    """Run the synchronous Qwen client without blocking FastAPI's event loop."""
    return await asyncio.to_thread(generate_with_qwen, prompt)


async def _analyze_image_with_limit(idx: int, img: Image.Image) -> Dict[str, Any]:
    """
    Semaphore-wrapped Gemma call for a single image.

    The semaphore (MAX_CONCURRENT_IMAGES = 2) means asyncio.gather() will
    schedule ALL images at once, but Gemma only processes 2 at a time:

        Image 1 ──→ Gemma ──┐  (slot 1)
        Image 2 ──→ Gemma ──┤  (slot 2)
        Image 3 ──  WAITING ┘
        Image 4 ──  WAITING

    When Image 1 finishes, Image 3 acquires the semaphore and starts.
    """
    async with _gemma_semaphore:
        logger.info("[Gemma] Starting  image analysis: %d", idx)
        try:
            analysis = await gemma_model.analyze_image(
                image=img,
                prompt=f"Analyze page image {idx} for text, objects, and summary details.",
                task="summary"
            )
            logger.info("[Gemma] Completed image analysis: %d", idx)
            return {"image_index": idx, "analysis": analysis}
        except Exception as err:
            logger.warning("[Gemma] Failed    image analysis: %d — %s", idx, err)
            return {"image_index": idx, "error": str(err)}


async def process_multimodal_content(
    text: str,
    images: List[Image.Image],
    output_types: List[str],
    audience: str,
    tone: str,
    language: str,
    detail_level: str,
    objective: str,
    progress_callback: ProgressCallback = None,
) -> Dict[str, Any]:
    """Process text with Qwen3 4B, embedded images with Gemma 3 4B (parallel,
    cached), and combine into final transformed deliverables via a single Qwen
    synthesis call covering all requested output types at once.

    Args:
        progress_callback: Optional ``(percent: int, step: str) -> None``
            callable invoked at each pipeline stage.  When *None* (the default)
            all progress notifications are silently dropped so existing callers
            continue to work without any changes.
    """
    cb = progress_callback or _noop

    # -------------------------------------------------------------------------
    # Step 1 — Parallel Gemma analysis
    # All images are dispatched concurrently, throttled by _gemma_semaphore so
    # at most MAX_CONCURRENT_IMAGES Ollama requests are in-flight at any time.
    # Progress ticks from 10 → 60 proportionally as each image finishes.
    # -------------------------------------------------------------------------
    cb(10, "analyzing_images")

    n_images = len(images)
    gemma_results: List[Dict[str, Any]] = []

    if n_images == 0:
        cb(60, "analyzing_images")
    else:
        # Build one coroutine per image — all submitted at once to asyncio.gather.
        # The semaphore inside _analyze_image_with_limit ensures at most
        # MAX_CONCURRENT_IMAGES (2) are actually hitting Gemma simultaneously.
        tasks = [
            _analyze_image_with_limit(idx, img)
            for idx, img in enumerate(images, 1)
        ]
        gemma_results = list(await asyncio.gather(*tasks))
        cb(60, "analyzing_images")

    # -------------------------------------------------------------------------
    # Step 2 — Text analysis via Qwen3 4B
    # -------------------------------------------------------------------------
    cb(60, "analyzing_text")

    qwen_initial_prompt = f"""
Analyze the following document text and extract key themes, points, and structural details:

DOCUMENT TEXT:
{text}
"""
    qwen_text_summary = await _generate_with_qwen_async(qwen_initial_prompt)

    # -------------------------------------------------------------------------
    # Step 3 — Format the shared multimodal context string
    # -------------------------------------------------------------------------
    cb(70, "building_context")

    image_context_str = ""
    if gemma_results:
        for item in gemma_results:
            idx = item["image_index"]
            if "analysis" in item:
                res = item["analysis"]
                image_context_str += f"""
--- Image #{idx} Visual Analysis (Gemma 3 4B) ---
Description: {res.get('description', '')}
Detected Objects: {', '.join(res.get('objects', []))}
Visible Text / OCR: {', '.join(res.get('visible_text', []))}
Key Details: {', '.join(res.get('important_details', []))}
"""
            else:
                image_context_str += f"\n--- Image #{idx}: Analysis Error ({item.get('error', '')}) ---\n"
    else:
        image_context_str = "No embedded images detected in document."

    # -------------------------------------------------------------------------
    # Step 4 — Single combined Qwen synthesis call for ALL output types
    # -------------------------------------------------------------------------
    cb(75, "generating_output")

    output_instructions_block = "\n\n".join(
        f"=== OUTPUT TYPE: {ot.upper()} ===\n{OUTPUT_INSTRUCTIONS.get(ot.lower(), OUTPUT_INSTRUCTIONS['summary'])}"
        for ot in output_types
    )

    combined_synthesis_prompt = f"""
You are an advanced multimodal content transformation AI.

Synthesize both textual document analysis and visual image analysis to generate
unified, seamless outputs for EVERY requested output type below.

=== EXTRACTED TEXT ANALYSIS (Qwen3 4B) ===
{qwen_text_summary}

=== EXTRACTED VISUAL ANALYSIS (Gemma 3 4B) ===
{image_context_str}

=== USER CONSTRAINTS ===
AUDIENCE: {audience}
TONE: {tone}
LANGUAGE: {language}
DETAIL LEVEL: {detail_level}
OBJECTIVE: {objective}

=== OUTPUT TYPE INSTRUCTIONS ===
{output_instructions_block}

CRITICAL OUTPUT CONSTRAINTS:
- Return ONLY a single valid JSON object.
- The top-level keys MUST be exactly: {json.dumps(output_types)}
- Each key's value must be the structured content for that output type.
- Do not include reasoning, chain of thought, analysis, commentary, or markdown fences.
- Combine insights from both the document text and visual image analysis for every output.
"""

    raw_combined = await _generate_with_qwen_async(combined_synthesis_prompt)

    # -------------------------------------------------------------------------
    # Step 5 — Parse the combined response
    # -------------------------------------------------------------------------
    cb(95, "parsing_results")

    outputs_dict: Dict[str, Any] = {}

    raw_stripped = raw_combined.strip()
    if raw_stripped.startswith("```"):
        raw_stripped = raw_stripped.removeprefix("```").removeprefix("json").removesuffix("```").strip()

    try:
        combined_json = json.loads(raw_stripped)
        if isinstance(combined_json, dict) and all(ot in combined_json for ot in output_types):
            # Happy path — all keys present
            for ot in output_types:
                outputs_dict[ot] = parse_output_content(
                    json.dumps(combined_json[ot]) if not isinstance(combined_json[ot], str) else combined_json[ot],
                    ot,
                    source_text=qwen_text_summary,
                )
        else:
            # Partial or mismatched keys — populate what we can
            for ot in output_types:
                if ot in combined_json:
                    outputs_dict[ot] = parse_output_content(
                        json.dumps(combined_json[ot]) if not isinstance(combined_json[ot], str) else combined_json[ot],
                        ot,
                        source_text=qwen_text_summary,
                    )
            # For missing output types, fall back to individual Qwen calls
            missing = [ot for ot in output_types if ot not in outputs_dict]
            for ot in missing:
                output_instruction = OUTPUT_INSTRUCTIONS.get(ot.lower(), OUTPUT_INSTRUCTIONS["summary"])
                fallback_prompt = f"""
You are an advanced multimodal content transformation AI.

Synthesize the context below into the requested output type.

=== EXTRACTED TEXT ANALYSIS (Qwen3 4B) ===
{qwen_text_summary}

=== EXTRACTED VISUAL ANALYSIS (Gemma 3 4B) ===
{image_context_str}

=== USER CONSTRAINTS ===
OUTPUT TYPE: {ot}
AUDIENCE: {audience}
TONE: {tone}
LANGUAGE: {language}
DETAIL LEVEL: {detail_level}
OBJECTIVE: {objective}

=== TRANSFORMATION INSTRUCTIONS ===
{output_instruction}

CRITICAL OUTPUT CONSTRAINTS:
- Return ONLY valid JSON matching the requested structure.
- Do not include reasoning or chain of thought.
- Do not include markdown code fences (```json).
"""
                raw_fallback = await _generate_with_qwen_async(fallback_prompt)
                outputs_dict[ot] = parse_output_content(raw_fallback, ot, source_text=qwen_text_summary)

    except (json.JSONDecodeError, TypeError):
        # Qwen returned something unparseable as a combined envelope — treat the
        # whole response as the first output type and fall back for the rest.
        first_type = output_types[0]
        outputs_dict[first_type] = parse_output_content(raw_combined, first_type, source_text=qwen_text_summary)

        for ot in output_types[1:]:
            output_instruction = OUTPUT_INSTRUCTIONS.get(ot.lower(), OUTPUT_INSTRUCTIONS["summary"])
            fallback_prompt = f"""
You are an advanced multimodal content transformation AI.

Synthesize the context below into the requested output type.

=== EXTRACTED TEXT ANALYSIS (Qwen3 4B) ===
{qwen_text_summary}

=== EXTRACTED VISUAL ANALYSIS (Gemma 3 4B) ===
{image_context_str}

=== USER CONSTRAINTS ===
OUTPUT TYPE: {ot}
AUDIENCE: {audience}
TONE: {tone}
LANGUAGE: {language}
DETAIL LEVEL: {detail_level}
OBJECTIVE: {objective}

=== TRANSFORMATION INSTRUCTIONS ===
{output_instruction}

CRITICAL OUTPUT CONSTRAINTS:
- Return ONLY valid JSON matching the requested structure.
- Do not include reasoning or chain of thought.
- Do not include markdown code fences (```json).
"""
            raw_fallback = await _generate_with_qwen_async(fallback_prompt)
            outputs_dict[ot] = parse_output_content(raw_fallback, ot, source_text=qwen_text_summary)

    first_type = output_types[0] if output_types else "summary"

    return {
        "text_analysis_qwen": qwen_text_summary,
        "image_analysis_gemma": gemma_results,
        "outputs": outputs_dict,
        "final_combined_output": outputs_dict.get(first_type)
    }
