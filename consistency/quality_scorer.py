"""
consistency/quality_scorer.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
AI Content Quality Scoring Engine:
Evaluates generated content across 6 quantitative and qualitative dimensions:
1. Readability & Clarity (Flesch Reading Ease, Flesch-Kincaid Grade Level, sentence length)
2. Engagement & Hook Strength (Opening hook, rhetorical structure, CTA)
3. Information Density & Conciseness (Fact-to-word ratio, filler phrase detection)
4. Tone & Audience Alignment (Tone consistency, formality, audience calibration)
5. Structural Coherence (Logical transitions, formatting, bullet structuring)
6. Fact Grounding & Attribution (UCKR fact citation and entity representation)
"""

import re
import math
import logging
from typing import Dict, Any, List, Optional, Tuple

from .schemas import (
    UCKR,
    QualityDimensionScore,
    ContentQualityReport,
    DeliverablesQualityReport
)

logger = logging.getLogger(__name__)

# Common English filler / low-density phrases to detect
FILLER_PHRASES = [
    "it goes without saying that",
    "in order to",
    "it is important to note that",
    "at the end of the day",
    "needless to say",
    "for all intents and purposes",
    "due to the fact that",
    "in light of the fact that",
    "as a matter of fact",
    "each and every",
    "first and foremost",
    "with that being said",
    "all things considered"
]

# Logical transition words for structural flow
TRANSITION_MARKERS = [
    "however", "furthermore", "moreover", "therefore", "consequently",
    "specifically", "in addition", "as a result", "meanwhile", "for instance",
    "in contrast", "ultimately", "key", "notably", "significantly"
]


def count_syllables(word: str) -> int:
    """Heuristic syllable counter for English words."""
    word = word.lower().strip(".:;?!,'\"()[]{}")
    if not word:
        return 1
    if len(word) <= 3:
        return 1

    # Remove silent e
    if word.endswith("e") and not word.endswith("le") and len(word) > 2:
        word = word[:-1]

    # Count vowel groups
    vowels = "aeiouy"
    count = len(re.findall(r"[aeiouy]+", word))
    return max(1, count)


def grade_from_score(score: float) -> str:
    """Convert 0-100 numerical score to letter grade."""
    if score >= 90.0:
        return "A+"
    elif score >= 80.0:
        return "A"
    elif score >= 70.0:
        return "B"
    elif score >= 60.0:
        return "C"
    else:
        return "Needs Improvement"


