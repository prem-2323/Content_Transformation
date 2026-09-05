import os
import re
import json
import copy
import logging
from typing import Dict, Any, List, Optional, Tuple

from text.qwen_service import generate_with_qwen, QwenServiceError
from .schemas import (
    UCKR,
    FactItem,
    EntityItem,
    ClaimItem,
    StatisticItem,
    RelationshipItem,
    GroundedSummary,
    GroundedLinkedIn,
    GroundedPresentation,
    SlideItem,
    GroundedVideo,
    SceneItem,
    GroundedTwitter,
    GroundedAdvisory
)

logger = logging.getLogger(__name__)


LANGUAGE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "tamil": {
        "code": "ta",
        "name": "Tamil",
        "native_name": "தமிழ்",
        "default_voice": "ta-IN-PallaviNeural",
        "male_voice": "ta-IN-ValluvarNeural",
        "sample_phrase": "செயற்கை நுண்ணறிவு நகர நிர்வாகத்தை மேம்படுத்துகிறது."
    },
    "hindi": {
        "code": "hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "default_voice": "hi-IN-SwaraNeural",
        "male_voice": "hi-IN-MadhurNeural",
        "sample_phrase": "आर्टिफिशियल इंटेलिजेंस शहरी प्रबंधन को बेहतर बनाता है।"
    },
    "telugu": {
        "code": "te",
        "name": "Telugu",
        "native_name": "తెలుగు",
        "default_voice": "te-IN-ShrutiNeural",
        "male_voice": "te-IN-MohanNeural",
        "sample_phrase": "ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ నగర నిర్వహణను మెరుగుపరుస్తుంది."
    },
    "malayalam": {
        "code": "ml",
        "name": "Malayalam",
        "native_name": "മലയാളം",
        "default_voice": "ml-IN-SobhanaNeural",
        "male_voice": "ml-IN-MidhunNeural",
        "sample_phrase": "ആർട്ടിഫിഷ്യൽ ഇന്റലിജൻസ് നഗര മാനേജ്മെന്റ് മെച്ചപ്പെടുത്തുന്നു."
    },
    "kannada": {
        "code": "kn",
        "name": "Kannada",
        "native_name": "ಕನ್ನಡ",
        "default_voice": "kn-IN-SapnaNeural",
        "male_voice": "kn-IN-GaganNeural",
        "sample_phrase": "ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯು ನಗರ ನಿರ್ವಹಣೆಯನ್ನು ಸುಧಾರಿಸುತ್ತದೆ."
    },
    "bengali": {
        "code": "bn",
        "name": "Bengali",
        "native_name": "বাংলা",
        "default_voice": "bn-IN-TanishaaNeural",
        "male_voice": "bn-IN-BashkarNeural",
        "sample_phrase": "কৃত্রিম বুদ্ধিমত্তা শহর ব্যবস্থাপনাকে উন্নত করে।"
    },
    "marathi": {
        "code": "mr",
        "name": "Marathi",
        "native_name": "मराठी",
        "default_voice": "mr-IN-AarohiNeural",
        "male_voice": "mr-IN-ManoharNeural",
        "sample_phrase": "कृत्रिम बुद्धिमत्ता शहर व्यवस्थापनात सुधारणा करते."
    },
    "gujarati": {
        "code": "gu",
        "name": "Gujarati",
        "native_name": "ગુજરાતી",
        "default_voice": "gu-IN-DhwaniNeural",
        "male_voice": "gu-IN-NiranjanNeural",
        "sample_phrase": "આર્ટિફિશિયલ ઇન્ટેલિજન્સ શહેરી વ્યવસ્થાપનને વધારે કાર્યક્ષમ બનાવે છે."
    },
    "english": {
        "code": "en",
        "name": "English",
        "native_name": "English",
        "default_voice": "en-IN-NeerjaNeural",
        "male_voice": "en-IN-PrabhatNeural",
        "sample_phrase": "Artificial intelligence enhances urban infrastructure and services."
    }
}


