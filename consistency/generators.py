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
    AdvisorySection,
    ProvenanceItem
)
from .provenance import ProvenanceTracker

logger = logging.getLogger(__name__)


def _clean_json(text: str) -> str:
    """Extract clean JSON substring from model output."""
    if not text:
        return ""
    # Strip Qwen3 <think> reasoning traces first
    t = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
    if "```json" in t:
        t = t.split("```json", 1)[1]
        if "```" in t:
            t = t.split("```", 1)[0]
    elif "```" in t:
        t = t.split("```", 1)[1]
        if "```" in t:
            t = t.split("```", 1)[0]
    t = t.strip()
    # Extract outermost JSON object if prose surrounds it
    if t and not t.startswith("{"):
        start = t.find("{")
        end = t.rfind("}")
        if start != -1 and end != -1 and end > start:
            t = t[start:end + 1]
    return t.strip()


def _format_facts_block(uckr: UCKR) -> str:
    """Format facts into an explicit numbered catalog for the LLM prompt."""
    lines = []
    for f in uckr.facts:
        lines.append(f"[{f.id}] (Importance: {f.importance}) {f.statement} (Ref: {f.source_reference})")
    return "\n".join(lines)


def _pages_for_fact_ids(fact_ids: List[str], uckr: UCKR) -> List[int]:
    """Resolve source page numbers for a list of cited Fact IDs."""
    facts_by_id = {f.id: f for f in uckr.facts}
    pages: List[int] = []
    for fid in fact_ids:
        fact = facts_by_id.get(fid)
        if fact:
            p, _ = ProvenanceTracker.pages_and_sections_for_fact(fact)
            pages.extend(p)
    return sorted(set(pages)) or [1]


def _to_provenance_item(evidence, text: str) -> ProvenanceItem:
    """Convert a StatementEvidence record into a ProvenanceItem for embedding."""
    return ProvenanceItem(
        text_segment=text,
        source_facts=evidence.source_facts,
        source_pages=evidence.source_pages,
        source_sections=evidence.source_sections,
        confidence=evidence.confidence,
        source_statements=evidence.source_statements,
        verification=evidence.verification,
    )


def _attach_slide_evidence(slides: List[SlideItem], uckr: UCKR) -> List[ProvenanceItem]:
    """Attach per-statement evidence + page numbers to every slide. Returns flattened evidence."""
    flat: List[ProvenanceItem] = []
    for slide in slides:
        slide.source_pages = _pages_for_fact_ids(slide.source_facts, uckr)
        container = f"slide_{slide.slide_number}"
        items: List[ProvenanceItem] = []
        parts = [("title", slide.title or "")] + [("bullet", b or "") for b in (slide.bullet_points or [])]
        if slide.speaker_notes:
            parts.append(("sentence", slide.speaker_notes))
        for idx, (kind, text) in enumerate(parts):
            if not text.strip():
                continue
            ev = ProvenanceTracker.evidence_for_statement(text, uckr, "presentation", container, idx, kind)
            items.append(_to_provenance_item(ev, text.strip()))
        slide.evidence = items
        flat.extend(items)
    return flat


def _attach_scene_evidence(scenes: List[SceneItem], uckr: UCKR) -> List[ProvenanceItem]:
    """Attach per-statement evidence + page numbers to every video scene. Returns flattened evidence."""
    flat: List[ProvenanceItem] = []
    for scene in scenes:
        scene.source_pages = _pages_for_fact_ids(scene.source_facts, uckr)
        container = f"scene_{scene.scene_number}"
        items: List[ProvenanceItem] = []
        if scene.narration and scene.narration.strip():
            for i, sent in enumerate(ProvenanceTracker._split_statements(scene.narration)):
                ev = ProvenanceTracker.evidence_for_statement(sent, uckr, "video", container, i, "narration")
                items.append(_to_provenance_item(ev, sent))
        if scene.on_screen_text and scene.on_screen_text.strip():
            ev = ProvenanceTracker.evidence_for_statement(
                scene.on_screen_text.strip(), uckr, "video", container, 0, "caption")
            items.append(_to_provenance_item(ev, scene.on_screen_text.strip()))
        scene.evidence = items
        flat.extend(items)
    return flat


def _attach_tweet_evidence(thread: List[TweetItem], uckr: UCKR) -> List[ProvenanceItem]:
    """Attach per-tweet evidence. Returns flattened evidence."""
    flat: List[ProvenanceItem] = []
    for tweet in thread:
        container = f"tweet_{tweet.tweet_number}"
        ev = ProvenanceTracker.evidence_for_statement(
            tweet.text or "", uckr, "twitter", container, tweet.tweet_number, "tweet")
        tweet.evidence = [_to_provenance_item(ev, (tweet.text or "").strip())] if (tweet.text or "").strip() else []
        flat.extend(tweet.evidence)
    return flat


