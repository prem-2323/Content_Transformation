import json
import re
import logging
from typing import Dict, Any, List, Optional

from text.qwen_service import generate_with_qwen, QwenServiceError
from .schemas import (
    UCKR,
    OutputGenerationConfig,
    GroundedSummary,
    GroundedLinkedIn,
    GroundedPresentation,
    SlideItem,
    GroundedVideo,
    SceneItem,
    GroundedTwitter,
    TweetItem,
    GroundedAdvisory,
    AdvisorySection
)
from .provenance import ProvenanceTracker

logger = logging.getLogger(__name__)


def _clean_json(text: str) -> str:
    """Extract clean JSON substring from model output."""
    t = text.strip()
    if "```json" in t:
        t = t.split("```json", 1)[1]
        if "```" in t:
            t = t.split("```", 1)[0]
    elif "```" in t:
        t = t.split("```", 1)[1]
        if "```" in t:
            t = t.split("```", 1)[0]
    return t.strip()


def _format_facts_block(uckr: UCKR) -> str:
    """Format facts into an explicit numbered catalog for the LLM prompt."""
    lines = []
    for f in uckr.facts:
        lines.append(f"[{f.id}] (Importance: {f.importance}) {f.statement} (Ref: {f.source_reference})")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 1. Summary Generator
# ---------------------------------------------------------------------------

SUMMARY_PROMPT = """
You are a precise technical writer creating a grounded executive summary from a Unified Content Knowledge Representation (UCKR).

GROUNDED FACTS CATALOG:
{facts_catalog}

TOPIC: {core_topic}
AUDIENCE: {audience}
TONE: {tone}
DETAIL LEVEL: {detail_level}

TASK:
Write a high-impact executive summary and key takeaways.
EVERY claim you make MUST cite the specific fact IDs used in the `source_facts` list.

RETURN ONLY VALID JSON matching this structure:
{{
  "text": "Comprehensive executive summary paragraph...",
  "key_takeaways": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3"
  ],
  "source_facts": ["F001", "F002", "F003"]
}}
"""


class SummaryGenerator:
    """Generates grounded executive summary from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig) -> GroundedSummary:
        prompt = SUMMARY_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            audience=config.audience,
            tone=config.tone,
            detail_level=config.detail_level
        )

        try:
            raw = generate_with_qwen(prompt)
            data = json.loads(_clean_json(raw))
            if isinstance(data, dict) and "text" in data:
                # Ensure valid fact IDs
                valid_ids = [f.id for f in uckr.facts]
                cited = [fid for fid in data.get("source_facts", []) if fid in valid_ids] or [f.id for f in uckr.facts[:3]]
                summary_text = data["text"]
                return GroundedSummary(
                    text=summary_text,
                    key_takeaways=data.get("key_takeaways", []),
                    source_facts=cited,
                    provenance=ProvenanceTracker.extract_provenance(summary_text, uckr)
                )
        except Exception as e:
            logger.warning(f"SummaryGenerator LLM fallback: {e}")

        # Deterministic Grounded Fallback
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)[:4]
        summary_sentences = [f.statement for f in top_facts]
        takeaways = [f"• {f.statement}" for f in top_facts[:3]]
        fallback_text = f"{uckr.summary} " + " ".join(summary_sentences)
        return GroundedSummary(
            text=fallback_text,
            key_takeaways=takeaways,
            source_facts=[f.id for f in top_facts],
            provenance=ProvenanceTracker.extract_provenance(fallback_text, uckr)
        )


# ---------------------------------------------------------------------------
# 2. LinkedIn Generator
# ---------------------------------------------------------------------------

LINKEDIN_PROMPT = """
You are a top social media strategist creating a viral, authoritative LinkedIn post from a Unified Content Knowledge Representation (UCKR).

GROUNDED FACTS CATALOG:
{facts_catalog}

TOPIC: {core_topic}
AUDIENCE: {audience}
TONE: {tone}

TASK:
Create an engaging LinkedIn post with a strong hook, clear body insights, takeaways, and hashtags.
GROUND your post in the provided facts and list ALL fact IDs referenced in `source_facts`.