def normalize_language_name(lang: str) -> str:
    """Normalize input language string to standard key."""
    if not lang:
        return "english"
    clean = lang.strip().lower()
    for key, data in LANGUAGE_REGISTRY.items():
        if clean == key or clean == data["code"] or clean == data["name"].lower() or clean == data["native_name"].lower():
            return key
    return clean


def get_voice_for_language(language: str, gender: str = "female") -> str:
    """Get matching Edge TTS voice name for specified language."""
    norm_lang = normalize_language_name(language)
    data = LANGUAGE_REGISTRY.get(norm_lang)
    if not data:
        return "en-IN-NeerjaNeural"
    if gender.lower() == "male":
        return data.get("male_voice", data["default_voice"])
    return data["default_voice"]


TRANSLATION_PROMPT_TEMPLATE = """
You are an expert native translator specializing in technical and professional translation into {target_language} ({native_name}).

SOURCE TEXT ({source_language}):
{text}

CRITICAL RULES:
1. Translate fluently and accurately into natural, modern {target_language}.
2. Keep numbers, percentages (e.g. 35%), dates (e.g. 2025, 2035), currency ($5B), and Fact IDs (e.g. F001) exactly as they are.
3. Return ONLY the translated text without commentary, english disclaimers, or markdown fences.
"""


def translate_text_with_qwen(
    text: str,
    target_language: str,
    source_language: str = "English"
) -> str:
    """Translate text into target language using Qwen3 4B."""
    norm_lang = normalize_language_name(target_language)
    lang_info = LANGUAGE_REGISTRY.get(norm_lang, {"name": target_language, "native_name": target_language})
    target_name = lang_info["name"]
    native_name = lang_info.get("native_name", target_name)

    if norm_lang == "english" and source_language.lower() == "english":
        return text

    prompt = TRANSLATION_PROMPT_TEMPLATE.format(
        target_language=target_name,
        native_name=native_name,
        source_language=source_language,
        text=text
    )

    try:
        translated = generate_with_qwen(prompt).strip()
        if translated:
            # Strip accidental quotes or code fences
            if translated.startswith("```"):
                translated = translated.split("```", 2)[1]
            return translated.strip('"').strip("'").strip()
    except Exception as e:
        logger.warning(f"Qwen translation failed: {e}. Using language tag fallback.")

    return f"[{target_name}] {text}"