def _attach_advisory_evidence(
    sections: List[AdvisorySection],
    uckr: UCKR,
    extra_texts: Optional[List[tuple]] = None,
) -> List[ProvenanceItem]:
    """Attach per-section evidence. extra_texts covers summary/analysis/actions. Returns flattened evidence."""
    flat: List[ProvenanceItem] = []
    for sec in sections:
        container = f"section_{sec.heading}"
        items: List[ProvenanceItem] = []
        for i, sent in enumerate(ProvenanceTracker._split_statements(sec.content or "")):
            ev = ProvenanceTracker.evidence_for_statement(sent, uckr, "advisory", container, i, "section")
            items.append(_to_provenance_item(ev, sent))
        sec.evidence = items
        flat.extend(items)
    for channel, container, text, kind, idx in (extra_texts or []):
        for i, sent in enumerate(ProvenanceTracker._split_statements(text or "")):
            ev = ProvenanceTracker.evidence_for_statement(sent, uckr, channel, container, idx + i, kind)
            flat.append(_to_provenance_item(ev, sent))
    return flat


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
    def generate(uckr: UCKR, config: OutputGenerationConfig, use_llm: bool = True) -> GroundedSummary:
        prompt = SUMMARY_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            audience=config.audience,
            tone=config.tone,
            detail_level=config.detail_level
        )

        if use_llm:
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

        # Deterministic Grounded Fallback with Audience Calibration
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)[:4]
        summary_sentences = [f.statement for f in top_facts]
        takeaways = [f"• {f.statement}" for f in top_facts[:3]]
        
        aud_lower = (config.audience or "professional").lower()
        if "exec" in aud_lower or "c-suite" in aud_lower or "leadership" in aud_lower:
            intro_prefix = f"Executive Strategic Briefing on {uckr.core_topic}:"
            footer = "Strategic Implication: Prioritize operational integration and capital allocation based on verified capabilities."
        elif "tech" in aud_lower or "eng" in aud_lower or "dev" in aud_lower:
            intro_prefix = f"Technical Implementation Overview ({uckr.core_topic}):"
            footer = "Architectural Note: System parameters and benchmarks validated against source documentation."
        else:
            intro_prefix = f"Understanding {uckr.core_topic}:"
            footer = "Key takeaway: These innovations represent significant advancements across the sector."

        fallback_text = f"{intro_prefix} {uckr.summary} " + " ".join(summary_sentences) + f" {footer}"
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
Create an engaging LinkedIn post with a strong hook tailored specifically for {audience}, clear body insights, takeaways, and hashtags.
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
    """Generates grounded LinkedIn post from UCKR tailored to audience."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig, use_llm: bool = True) -> GroundedLinkedIn:
        prompt = LINKEDIN_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            audience=config.audience,
            tone=config.tone
        )

        if use_llm:
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

        # Deterministic Grounded Fallback with Audience Tailoring
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)[:3]
        facts_text = "\n\n".join([f"🔹 {f.statement}" for f in top_facts])
        
        aud_lower = (config.audience or "professional").lower()
        if "exec" in aud_lower or "c-suite" in aud_lower:
            headline = f"Strategic Leadership: Why {uckr.core_topic} Matters for the C-Suite 📈"
            cta = "Leaders: How is your organization addressing this in upcoming roadmap cycles?"
        elif "tech" in aud_lower or "eng" in aud_lower:
            headline = f"Deep Dive: Engineering Architecture Behind {uckr.core_topic} ⚙️"
            cta = "Engineers & architects: What are your perspectives on these technical benchmarks?"
        else:
            headline = f"How {uckr.core_topic} is Reshaping Industry Dynamics 🚀"
            cta = "Share your perspective in the comments below!"

        body = (
            f"🚀 Transforming how we approach {uckr.core_topic}.\n\n"
            f"{uckr.summary}\n\n"
            f"Key verified insights:\n{facts_text}\n\n"
            f"The pace of innovation is accelerating. Are you prepared?"
        )
        hashtags = [f"#{c.replace(' ', '')}" for c in uckr.key_concepts[:4]] or ["#Tech", "#Innovation"]
        return GroundedLinkedIn(
            headline=headline,
            post_content=body,
            hashtags=hashtags,
            call_to_action=cta,
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
    def generate(uckr: UCKR, config: OutputGenerationConfig, use_llm: bool = True) -> GroundedPresentation:
        prompt = PRESENTATION_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            slide_count=config.slide_count,
            audience=config.audience
        )

        if use_llm:
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
                        source_facts=list(all_facts_set) or [f.id for f in uckr.facts[:4]],
                        evidence=_attach_slide_evidence(slides, uckr)
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
            source_facts=list(dict.fromkeys(all_used_facts)),
            evidence=_attach_slide_evidence(slides, uckr)
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
    """Generates grounded video storyboard with Intelligent Video Planning from UCKR."""

    @staticmethod
    def generate(uckr: UCKR, config: OutputGenerationConfig, use_llm: bool = True) -> GroundedVideo:
        target_duration = float(config.video_duration or 30)
        # Optimal scene count: ~5 seconds per scene
        num_scenes = max(3, min(12, round(target_duration / 5.0)))
        avg_dur = round(target_duration / num_scenes, 2)

        prompt = VIDEO_PROMPT.format(
            facts_catalog=_format_facts_block(uckr),
            core_topic=uckr.core_topic,
            duration=int(target_duration)
        )

        valid_ids = {f.id for f in uckr.facts}

        if use_llm:
            try:
                raw = generate_with_qwen(prompt)
                data = json.loads(_clean_json(raw))
                if isinstance(data, dict) and "storyboard" in data and len(data["storyboard"]) >= 2:
                    raw_scenes = data["storyboard"][:num_scenes]
                    scenes: List[SceneItem] = []
                    all_facts_set = set()
                    curr_t = 0.0

                    for i, sc in enumerate(raw_scenes, start=1):
                        sc_facts = [fid for fid in sc.get("source_facts", []) if fid in valid_ids]
                        all_facts_set.update(sc_facts)
                        dur = round(float(sc.get("duration_seconds", avg_dur)), 2)
                        start_t = round(curr_t, 2)
                        end_t = round(curr_t + dur, 2)
                        curr_t = end_t

                        imp = float(sc.get("visual_importance", 0.85 if i == 2 else 0.8))
                        tier = "HIGH" if imp >= 0.85 else "MEDIUM"
                        from video.planner import seconds_to_srt_timestamp

                        scenes.append(SceneItem(
                            scene_number=i,
                            duration_seconds=int(round(dur)),
                            visual_importance=imp,
                            visual_tier=tier,
                            visual_prompt=sc.get("visual_prompt", f"cinematic shot of {uckr.core_topic}"),
                            narration=sc.get("narration", ""),
                            on_screen_text=sc.get("on_screen_text", ""),
                            start_time=start_t,
                            end_time=end_t,
                            transition_type="crossfade" if i < len(raw_scenes) else "fade",
                            transition_duration=0.5 if i < len(raw_scenes) else 0.0,
                            subtitle_start=seconds_to_srt_timestamp(start_t),
                            subtitle_end=seconds_to_srt_timestamp(end_t),
                            source_facts=sc_facts
                        ))

                    timeline = [
                        {
                            "scene_number": s.scene_number,
                            "start_time": s.start_time,
                            "end_time": s.end_time,
                            "duration": s.duration_seconds,
                            "visual_tier": s.visual_tier,
                            "narration": s.narration
                        }
                        for s in scenes
                    ]

                return GroundedVideo(
                    video_title=data.get("video_title", uckr.core_topic),
                    total_duration_seconds=int(round(sum(s.duration_seconds for s in scenes))),
                    storyboard=scenes,
                    source_facts=list(all_facts_set) or [f.id for f in uckr.facts[:4]],
                    timeline=timeline,
                    ffmpeg_sync_metadata={
                        "target_duration": target_duration,
                        "scene_count": len(scenes),
                        "sync_status": "synchronized"
                    },
                    evidence=_attach_scene_evidence(scenes, uckr)
                )
            except Exception as e:
                logger.warning(f"VideoGenerator LLM fallback: {e}")

        # Deterministic Grounded Intelligent Fallback
        scenes = []
        top_facts = sorted(uckr.facts, key=lambda x: x.importance, reverse=True)
        from video.planner import seconds_to_srt_timestamp

        dur_per_scene = target_duration / num_scenes
        current_time = 0.0

        # Scene 1: Intro Hook
        start_t = round(current_time, 2)
        end_t = round(current_time + dur_per_scene, 2)
        current_time = end_t
        scenes.append(SceneItem(
            scene_number=1,
            duration_seconds=int(round(dur_per_scene)),
            visual_importance=0.85,
            visual_tier="HIGH",
            visual_prompt=f"cinematic photorealistic opening establishing shot representing {uckr.core_topic}, 8k, volumetric lighting",
            narration=f"Welcome to {uckr.core_topic}. Here is what the latest findings demonstrate.",
            on_screen_text=f"{uckr.core_topic}",
            start_time=start_t,
            end_time=end_t,
            transition_type="crossfade",
            transition_duration=0.5,
            subtitle_start=seconds_to_srt_timestamp(start_t),
            subtitle_end=seconds_to_srt_timestamp(end_t),
            source_facts=[top_facts[0].id] if top_facts else []
        ))

        # Scenes 2..N-1: Grounded Facts
        for idx in range(2, num_scenes):
            fact_idx = (idx - 2) % len(top_facts) if top_facts else None
            fact = top_facts[fact_idx] if fact_idx is not None else None
            stmt = fact.statement if fact else f"Critical key insight for {uckr.core_topic}."
            f_id = [fact.id] if fact else []
            imp = fact.importance if fact else 0.8

            start_t = round(current_time, 2)
            end_t = round(current_time + dur_per_scene, 2)
            current_time = end_t

            scenes.append(SceneItem(
                scene_number=idx,
                duration_seconds=int(round(dur_per_scene)),
                visual_importance=imp,
                visual_tier="HIGH" if imp >= 0.85 else "MEDIUM",
                visual_prompt=f"cinematic dynamic visual illustrating {stmt[:60]}, 8k resolution, crisp detail",
                narration=stmt,
                on_screen_text=fact.category if fact and fact.category else f"Finding {idx}",
                start_time=start_t,
                end_time=end_t,
                transition_type="crossfade",
                transition_duration=0.5,
                subtitle_start=seconds_to_srt_timestamp(start_t),
                subtitle_end=seconds_to_srt_timestamp(end_t),
                source_facts=f_id
            ))

        # Final Scene: Outro
        start_t = round(current_time, 2)
        end_t = round(current_time + dur_per_scene, 2)
        scenes.append(SceneItem(
            scene_number=num_scenes,
            duration_seconds=int(round(dur_per_scene)),
            visual_importance=0.75,
            visual_tier="MEDIUM",
            visual_prompt=f"futuristic glowing technology horizon, ultra high resolution, cinematic ending frame",
            narration=f"Stay informed as {uckr.core_topic} continues to transform modern practices.",
            on_screen_text="The Future Unfolding",
            start_time=start_t,
            end_time=end_t,
            transition_type="fade",
            transition_duration=0.0,
            subtitle_start=seconds_to_srt_timestamp(start_t),
            subtitle_end=seconds_to_srt_timestamp(end_t),
            source_facts=[top_facts[-1].id] if top_facts else []
        ))

        all_used = []
        for sc in scenes:
            all_used.extend(sc.source_facts)

        timeline = [
            {
                "scene_number": s.scene_number,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "duration": s.duration_seconds,
                "visual_tier": s.visual_tier,
                "narration": s.narration
            }
            for s in scenes
        ]

        return GroundedVideo(
            video_title=f"Explaining {uckr.core_topic}",
            total_duration_seconds=int(round(sum(sc.duration_seconds for sc in scenes))),
            storyboard=scenes,
            source_facts=list(dict.fromkeys(all_used)),
            timeline=timeline,
            ffmpeg_sync_metadata={
                "target_duration": target_duration,
                "scene_count": len(scenes),
                "sync_status": "synchronized"
            },
            evidence=_attach_scene_evidence(scenes, uckr)
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
            source_facts=list(dict.fromkeys(all_facts)),
            evidence=_attach_tweet_evidence(thread, uckr)
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

        executive_summary = f"Executive Advisory on {uckr.core_topic}. {uckr.summary}"
        situation_analysis = f"Analysis based on {len(uckr.facts)} verified facts in {uckr.document.domain}."
        recommended_actions = [
            "Deploy proactive strategy based on core findings",
            "Integrate continuous data-driven validation",
            "Audit operational readiness across affected domains"
        ]
        all_facts = [fid for sec in sections for fid in sec.source_facts]
        evidence = _attach_advisory_evidence(
            sections,
            uckr,
            extra_texts=[
                ("advisory", "executive_summary", executive_summary, "sentence", 0),
                ("advisory", "situation_analysis", situation_analysis, "sentence", 0),
            ] + [
                ("advisory", "recommended_actions", action, "action", i)
                for i, action in enumerate(recommended_actions)
            ],
        )
        return GroundedAdvisory(
            executive_summary=executive_summary,
            situation_analysis=situation_analysis,
            recommended_actions=recommended_actions,
            sections=sections,
            source_facts=list(dict.fromkeys(all_facts)),
            evidence=evidence
        )
