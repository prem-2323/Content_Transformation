import re
import traceback

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from .chat_models import (
    ChatRequest,
    ChatResponse,
    SmartActionRequest,
    SmartActionResponse,
)

from .content_router import detect_intent, ACTION_INTENTS
from .llm_service import LocalLLM


router = APIRouter(
    prefix="/api/ai",
    tags=["AI Chat"]
)


llm = LocalLLM()


BASE_SYSTEM_PROMPT = """
You are ContentForge AI Assistant.

You are the central AI assistant for a
Gen AI Platform for Automated Content Transformation.

You help users with:

- General questions
- Content analysis
- Summarization
- Fact checking
- LinkedIn posts
- Twitter/X posts
- Advisories
- Infographics
- Executive summaries
- Presentations
- Video scripts
- Storyboards
- Content strategy
- Content improvement

You are an intelligent content transformation assistant.

IMPORTANT FACTUAL RULES:

1. Preserve facts from the user's source.
2. Never invent statistics.
3. Never invent names.
4. Never invent dates.
5. Never invent organizations.
6. Never invent quotations.
7. Never change numerical values.
8. If information is missing, say so.
9. Clearly distinguish assumptions from facts.
10. Keep generated outputs consistent with the source.

For normal conversation, respond naturally.

RESPONSE QUALITY RULES:

1. Answer the user's actual request directly and completely.
2. Do not repeat the request or stop after merely defining the topic.
3. Use the source material as the basis for the answer and preserve its meaning.
4. Do not expose internal reasoning, planning, or <think> tags.
5. Return only the final answer without meta commentary or closing filler.

STRICT RESPONSE RULES:

1. Never output internal reasoning, chain-of-thought, thoughts, analysis, planning, or decision process.
2. Never write phrases such as "Let me think", "I need to think", "Hmm", "First, I need to", "The user said", "I should", "Let's analyze", or "I need to remember".
3. Never describe how you decided what to answer.
4. Do not mention previous user messages unless directly relevant.
5. Return only the final answer intended for the user.
6. Start directly with the answer.
7. Keep simple questions short and natural.

CRITICAL OUTPUT RULE:

Return ONLY the final response intended for the user.

NEVER output:

- Internal reasoning
- Chain of thought
- Analysis
- Planning
- Drafting process
- Self-talk
- Thoughts about the user's request
- References to "the user"
- "Let me think"
- "I need to"
- "First, I need to"
- "Hmm"
- "Wait"
- "Let's craft"
- "We are given"
- Statements such as "Let me think", "Hmm", "I need to", "First, I need to", "The user asked", "I should", or "Let me recall"
- Any unfinished reasoning

Do not explain how you arrived at the answer.
The response must begin directly with the final answer.

Do not output the word "svg" unless the user explicitly asks for SVG.
Do not output HTML, SVG, JSX, XML, JSON, or UI markup unless explicitly requested.

You are ContentForge AI Assistant.
OUTPUT ONLY THE FINAL ANSWER.

OUTPUT FORMATTING RULES:

1. Use plain text headings without Markdown heading markers.
2. Use simple bullet points beginning with a hyphen when a list is needed.
3. Never use Markdown emphasis, backticks, raw HTML, SVG, JSX, or XML.
4. Do not use #, ##, ###, **, or * as formatting symbols.
5. Keep responses clean, readable, concise, and useful.

For content transformation requests,
produce structured professional output.
"""

GENERAL_CHAT_SYSTEM_PROMPT = """
You are ContentForge AI Assistant. Answer the user's latest message directly,
accurately, and helpfully. Use plain text, keep simple questions concise, and
do not include internal reasoning, planning, or <think> tags. If the request is
ambiguous, ask one short clarifying question.
"""


def clean_llm_response(text: str) -> str:
    """Remove Qwen reasoning blocks and accidental markup artifacts."""
    text = text.strip()

    if "<think>" in text:
        parts = text.split("</think>", 1)
        if len(parts) == 2:
            text = parts[1]

    if "<|thinking|>" in text:
        parts = text.split("<|end|>", 1)
        if len(parts) == 2:
            text = parts[1]

    cleaned = [line for line in text.splitlines() if line.strip().lower() != "svg"]
    return "\n".join(cleaned).strip()