class MultilingualTransformer:
    """
    Translates and transforms UCKR and multi-channel deliverables
    into Indian languages (Tamil, Hindi, Telugu, Malayalam, etc.) and global languages.
    """

    @classmethod
    def translate_uckr(cls, uckr: UCKR, target_language: str) -> UCKR:
        """Translate UCKR content fields while preserving all Fact IDs, Entity IDs, and numbers."""
        norm_lang = normalize_language_name(target_language)
        if norm_lang == "english":
            return uckr

        lang_name = LANGUAGE_REGISTRY.get(norm_lang, {}).get("name", target_language)
        translated_uckr = copy.deepcopy(uckr)

        # Translate topic and summary
        translated_uckr.core_topic = translate_text_with_qwen(uckr.core_topic, lang_name)
        translated_uckr.summary = translate_text_with_qwen(uckr.summary, lang_name)

        # Translate facts (preserving exact IDs like F001 and references)
        for fact in translated_uckr.facts:
            fact.statement = translate_text_with_qwen(fact.statement, lang_name)

        # Translate claims
        for claim in translated_uckr.claims:
            claim.claim = translate_text_with_qwen(claim.claim, lang_name)

        # Translate entities descriptions
        for ent in translated_uckr.entities:
            if ent.description:
                ent.description = translate_text_with_qwen(ent.description, lang_name)

        return translated_uckr

    @classmethod
    def translate_deliverables(
        cls,
        outputs: Dict[str, Any],
        target_language: str,
        uckr: Optional[UCKR] = None
    ) -> Dict[str, Any]:
        """Translate all generated deliverables (Summary, LinkedIn, Presentation, Video) into target language."""
        norm_lang = normalize_language_name(target_language)
        if norm_lang == "english":
            return outputs

        lang_name = LANGUAGE_REGISTRY.get(norm_lang, {}).get("name", target_language)
        translated_outputs = copy.deepcopy(outputs)

        # 1. Summary
        if "summary" in translated_outputs and isinstance(translated_outputs["summary"], dict):
            s = translated_outputs["summary"]
            if "text" in s:
                s["text"] = translate_text_with_qwen(s["text"], lang_name)
            if "key_takeaways" in s and isinstance(s["key_takeaways"], list):
                s["key_takeaways"] = [translate_text_with_qwen(k, lang_name) for k in s["key_takeaways"]]
            s["language"] = lang_name

        # 2. LinkedIn
        if "linkedin" in translated_outputs and isinstance(translated_outputs["linkedin"], dict):
            li = translated_outputs["linkedin"]
            if "headline" in li:
                li["headline"] = translate_text_with_qwen(li["headline"], lang_name)
            if "post_content" in li:
                li["post_content"] = translate_text_with_qwen(li["post_content"], lang_name)
            if "call_to_action" in li and li["call_to_action"]:
                li["call_to_action"] = translate_text_with_qwen(li["call_to_action"], lang_name)
            li["language"] = lang_name

        # 3. Presentation
        if "presentation" in translated_outputs and isinstance(translated_outputs["presentation"], dict):
            p = translated_outputs["presentation"]
            if "presentation_title" in p:
                p["presentation_title"] = translate_text_with_qwen(p["presentation_title"], lang_name)
            if "subtitle" in p and p["subtitle"]:
                p["subtitle"] = translate_text_with_qwen(p["subtitle"], lang_name)
            for slide in p.get("slides", []):
                if isinstance(slide, dict):
                    if "title" in slide:
                        slide["title"] = translate_text_with_qwen(slide["title"], lang_name)
                    if "bullet_points" in slide and isinstance(slide["bullet_points"], list):
                        slide["bullet_points"] = [translate_text_with_qwen(b, lang_name) for b in slide["bullet_points"]]
                    if "speaker_notes" in slide and slide["speaker_notes"]:
                        slide["speaker_notes"] = translate_text_with_qwen(slide["speaker_notes"], lang_name)
            p["language"] = lang_name

        # 4. Video Storyboard & Narration
        if "video" in translated_outputs and isinstance(translated_outputs["video"], dict):
            v = translated_outputs["video"]
            if "video_title" in v:
                v["video_title"] = translate_text_with_qwen(v["video_title"], lang_name)
            for sc in v.get("storyboard", []):
                if isinstance(sc, dict):
                    if "narration" in sc:
                        sc["narration"] = translate_text_with_qwen(sc["narration"], lang_name)
                    if "on_screen_text" in sc and sc["on_screen_text"]:
                        sc["on_screen_text"] = translate_text_with_qwen(sc["on_screen_text"], lang_name)
            v["language"] = lang_name
            v["recommended_tts_voice"] = get_voice_for_language(lang_name)

        # 5. Twitter
        if "twitter" in translated_outputs and isinstance(translated_outputs["twitter"], dict):
            tw = translated_outputs["twitter"]
            for tweet in tw.get("thread", []):
                if isinstance(tweet, dict) and "text" in tweet:
                    tweet["text"] = translate_text_with_qwen(tweet["text"], lang_name)
            tw["language"] = lang_name

        # 6. Advisory
        if "advisory" in translated_outputs and isinstance(translated_outputs["advisory"], dict):
            adv = translated_outputs["advisory"]
            if "executive_summary" in adv:
                adv["executive_summary"] = translate_text_with_qwen(adv["executive_summary"], lang_name)
            if "situation_analysis" in adv:
                adv["situation_analysis"] = translate_text_with_qwen(adv["situation_analysis"], lang_name)
            if "recommended_actions" in adv and isinstance(adv["recommended_actions"], list):
                adv["recommended_actions"] = [translate_text_with_qwen(r, lang_name) for r in adv["recommended_actions"]]
            for sec in adv.get("sections", []):
                if isinstance(sec, dict):
                    if "heading" in sec:
                        sec["heading"] = translate_text_with_qwen(sec["heading"], lang_name)
                    if "content" in sec:
                        sec["content"] = translate_text_with_qwen(sec["content"], lang_name)
            adv["language"] = lang_name

        return translated_outputs