RETURN ONLY VALID JSON matching this structure:
{{
  "headline": "Compelling Hook / Headline",
  "post_content": "Full formatted post with clean spacing...",
  "hashtags": ["#AI", "#Innovation", "#Tech"],
  "call_to_action": "What are your thoughts? Join the conversation below.",
  "source_facts": ["F001", "F002"]
}}
"""


class LinkedInGenerator:
    """Generates grounded LinkedIn post from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig) -> GroundedLinkedIn:
        prompt = LINKEDIN_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            audience=config.audience,
            tone=config.tone
        )

        try:
            raw = generate_with_qwen(prompt)
            data = json.loads(_clean_json(raw))
            if isinstance(data, dict) and "headline" in data and "post_content" in data:
                valid_ids = [f.id for f in uckr.facts]
                cited = [fid for fid in data.get("source_facts", []) if fid in valid_ids] or [f.id for f in uckr.facts[:3]]
                post_body = data["post_content"]
                return GroundedLinkedIn(
                    headline=data["headline"],
                    post_content=post_body,
                    hashtags=data.get("hashtags", ["#Innovation", "#Tech"]),
                    call_to_action=data.get("call_to_action", "What are your thoughts on this?"),
                    source_facts=cited,
                    provenance=ProvenanceTracker.extract_provenance(post_body, uckr)
                )
        except Exception as e:
            logger.warning(f"LinkedInGenerator LLM fallback: {e}")

        # Deterministic Grounded Fallback
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)[:3]
        facts_text = "\n\n".join([f"🔹 {f.statement}" for f in top_facts])
        headline = f"How {uckr.core_topic} is Reshaping Industry Dynamics"
        body = (
            f"🚀 Transforming how we approach {uckr.core_topic}.\n\n"
            f"{uckr.summary}\n\n"
            f"Key insights to know:\n{facts_text}\n\n"
            f"The pace of innovation is accelerating. Are you prepared?"
        )
        hashtags = [f"#{c.replace(' ', '')}" for c in uckr.key_concepts[:4]] or ["#Tech", "#Innovation"]
        return GroundedLinkedIn(
            headline=headline,
            post_content=body,
            hashtags=hashtags,
            call_to_action="Share your perspective in the comments below!",
            source_facts=[f.id for f in top_facts],
            provenance=ProvenanceTracker.extract_provenance(body, uckr)
        )


# ---------------------------------------------------------------------------
# 3. Presentation Generator
# ---------------------------------------------------------------------------

PRESENTATION_PROMPT = """
You are a senior presentation designer creating a slide deck from a Unified Content Knowledge Representation (UCKR).

GROUNDED FACTS CATALOG:
{facts_catalog}

TOPIC: {core_topic}
SLIDE COUNT: {slide_count}
AUDIENCE: {audience}

TASK:
Create a structured presentation with {slide_count} slides.
For EACH slide, specify title, layout (bullet_points, two_column, or metrics), bullet points, speaker notes, visual recommendation, and the EXACT fact IDs grounded in that slide.

RETURN ONLY VALID JSON matching this structure:
{{
  "presentation_title": "{core_topic}",
  "subtitle": "Executive Briefing & Strategic Overview",
  "slides": [
    {{
      "slide_number": 1,
      "title": "Title Slide",
      "layout": "title",
      "bullet_points": ["Key theme 1", "Key theme 2"],
      "speaker_notes": "Welcome everyone...",
      "visual_recommendation": "Clean modern title graphic with gradient background",
      "source_facts": ["F001"]
    }},
    {{
      "slide_number": 2,
      "title": "Core Insights",
      "layout": "bullet_points",
      "bullet_points": ["Point 1", "Point 2"],
      "speaker_notes": "Here we examine...",
      "visual_recommendation": "Data visualization diagram",
      "source_facts": ["F002", "F003"]
    }}
  ],
  "source_facts": ["F001", "F002", "F003"]
}}
"""