def build_system_prompt(
    request: ChatRequest,
    intent: str
) -> str:
    """Build a dynamic system prompt based on the detected intent and request settings."""

    prompt = BASE_SYSTEM_PROMPT

    prompt += f"""

CURRENT REQUEST

Intent:
{intent}

Language:
{request.language}

Tone:
{request.tone}

Audience:
{request.audience}

Objective:
{request.objective}

Detail Level:
{request.detail_level}
"""

    if request.context.strip():
        prompt += f"""

RETRIEVED CONTEXT

The following context was retrieved from the user's ContentForge workspace.
Use it when relevant, preserve its facts, and say when it does not answer the request.

{request.context[:12000]}
"""

    if intent == "summarization":

        prompt += """

TASK:

Create an accurate summary.

Include:
- Main idea
- Important facts
- Important numbers
- Important conclusions

Do not add unsupported information.
"""

    elif intent == "linkedin":

        prompt += """

TASK:

Create a professional LinkedIn post.

Structure:

Hook

Context

Key insights

Important facts

Conclusion

Call to action

Keep the original meaning and facts.
"""

    elif intent == "twitter":

        prompt += """

TASK:

Create optimized X/Twitter content.

If the content requires multiple posts,
create a concise thread.

Keep the content factual.
"""

    elif intent in ("presentation", "make_presentation"):

        prompt += """

TASK:

Create presentation content.

For every slide provide:

Slide Number
Title
Key Points
Speaker Notes
Visual Recommendation

Keep information consistent with the source.
"""

    elif intent in ("video", "video_plan"):

        prompt += """

TASK:

Create a complete video package.

Include:

1. Video Title
2. Objective
3. Target Audience
4. Full Script
5. Scene-by-Scene Storyboard
6. Narration
7. On-Screen Text
8. Visual Recommendations
9. Subtitle Content

Preserve all source facts.
"""

    elif intent == "infographic":

        prompt += """

TASK:

Create an infographic specification.

Include:

Title
Main Message
Sections
Key Statistics
Supporting Information
Visual Hierarchy
Icons
Layout Recommendation

Never fabricate statistics.
"""

    elif intent == "advisory":

        prompt += """

TASK:

Create a structured advisory.

Use:

Title
Executive Summary
Situation
Key Findings
Impact
Recommended Actions
Risk Considerations
Conclusion
"""

    elif intent in ("fact_check", "consistency_check"):

        prompt += """

TASK:

Analyze the claims individually.

For each claim provide:

Claim
Assessment
Evidence
Reasoning
Confidence

Do not claim external verification
unless external evidence is actually provided.
"""

    elif intent == "strategy":

        prompt += """

TASK:

Create a practical strategy.

Include:

Objective
Current Situation
Recommended Approach
Implementation Steps
Priorities
Risks
Success Metrics
Next Actions
"""

    elif intent == "clean_content":

        prompt += """

TASK:

Rewrite and expand the user's source into polished, readable content.

Output rules:

1. Return plain text only.
2. Do not use Markdown symbols such as #, *, _, or backticks.
3. Use simple hyphen bullets when a list improves readability.
4. Use short paragraphs and simple plain-text section titles when useful.
5. Preserve all facts from the source and do not invent statistics, names, dates, or quotations.
6. Add helpful explanation and examples only when they are supported by the source or clearly labeled as examples.
7. Do not describe what you changed; provide the finished content directly.
"""

    return prompt