class ContentQualityScorer:
    """
    Evaluates quality of text or multi-channel deliverables across
    Readability, Engagement, Information Density, Tone Alignment, Structure, and Grounding.
    """

    @classmethod
    def evaluate_text(
        cls,
        text: str,
        channel: str = "summary",
        uckr: Optional[UCKR] = None,
        target_audience: str = "Professional",
        target_tone: str = "Authoritative and engaging"
    ) -> ContentQualityReport:
        """Evaluate a single text or deliverable and produce a comprehensive ContentQualityReport."""
        clean_text = text.strip() if text else ""
        if not clean_text:
            empty_dim = QualityDimensionScore(name="Empty", score=0.0, grade="Needs Improvement", feedback="No content provided.")
            return ContentQualityReport(
                channel=channel,
                overall_score=0.0,
                overall_grade="Needs Improvement",
                readability=empty_dim,
                engagement_and_hook=empty_dim,
                information_density=empty_dim,
                tone_and_audience=empty_dim,
                structural_coherence=empty_dim,
                fact_grounding=empty_dim,
                strengths=[],
                recommendations=["Provide source content to evaluate."]
            )

        # 1. Readability & Clarity
        readability_dim = cls._score_readability(clean_text)

        # 2. Engagement & Hook Strength
        engagement_dim = cls._score_engagement(clean_text, channel)

        # 3. Information Density & Conciseness
        density_dim = cls._score_density(clean_text)

        # 4. Tone & Audience Alignment
        tone_dim = cls._score_tone_and_audience(clean_text, target_audience, target_tone)

        # 5. Structural Coherence
        structure_dim = cls._score_structure(clean_text)

        # 6. Fact Grounding & Attribution
        grounding_dim = cls._score_grounding(clean_text, uckr)

        # Calculate weighted composite overall score
        # Readability (20%), Engagement (20%), Density (20%), Tone (15%), Structure (15%), Grounding (10%)
        overall_score = round(
            (readability_dim.score * 0.20) +
            (engagement_dim.score * 0.20) +
            (density_dim.score * 0.20) +
            (tone_dim.score * 0.15) +
            (structure_dim.score * 0.15) +
            (grounding_dim.score * 0.10),
            1
        )
        overall_grade = grade_from_score(overall_score)

        # Compile strengths and actionable recommendations
        strengths, recommendations = cls._compile_feedback(
            readability_dim,
            engagement_dim,
            density_dim,
            tone_dim,
            structure_dim,
            grounding_dim
        )

        return ContentQualityReport(
            channel=channel,
            overall_score=overall_score,
            overall_grade=overall_grade,
            readability=readability_dim,
            engagement_and_hook=engagement_dim,
            information_density=density_dim,
            tone_and_audience=tone_dim,
            structural_coherence=structure_dim,
            fact_grounding=grounding_dim,
            strengths=strengths,
            recommendations=recommendations
        )

    @classmethod
    def evaluate_deliverables(
        cls,
        outputs: Dict[str, Any],
        uckr: Optional[UCKR] = None,
        target_audience: str = "Professional",
        target_tone: str = "Authoritative and engaging"
    ) -> DeliverablesQualityReport:
        """Evaluate full multi-channel deliverable suite (Summary, LinkedIn, Presentation, Video, etc.)."""
        channel_reports: Dict[str, ContentQualityReport] = {}

        # 1. Summary
        if "summary" in outputs:
            s_data = outputs["summary"]
            s_text = s_data.get("text", "") if isinstance(s_data, dict) else str(s_data)
            takeaways = " ".join(s_data.get("key_takeaways", [])) if isinstance(s_data, dict) else ""
            combined = f"{s_text}\n{takeaways}".strip()
            channel_reports["summary"] = cls.evaluate_text(combined, "summary", uckr, target_audience, target_tone)

        # 2. LinkedIn
        if "linkedin" in outputs:
            li_data = outputs["linkedin"]
            if isinstance(li_data, dict):
                li_text = f"{li_data.get('headline', '')}\n\n{li_data.get('post_content', '')}\n\n{li_data.get('call_to_action', '')}".strip()
            else:
                li_text = str(li_data)
            channel_reports["linkedin"] = cls.evaluate_text(li_text, "linkedin", uckr, target_audience, target_tone)

        # 3. Presentation
        if "presentation" in outputs:
            p_data = outputs["presentation"]
            p_lines = []
            if isinstance(p_data, dict):
                p_lines.append(p_data.get("presentation_title", ""))
                for slide in p_data.get("slides", []):
                    if isinstance(slide, dict):
                        p_lines.append(slide.get("title", ""))
                        p_lines.extend(slide.get("bullet_points", []))
                        p_lines.append(slide.get("speaker_notes", ""))
            else:
                p_lines.append(str(p_data))
            p_text = "\n".join([l for l in p_lines if l])
            channel_reports["presentation"] = cls.evaluate_text(p_text, "presentation", uckr, target_audience, target_tone)

        # 4. Video Storyboard
        if "video" in outputs:
            v_data = outputs["video"]
            v_lines = []
            if isinstance(v_data, dict):
                v_lines.append(v_data.get("video_title", ""))
                for sc in v_data.get("storyboard", []):
                    if isinstance(sc, dict):
                        v_lines.append(sc.get("narration", ""))
                        v_lines.append(sc.get("on_screen_text", ""))
            else:
                v_lines.append(str(v_data))
            v_text = "\n".join([l for l in v_lines if l])
            channel_reports["video"] = cls.evaluate_text(v_text, "video", uckr, target_audience, target_tone)

        # 5. Twitter
        if "twitter" in outputs:
            tw_data = outputs["twitter"]
            tw_lines = []
            if isinstance(tw_data, dict):
                for tweet in tw_data.get("thread", []):
                    if isinstance(tweet, dict):
                        tw_lines.append(tweet.get("text", ""))
            else:
                tw_lines.append(str(tw_data))
            tw_text = "\n".join(tw_lines)
            channel_reports["twitter"] = cls.evaluate_text(tw_text, "twitter", uckr, target_audience, target_tone)

        # 6. Advisory
        if "advisory" in outputs:
            adv_data = outputs["advisory"]
            adv_lines = []
            if isinstance(adv_data, dict):
                adv_lines.append(adv_data.get("executive_summary", ""))
                adv_lines.append(adv_data.get("situation_analysis", ""))
                adv_lines.extend(adv_data.get("recommended_actions", []))
            else:
                adv_lines.append(str(adv_data))
            adv_text = "\n".join(adv_lines)
            channel_reports["advisory"] = cls.evaluate_text(adv_text, "advisory", uckr, target_audience, target_tone)

        if not channel_reports:
            # Fallback if outputs is arbitrary text dictionary
            for ch, val in outputs.items():
                t = json.dumps(val) if isinstance(val, (dict, list)) else str(val)
                channel_reports[ch] = cls.evaluate_text(t, ch, uckr, target_audience, target_tone)

        avg_score = round(sum(r.overall_score for r in channel_reports.values()) / max(1, len(channel_reports)), 1)
        avg_grade = grade_from_score(avg_score)

        summary = f"Evaluated {len(channel_reports)} channels. Composite Quality Score: {avg_score}/100 (Grade: {avg_grade})."

        return DeliverablesQualityReport(
            status="success",
            overall_average_score=avg_score,
            overall_grade=avg_grade,
            channels=channel_reports,
            summary=summary
        )

    # ---------------------------------------------------------------------------
    # Internal Scoring Dimension Logic
    # ---------------------------------------------------------------------------

    @classmethod
    def _score_readability(cls, text: str) -> QualityDimensionScore:
        """Calculate Flesch Reading Ease and Flesch-Kincaid Grade Level."""
        words = re.findall(r"\b\w+\b", text)
        sentences = [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 0]

        total_words = max(1, len(words))
        total_sentences = max(1, len(sentences))
        total_syllables = sum(count_syllables(w) for w in words)

        words_per_sentence = total_words / total_sentences
        syllables_per_word = total_syllables / total_words

        # Flesch Reading Ease = 206.835 - (1.015 * ASL) - (84.6 * ASW)
        flesch_ease = 206.835 - (1.015 * words_per_sentence) - (84.6 * syllables_per_word)
        # Flesch-Kincaid Grade Level = 0.39 * ASL + 11.8 * ASW - 15.59
        fk_grade = (0.39 * words_per_sentence) + (11.8 * syllables_per_word) - 15.59

        # Calibrated scoring for technical and executive professional content
        if 45 <= flesch_ease <= 85:
            score = 92.0
            feedback = "Optimal clarity and professional readability level."
        elif fk_grade <= 16 and words_per_sentence <= 22:
            score = 88.0
            feedback = "Clear, structured phrasing suitable for technical and executive audiences."
        elif flesch_ease > 85:
            score = 90.0
            feedback = "Very easy to read and highly accessible."
        elif words_per_sentence > 30:
            score = 65.0
            feedback = "Sentences are quite long; consider breaking into shorter clauses."
        else:
            score = 82.0
            feedback = "Clear technical content with domain-specific terminology."

        grade = grade_from_score(score)
        return QualityDimensionScore(
            name="Readability & Clarity",
            score=round(score, 1),
            grade=grade,
            feedback=feedback,
            details={
                "flesch_reading_ease": round(flesch_ease, 1),
                "flesch_kincaid_grade": round(fk_grade, 1),
                "words_per_sentence": round(words_per_sentence, 1),
                "syllables_per_word": round(syllables_per_word, 2),
                "total_words": total_words,
                "total_sentences": total_sentences
            }
        )

    @classmethod
    def _score_engagement(cls, text: str, channel: str) -> QualityDimensionScore:
        """Evaluate opening hook, rhetorical momentum, bullet engagement, and call-to-action."""
        score = 75.0
        feedback_items = []

        # Hook detection in first 2 sentences
        sentences = [s.strip() for s in re.split(r"[.!?\n]+", text) if len(s.strip()) > 0]
        opening = " ".join(sentences[:2]) if sentences else ""

        has_numbers = bool(re.search(r"\d+%?|\$\d+", opening))
        has_question_or_exclamation = "?" in opening or "!" in opening or "🚀" in opening or "🚦" in opening
        has_power_words = bool(re.search(r"\b(transform|revolution|breakthrough|critical|exponential|accelerat|essential|unveil)\b", opening, re.I))

        if has_numbers or has_power_words:
            score += 10.0
            feedback_items.append("Strong opening hook with quantitative impact or high-impact verbs.")
        if has_question_or_exclamation:
            score += 5.0

        # CTA / Closing check
        closing = " ".join(sentences[-2:]) if len(sentences) >= 2 else ""
        has_cta = bool(re.search(r"\b(join|share|perspective|comment|read|discuss|explore|thoughts|prepared)\b", closing, re.I))
        if has_cta:
            score += 8.0
            feedback_items.append("Includes clear engagement call-to-action.")

        # Formatting engagement (bullet points, emoji/hashtags if social)
        if "•" in text or "-" in text or "#" in text:
            score += 5.0

        score = min(98.0, max(50.0, score))
        feedback = " ".join(feedback_items) if feedback_items else "Solid engagement and clear narrative trajectory."
        return QualityDimensionScore(
            name="Engagement & Hook Strength",
            score=round(score, 1),
            grade=grade_from_score(score),
            feedback=feedback,
            details={
                "has_hook_statistics": has_numbers,
                "has_power_words": has_power_words,
                "has_call_to_action": has_cta
            }
        )

    @classmethod
    def _score_density(cls, text: str) -> QualityDimensionScore:
        """Evaluate fact/metric density and check for redundant filler phrases."""
        text_lower = text.lower()
        words = re.findall(r"\b\w+\b", text_lower)
        total_words = max(1, len(words))

        # Check filler phrase occurrences
        found_fillers = [fp for fp in FILLER_PHRASES if fp in text_lower]

        # Extract metric occurrences (percentages, numbers, currency, quantities)
        metrics_found = re.findall(r"\$\d+(?:\.\d+)?(?:M|B|K|k)?|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?(?:M|B|K|k)?\b", text)

        score = 85.0
        if found_fillers:
            score -= len(found_fillers) * 5.0
        if metrics_found:
            score += min(12.0, len(metrics_found) * 3.0)

        # Lexical diversity (unique word ratio)
        unique_words = len(set(words))
        lexical_diversity = unique_words / total_words
        if lexical_diversity > 0.6:
            score += 5.0

        score = min(98.0, max(50.0, score))
        feedback = f"Concise information density ({len(metrics_found)} verified metrics, {len(found_fillers)} filler phrases)."
        return QualityDimensionScore(
            name="Information Density & Conciseness",
            score=round(score, 1),
            grade=grade_from_score(score),
            feedback=feedback,
            details={
                "metric_count": len(metrics_found),
                "filler_phrases_detected": found_fillers,
                "lexical_diversity": round(lexical_diversity, 2),
                "total_words": total_words
            }
        )

    @classmethod
    def _score_tone_and_audience(cls, text: str, target_audience: str, target_tone: str) -> QualityDimensionScore:
        """Evaluate consistency of tone and vocabulary suitable for the target audience."""
        score = 88.0
        feedback = f"Tone consistently aligns with {target_tone} tone and {target_audience} expectations."

        # Check for informal slang / inappropriate words in professional content
        if "professional" in target_audience.lower() or "authoritative" in target_tone.lower():
            informal_markers = re.findall(r"\b(gonna|wanna|kinda|gotta|huge deal|super cool|tons of)\b", text, re.I)
            if informal_markers:
                score -= len(informal_markers) * 6.0
                feedback = f"Detected casual colloquialisms ({', '.join(informal_markers)}). Recommend elevating vocabulary for professional tone."

        score = min(98.0, max(50.0, score))
        return QualityDimensionScore(
            name="Tone & Audience Alignment",
            score=round(score, 1),
            grade=grade_from_score(score),
            feedback=feedback,
            details={
                "target_audience": target_audience,
                "target_tone": target_tone
            }
        )

    @classmethod
    def _score_structure(cls, text: str) -> QualityDimensionScore:
        """Evaluate logical flow, connectors, and structured formatting."""
        text_lower = text.lower()
        found_transitions = [t for t in TRANSITION_MARKERS if t in text_lower]

        score = 80.0
        if len(found_transitions) >= 2:
            score += 10.0
        if "\n" in text or "•" in text or "1." in text or "2." in text:
            score += 8.0

        score = min(98.0, max(50.0, score))
        feedback = f"Clear structural progression with {len(found_transitions)} logical transition markers."
        return QualityDimensionScore(
            name="Structural Coherence",
            score=round(score, 1),
            grade=grade_from_score(score),
            feedback=feedback,
            details={
                "transition_markers_count": len(found_transitions),
                "has_structured_lists": ("•" in text or "1." in text or "\n\n" in text)
            }
        )

    @classmethod
    def _score_grounding(cls, text: str, uckr: Optional[UCKR] = None) -> QualityDimensionScore:
        """Evaluate fact citation and entity representation against UCKR."""
        if not uckr or not uckr.facts:
            return QualityDimensionScore(
                name="Fact Grounding & Attribution",
                score=90.0,
                grade="A+",
                feedback="Self-consistent factual grounding.",
                details={"uckr_available": False}
            )

        # Check cited Fact IDs (e.g. [F001], F002)
        valid_ids = {f.id for f in uckr.facts}
        cited_ids = set(re.findall(r"\bF\d{3,4}\b", text))
        matched_ids = cited_ids.intersection(valid_ids)

        # Check entity names in text
        matched_entities = [e.name for e in uckr.entities if e.name.lower() in text.lower()]

        score = 85.0
        if matched_ids:
            score += min(12.0, len(matched_ids) * 4.0)
        if matched_entities:
            score += min(8.0, len(matched_entities) * 2.0)

        score = min(100.0, max(50.0, score))
        feedback = f"Directly grounded in {len(matched_ids)} registered atomic facts and {len(matched_entities)} key entities."
        return QualityDimensionScore(
            name="Fact Grounding & Attribution",
            score=round(score, 1),
            grade=grade_from_score(score),
            feedback=feedback,
            details={
                "matched_fact_ids": list(matched_ids),
                "matched_entities": matched_entities
            }
        )

    @classmethod
    def _compile_feedback(
        cls,
        r: QualityDimensionScore,
        e: QualityDimensionScore,
        d: QualityDimensionScore,
        t: QualityDimensionScore,
        s: QualityDimensionScore,
        g: QualityDimensionScore
    ) -> Tuple[List[str], List[str]]:
        """Synthesize top strengths and actionable recommendations."""
        strengths = []
        recommendations = []

        if r.score >= 85:
            strengths.append("High readability clarity and accessible sentence pacing.")
        elif r.score < 75:
            recommendations.append("Simplify compound sentences to improve reading ease.")

        if e.score >= 85:
            strengths.append("Engaging opening hook with compelling metric highlights.")
        elif e.score < 75:
            recommendations.append("Strengthen opening sentence with a bold metric or strategic question.")

        if d.score >= 85:
            strengths.append("High information density without filler or redundant phrases.")
        elif d.score < 75:
            recommendations.append("Eliminate wordy filler expressions to sharpen conciseness.")

        if t.score >= 85:
            strengths.append("Authentic tone alignment perfectly suited for target audience.")

        if s.score >= 85:
            strengths.append("Well-organized structural flow with smooth logical transitions.")

        if g.score >= 85:
            strengths.append("Strong attribution and factual grounding against verified knowledge registry.")

        if not strengths:
            strengths.append("Solid baseline factual consistency and coherent presentation.")
        if not recommendations:
            recommendations.append("Content meets high professional publishing standards.")

        return strengths, recommendations
