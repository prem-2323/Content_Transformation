import sys
from typing import List, Dict, Any
from PIL import Image

from text.qwen_service import generate_with_qwen, QwenServiceError
from visual.gemma_model import GemmaModel
from text.routes import OUTPUT_INSTRUCTIONS

gemma_model = GemmaModel()


async def process_multimodal_content(
    text: str,
    images: List[Image.Image],
    output_type: str,
    audience: str,
    tone: str,
    language: str,
    detail_level: str,
    objective: str
) -> Dict[str, Any]:
    """Process text with Qwen3 4B, embedded images with Gemma 3 4B, and combine into final transformed deliverable."""
    
    # 1. Image Analysis via Gemma 3 4B for each extracted image
    gemma_results = []
    for idx, img in enumerate(images, 1):
        try:
            analysis = await gemma_model.analyze_image(
                image=img,
                prompt=f"Analyze page image {idx} for text, objects, and summary details.",
                task="summary"
            )
            gemma_results.append({
                "image_index": idx,
                "analysis": analysis
            })
        except Exception as err:
            gemma_results.append({
                "image_index": idx,
                "error": str(err)
            })

    # 2. Text Analysis via Qwen3 4B
    qwen_initial_prompt = f"""
Analyze the following document text and extract key themes, points, and structural details:

DOCUMENT TEXT:
{text}
"""
    qwen_text_summary = generate_with_qwen(qwen_initial_prompt)

    # 3. Format Combined Context
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

    output_instruction = OUTPUT_INSTRUCTIONS.get(
        output_type.lower(),
        OUTPUT_INSTRUCTIONS["summary"]
    )

    synthesis_prompt = f"""
You are an advanced multimodal content transformation AI.

Synthesize both textual document analysis and visual image analysis to generate a unified, seamless output.

=== EXTRACTED TEXT ANALYSIS (Qwen3 4B) ===
{qwen_text_summary}

=== EXTRACTED VISUAL ANALYSIS (Gemma 3 4B) ===
{image_context_str}

=== USER CONSTRAINTS ===
OUTPUT TYPE: {output_type}
AUDIENCE: {audience}
TONE: {tone}
LANGUAGE: {language}
DETAIL LEVEL: {detail_level}
OBJECTIVE: {objective}

=== TRANSFORMATION INSTRUCTIONS ===
{output_instruction}

Important:
- Combine insights from both the document text and the visual images.
- Follow the requested tone, language, and target audience.
- Produce a clean, comprehensive, professional result. Return ONLY the transformed content.
"""

    final_combined_output = generate_with_qwen(synthesis_prompt)

    return {
        "text_analysis_qwen": qwen_text_summary,
        "image_analysis_gemma": gemma_results,
        "final_combined_output": final_combined_output
    }