def fast_path_reply(message: str) -> str | None:
    """Answer simple definition requests without waiting for a model round trip."""
    normalized = re.sub(r"[^a-z0-9 ]", " ", message.lower())
    normalized = " ".join(normalized.split())
    asks_for_definition = (
        "what is" in normalized
        or "what does" in normalized
        or "meaning" in normalized
        or "meant by" in normalized
        or normalized.startswith("about ")
    )
    requests_summary = "executive summary" in normalized or "summary" in normalized

    if not asks_for_definition:
        return None

    if re.search(r"\bai\b", normalized) is not None and requests_summary:
        return (
            "Executive Summary\n\n"
            "Artificial intelligence (AI) is technology that enables computers to "
            "perform tasks that normally require human intelligence, such as "
            "understanding language, recognizing patterns, learning from data, "
            "and making predictions or recommendations. AI supports people by "
            "automating repetitive work and helping them make better-informed "
            "decisions."
        )

    if re.search(r"\bgoogle\b", normalized) is not None:
        return (
            "Google is a technology company best known for its search engine, "
            "which helps people find information on the internet. It also "
            "provides products and services such as Gmail, Google Maps, "
            "YouTube, Android, and Google Cloud."
        )

    if re.search(r"\bcomputer\b", normalized) is not None:
        return (
            "A computer is an electronic device that processes data according "
            "to instructions called software. It can perform calculations, "
            "store and retrieve information, communicate, and run applications."
        )

    if re.search(r"\blaptop\b", normalized) is not None:
        return (
            "A laptop is a portable computer with a built-in screen, keyboard, "
            "battery, and touchpad. It can run software, store information, "
            "connect to the internet, and perform many of the same tasks as a "
            "desktop computer."
        )

    return None


@router.post(
    "/chat",
    response_model=ChatResponse
)
async def chat(request: ChatRequest):
    """Main AI chat endpoint — routes through intent detection to Ollama."""

    if not request.messages:

        raise HTTPException(
            status_code=400,
            detail="Messages cannot be empty"
        )

    last_user_message = ""

    for message in reversed(request.messages):

        if message.role == "user":

            last_user_message = message.content
            break

    if not last_user_message.strip():

        raise HTTPException(
            status_code=400,
            detail="User message cannot be empty"
        )

    intent = detect_intent(
        last_user_message
    )

    fast_reply = fast_path_reply(last_user_message)
    if fast_reply:
        return ChatResponse(
            reply=fast_reply,
            intent=intent,
            model=llm.model,
        )

    system_prompt = (
        GENERAL_CHAT_SYSTEM_PROMPT
        if intent == "general"
        else build_system_prompt(request, intent)
    )

    if request.context.strip():
        system_prompt += f"""

Retrieved workspace context:
{request.context[:12000]}

Use this context when it is relevant. Preserve its facts and say when it does not answer the request.
"""

    messages = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in request.messages
    ]

    try:

        reply = await llm.generate(
            messages=messages,
            system_prompt=system_prompt
        )
        reply = clean_llm_response(reply)

        return ChatResponse(
            reply=reply,
            intent=intent,
            model=llm.model
        )

    except Exception as e:

        print(
            f"Local LLM Error: {e}"
        )

        return ChatResponse(
            reply=(
                "I could not complete that answer within 25 seconds. "
                "Please retry with a shorter request or use a concise summary."
            ),
            intent=intent,
            model=llm.model,
        )


# ---------------------------------------------------------------------------
# Smart Action — unified endpoint that detects intent and routes to APIs
# ---------------------------------------------------------------------------