class PresentationGenerator:
    """Generates grounded presentation slides from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig) -> GroundedPresentation:
        prompt = PRESENTATION_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            slide_count=config.slide_count,
            audience=config.audience
        )

        try:
            raw = generate_with_qwen(prompt)
            data = json.loads(_clean_json(raw))
            if isinstance(data, dict) and "slides" in data and len(data["slides"]) > 0:
                valid_ids = {f.id for f in uckr.facts}
                slides: List[SlideItem] = []
                all_facts_set = set()

                for s in data["slides"]:
                    s_facts = [fid for fid in s.get("source_facts", []) if fid in valid_ids]
                    all_facts_set.update(s_facts)
                    slides.append(SlideItem(
                        slide_number=s.get("slide_number", len(slides) + 1),
                        title=s.get("title", f"Slide {len(slides) + 1}"),
                        layout=s.get("layout", "bullet_points"),
                        bullet_points=s.get("bullet_points", []),
                        speaker_notes=s.get("speaker_notes", ""),
                        visual_recommendation=s.get("visual_recommendation", ""),
                        source_facts=s_facts
                    ))

                return GroundedPresentation(
                    presentation_title=data.get("presentation_title", uckr.core_topic),
                    subtitle=data.get("subtitle", "Executive Knowledge Briefing"),
                    slides=slides,
                    source_facts=list(all_facts_set) or [f.id for f in uckr.facts[:4]]
                )
        except Exception as e:
            logger.warning(f"PresentationGenerator LLM fallback: {e}")

        # Deterministic Grounded Fallback
        slides = [
            SlideItem(
                slide_number=1,
                title=uckr.core_topic,
                layout="title",
                bullet_points=[uckr.summary],
                speaker_notes=f"Welcome. Today we review {uckr.core_topic}.",
                visual_recommendation="High-impact title visual representing technology domain",
                source_facts=[uckr.facts[0].id] if uckr.facts else []
            )
        ]

        # Chunk facts across subsequent slides
        fact_chunks = [uckr.facts[i:i + 2] for i in range(0, len(uckr.facts), 2)]
        for idx, chunk in enumerate(fact_chunks[:config.slide_count - 1], 2):
            chunk_facts = [f.id for f in chunk]
            slides.append(SlideItem(
                slide_number=idx,
                title=f"Strategic Analysis: {chunk[0].category if chunk else 'Key Findings'}",
                layout="bullet_points",
                bullet_points=[f.statement for f in chunk],
                speaker_notes=f"Discussing {len(chunk)} verified findings from source documentation.",
                visual_recommendation="Infographic diagram with quantitative milestone icons",
                source_facts=chunk_facts
            ))

        all_used_facts = []
        for s in slides:
            all_used_facts.extend(s.source_facts)

        return GroundedPresentation(
            presentation_title=uckr.core_topic,
            subtitle="Executive Knowledge Representation",
            slides=slides,
            source_facts=list(dict.fromkeys(all_used_facts))
        )


# ---------------------------------------------------------------------------
# 4. Video Storyboard Generator
# ---------------------------------------------------------------------------

VIDEO_PROMPT = """
You are a video producer and director creating a cinematic storyboard from a Unified Content Knowledge Representation (UCKR).

GROUNDED FACTS CATALOG:
{facts_catalog}

TOPIC: {core_topic}
TARGET DURATION: {duration} seconds

TASK:
Create a dynamic scene-by-scene storyboard (4 to 6 scenes).
For EACH scene, define:
- scene_number (int)
- duration_seconds (int, typically 5-8s)
- visual_prompt (cinematic Stable Diffusion image prompt)
- narration (spoken voiceover text)
- on_screen_text (punchy overlay caption)
- source_facts (list of exact Fact IDs grounded in this scene)

