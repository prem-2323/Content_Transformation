from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from .chat_models import (
    ChatRequest,
    ChatResponse
)

from .content_router import detect_intent
from .llm_service import LocalLLM


router = APIRouter(
    prefix="/api/ai",
    tags=["AI Chat"]
)


llm = LocalLLM(
    model="qwen3:4b-no-think"
)


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

    elif intent == "presentation":

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

    elif intent == "video":

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

    elif intent == "fact_check":

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

    system_prompt = build_system_prompt(
        request,
        intent
    )

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

        raise HTTPException(
            status_code=500,
            detail=(
                "Local AI model is unavailable. "
                "Make sure Ollama is running."
            )
        )