def _extract_source_text(message: str) -> str:
    """Pull the 'subject' from the user message, stripping command prefixes."""
    # Remove common action prefixes to get the raw content
    cleaned = re.sub(
        r"^(generate|create|make|build|produce|write|transform|rewrite|convert|"
        r"summarize|summarise|design|draw|plan|check|analyze|analyse|score|"
        r"evaluate|read|narrate|speak|export)\s+(a\s+|an\s+|me\s+|this\s+)?",
        "",
        message.strip(),
        flags=re.IGNORECASE,
    )
    # Also strip trailing intent hints
    cleaned = re.sub(
        r"\s+(image|video|audio|presentation|ppt|slides|poster|infographic)$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip() or message.strip()


@router.post("/smart-action", response_model=SmartActionResponse)
async def smart_action(request: SmartActionRequest):
    """Unified smart endpoint — detects intent and calls the appropriate platform API.

    This endpoint is used by the AI Assistant to route natural language requests
    to the correct platform service (transform, image, video, audio, etc.)
    and return structured results that the UI renders as rich cards.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    last_user_message = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_message = msg.content
            break
    if not last_user_message.strip():
        raise HTTPException(status_code=400, detail="User message cannot be empty")

    intent = detect_intent(last_user_message)
    source = _extract_source_text(last_user_message)

    # ── General chat — delegate to LLM ──────────────────────────────────
    if intent not in ACTION_INTENTS:
        chat_request = ChatRequest(
            messages=request.messages,
            context=request.context,
            language=request.language,
            tone=request.tone,
            audience=request.audience,
            objective=request.objective,
            detail_level=request.detail_level,
        )
        chat_response = await chat(chat_request)
        return SmartActionResponse(
            action="chat",
            intent=intent,
            text=chat_response.reply,
            model=chat_response.model,
        )

    # ── Image Generation ────────────────────────────────────────────────
    if intent == "generate_image":
        try:
            from image.service import generate_and_save_image
            filename, gen_time, device = generate_and_save_image(
                prompt=source,
                negative_prompt="",
                width=512,
                height=512,
                steps=10,
                mode="fast",
            )
            return SmartActionResponse(
                action="image",
                intent=intent,
                text=f"Here's your generated image for: \"{source}\"",
                data={
                    "filename": filename,
                    "image_url": f"/image/{filename}",
                    "generation_time": gen_time,
                    "device": device,
                    "prompt": source,
                },
                download_url=f"/image/{filename}",
                media_type="image",
                model=f"Stable Diffusion ({device})",
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="image",
                intent=intent,
                text=f"Image generation failed: {e}",
                model="error",
            )

    # ── Video Plan ──────────────────────────────────────────────────────
    if intent == "video_plan":
        try:
            from video.planner import IntelligentVideoPlanner

            plan = IntelligentVideoPlanner.plan_video(
                content=source if len(source) >= 10 else f"Create a video plan about {source}",
                target_duration=30,
                pacing="balanced",
                language=request.language,
                tone=request.tone,
                audience=request.audience,
            )
            plan_data = plan.model_dump() if hasattr(plan, "model_dump") else plan
            scenes = plan_data.get("scenes", []) if isinstance(plan_data, dict) else []
            return SmartActionResponse(
                action="video_plan",
                intent=intent,
                text=f"Video plan created: \"{plan_data.get('title', source)}\" with {len(scenes)} scenes.",
                data=plan_data,
                model="Qwen3 4B (Intelligent Video Planner)",
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="video_plan",
                intent=intent,
                text=f"Video planning failed: {e}",
                model="error",
            )

    # ── Video Generate (full pipeline) ──────────────────────────────────
    if intent == "generate_video":
        try:
            import httpx as _httpx

            async with _httpx.AsyncClient(timeout=600.0) as client:
                resp = await client.post(
                    "http://localhost:8000/video/generate-video",
                    json={
                        "text": source if len(source) >= 10 else f"Create a video about {source}",
                        "target_duration": 30,
                        "pacing": "balanced",
                        "language": request.language,
                        "tone": request.tone,
                        "audience": request.audience,
                    },
                )
                resp.raise_for_status()
                result = resp.json()

            video_file = result.get("video_file", "")
            video_filename = video_file.split("/")[-1] if video_file else ""
            return SmartActionResponse(
                action="video",
                intent=intent,
                text=f"Video generated: {result.get('message', 'Video ready')}",
                data=result,
                download_url=f"/video/{video_filename}" if video_filename else None,
                media_type="video",
                model="SD1.5 + Edge TTS + FFmpeg",
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="video",
                intent=intent,
                text=f"Video generation failed: {e}",
                model="error",
            )

    # ── Audio Generation ────────────────────────────────────────────────
    if intent == "generate_audio":
        try:
            from text.tts import generate_audio as _gen_audio
            import uuid as _uuid
            import os as _os

            audio_dir = "generated_audio"
            _os.makedirs(audio_dir, exist_ok=True)
            filename = f"chat_{_uuid.uuid4().hex[:8]}.mp3"
            output_file = f"{audio_dir}/{filename}"

            await _gen_audio(
                text=source,
                output_file=output_file,
                voice="en-US-AriaNeural",
            )
            return SmartActionResponse(
                action="audio",
                intent=intent,
                text="Your audio narration is ready.",
                data={"filename": filename, "voice": "en-US-AriaNeural"},
                download_url=f"/audio/{filename}",
                media_type="audio",
                model="Edge TTS",
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="audio",
                intent=intent,
                text=f"Audio generation failed: {e}",
                model="error",
            )

    # ── Presentation / PPT ──────────────────────────────────────────────
    if intent == "make_presentation":
        # Generate slide content via LLM, frontend handles PPTX export
        chat_request = ChatRequest(
            messages=request.messages,
            context=request.context,
            language=request.language,
            tone=request.tone,
            audience=request.audience,
            objective=request.objective,
            detail_level=request.detail_level,
        )
        system_prompt = build_system_prompt(chat_request, "make_presentation")
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        try:
            reply = await llm.generate(messages=messages, system_prompt=system_prompt)
            reply = clean_llm_response(reply)

            return SmartActionResponse(
                action="presentation",
                intent=intent,
                text=reply,
                data={"title": source, "content": reply},
                media_type="document",
                model=llm.model,
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="presentation",
                intent=intent,
                text=f"Presentation creation failed: {e}",
                model="error",
            )

    # ── Quality Score ───────────────────────────────────────────────────
    if intent == "quality_score":
        try:
            from consistency.quality_scorer import ContentQualityScorer

            report = ContentQualityScorer.evaluate_text(
                text=source,
                channel="text",
                uckr=None,
                target_audience=request.audience,
                target_tone=request.tone,
            )
            score_result = report.model_dump()
            return SmartActionResponse(
                action="quality",
                intent=intent,
                text=f"Quality score: {score_result.get('overall_score', 'N/A')}/100",
                data=score_result,
                model="Quality Engine",
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="quality",
                intent=intent,
                text="Quality scoring is currently unavailable. Please try the Quality & Validation panel.",
                model="error",
            )

    # ── Consistency / Fact Check ────────────────────────────────────────
    if intent == "consistency_check":
        try:
            from consistency.engine import ConsistencyEngine

            uckr = ConsistencyEngine.extract(source)
            facts_data = uckr.model_dump() if hasattr(uckr, 'model_dump') else uckr
            facts_list = facts_data.get("facts", []) if isinstance(facts_data, dict) else []
            return SmartActionResponse(
                action="consistency",
                intent=intent,
                text=f"Extracted {len(facts_list)} UCKR facts from your content.",
                data=facts_data,
                model="UCKR Engine",
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="consistency",
                intent=intent,
                text="Consistency check is currently unavailable.",
                model="error",
            )

    # ── Content Transformation (summarize, linkedin, twitter, etc.) ────
    if intent in ("transform", "summarization", "linkedin", "twitter",
                   "infographic", "advisory", "strategy", "clean_content"):
        # Map intent to output_type
        output_map = {
            "transform": "summary",
            "summarization": "summary",
            "linkedin": "linkedin",
            "twitter": "twitter",
            "infographic": "infographic",
            "advisory": "advisory",
            "strategy": "summary",
            "clean_content": "summary",
        }
        output_type = output_map.get(intent, "summary")

        # Use the LLM to generate the transformation
        chat_request = ChatRequest(
            messages=request.messages,
            context=request.context,
            language=request.language,
            tone=request.tone,
            audience=request.audience,
            objective=request.objective,
            detail_level=request.detail_level,
        )
        system_prompt = build_system_prompt(chat_request, intent)
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        try:
            reply = await llm.generate(messages=messages, system_prompt=system_prompt)
            reply = clean_llm_response(reply)

            return SmartActionResponse(
                action="transform",
                intent=intent,
                text=reply,
                data={"output_type": output_type, "intent": intent},
                model=llm.model,
            )
        except Exception as e:
            traceback.print_exc()
            return SmartActionResponse(
                action="transform",
                intent=intent,
                text=f"Transformation failed: {e}",
                model="error",
            )

    # ── Fallback ────────────────────────────────────────────────────────
    chat_request = ChatRequest(
        messages=request.messages,
        context=request.context,
        language=request.language,
        tone=request.tone,
        audience=request.audience,
        objective=request.objective,
        detail_level=request.detail_level,
    )
    chat_response = await chat(chat_request)
    return SmartActionResponse(
        action="chat",
        intent=intent,
        text=chat_response.reply,
        model=chat_response.model,
    )