RETURN ONLY VALID JSON matching this structure:
{{
  "video_title": "{core_topic}",
  "total_duration_seconds": {duration},
  "storyboard": [
    {{
      "scene_number": 1,
      "duration_seconds": 6,
      "visual_prompt": "cinematic photorealistic wide shot of smart city with glowing network lines, 8k, unreal engine 5",
      "narration": "Artificial intelligence is quietly revolutionizing modern urban infrastructure.",
      "on_screen_text": "Transforming Smart Cities",
      "source_facts": ["F001"]
    }}
  ],
  "source_facts": ["F001"]
}}
"""


class VideoGenerator:
    """Generates grounded video storyboard and scene narration from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig) -> GroundedVideo:
        prompt = VIDEO_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            duration=config.video_duration
        )

        try:
            raw = generate_with_qwen(prompt)
            data = json.loads(_clean_json(raw))
            if isinstance(data, dict) and "storyboard" in data and len(data["storyboard"]) > 0:
                valid_ids = {f.id for f in uckr.facts}
                scenes: List[SceneItem] = []
                all_facts_set = set()

                for sc in data["storyboard"]:
                    sc_facts = [fid for fid in sc.get("source_facts", []) if fid in valid_ids]
                    all_facts_set.update(sc_facts)
                    scenes.append(SceneItem(
                        scene_number=sc.get("scene_number", len(scenes) + 1),
                        duration_seconds=sc.get("duration_seconds", 5),
                        visual_prompt=sc.get("visual_prompt", f"cinematic shot of {uckr.core_topic}"),
                        narration=sc.get("narration", ""),
                        on_screen_text=sc.get("on_screen_text", ""),
                        source_facts=sc_facts
                    ))

                return GroundedVideo(
                    video_title=data.get("video_title", uckr.core_topic),
                    total_duration_seconds=data.get("total_duration_seconds", config.video_duration),
                    storyboard=scenes,
                    source_facts=list(all_facts_set) or [f.id for f in uckr.facts[:4]]
                )
        except Exception as e:
            logger.warning(f"VideoGenerator LLM fallback: {e}")

        # Deterministic Grounded Fallback
        scenes = []
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)[:5]

        # Scene 1: Intro Hook
        scenes.append(SceneItem(
            scene_number=1,
            duration_seconds=5,
            visual_prompt=f"cinematic photorealistic opening shot representing {uckr.core_topic}, 8k, volumetric lighting",
            narration=f"Welcome to the forefront of {uckr.core_topic}. Here is what you need to know.",
            on_screen_text=f"{uckr.core_topic}",
            source_facts=[top_facts[0].id] if top_facts else []
        ))

        # Scenes 2..N: Grounded Facts
        for idx, fact in enumerate(top_facts[:4], 2):
            scenes.append(SceneItem(
                scene_number=idx,
                duration_seconds=6,
                visual_prompt=f"cinematic dynamic visual illustrating {fact.statement[:60]}, 8k resolution, crisp detail",
                narration=fact.statement,
                on_screen_text=fact.category or "Key Discovery",
                source_facts=[fact.id]
            ))

        # Final Scene: Outro
        scenes.append(SceneItem(
            scene_number=len(scenes) + 1,
            duration_seconds=5,
            visual_prompt=f"futuristic glowing technology horizon, ultra high resolution, cinematic ending frame",
            narration=f"Stay informed as {uckr.core_topic} continues to transform the future.",
            on_screen_text="The Future Unfolding",
            source_facts=[top_facts[-1].id] if top_facts else []
        ))

        all_used = []
        for sc in scenes:
            all_used.extend(sc.source_facts)

        return GroundedVideo(
            video_title=f"Explaining {uckr.core_topic}",
            total_duration_seconds=sum(sc.duration_seconds for sc in scenes),
            storyboard=scenes,
            source_facts=list(dict.fromkeys(all_used))
        )


# ---------------------------------------------------------------------------
# 5. Twitter & Advisory Generators
# ---------------------------------------------------------------------------

class TwitterGenerator:
    """Generates grounded Twitter thread from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig) -> GroundedTwitter:
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)[:5]
        thread: List[TweetItem] = [
            TweetItem(
                tweet_number=1,
                text=f"🧵 1/5: Let's break down the essential findings in {uckr.core_topic}. Here is what the latest data reveals:",
                source_facts=[top_facts[0].id] if top_facts else []
            )
        ]

        for idx, f in enumerate(top_facts[:4], 2):
            thread.append(TweetItem(
                tweet_number=idx,
                text=f"💡 {idx}/5: {f.statement}",
                source_facts=[f.id]
            ))

        all_facts = [fid for tw in thread for fid in tw.source_facts]
        return GroundedTwitter(
            thread=thread,
            source_facts=list(dict.fromkeys(all_facts))
        )


class AdvisoryGenerator:
    """Generates grounded advisory report from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig) -> GroundedAdvisory:
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)
        sections = [
            AdvisorySection(
                heading="Current Landscape",
                content=uckr.summary,
                source_facts=[f.id for f in top_facts[:2]]
            ),
            AdvisorySection(
                heading="Verified Critical Findings",
                content="\n".join([f"- {f.statement} (Source: {f.source_reference})" for f in top_facts[2:5]]),
                source_facts=[f.id for f in top_facts[2:5]]
            ),
            AdvisorySection(
                heading="Strategic Recommendations",
                content="1. Align enterprise roadmaps with verified capabilities.\n2. Implement continuous monitoring of key metrics.",
                source_facts=[f.id for f in top_facts[:3]]
            )
        ]

        all_facts = [fid for sec in sections for fid in sec.source_facts]
        return GroundedAdvisory(
            executive_summary=f"Executive Advisory on {uckr.core_topic}. {uckr.summary}",
            situation_analysis=f"Analysis based on {len(uckr.facts)} verified facts in {uckr.document.domain}.",
            recommended_actions=[
                "Deploy proactive strategy based on core findings",
                "Integrate continuous data-driven validation",
                "Audit operational readiness across affected domains"
            ],
            sections=sections,
            source_facts=list(dict.fromkeys(all_facts))
        )
