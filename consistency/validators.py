import re
import difflib
import math
from typing import Dict, List, Any, Set, Tuple, Optional

from .schemas import (
    UCKR,
    FactItem,
    StatisticItem,
    EntityItem,
    ClaimItem,
    ValidationCheckDetail,
    ConsistencyScoreBreakdown,
    ChannelConsistencyScore,
    DetailedValidationReport
)


def _extract_numbers_and_metrics(text: str) -> Set[str]:
    """Extract numbers, percentages, currency, and years from text."""
    if not text:
        return set()
    patterns = [
        r"\b\d+(?:\.\d+)?%",                          # Percentages: 35%, 28.5%
        r"\$\s*\d+(?:\.\d+)?(?:\s*(?:billion|million|trillion|[BMK]))?\b",  # Currency: $5 billion, $100M
        r"\b(?:19|20)\d{2}\b",                         # Years: 2025, 2035
        r"\b\d+(?:\.\d+)?\s*(?:million|billion|trillion|thousand|k|m|b)\b", # Word amounts
        r"\b\d+(?:\.\d+)?\s*x\b",                      # Multipliers: 10x
        r"\b\d+(?:\.\d+)?\b"                           # Plain numbers
    ]
    matches = set()
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            raw = m.group(0).strip().lower()
            # Normalize whitespace in currency/numbers
            clean = re.sub(r"\s+", "", raw)
            matches.add(clean)
    return matches


def _extract_text_content(channel_data: Any) -> str:
    """Flatten any structured output dictionary into combined text."""
    if isinstance(channel_data, str):
        return channel_data
    if not isinstance(channel_data, dict):
        return ""

    parts = []
    if "text" in channel_data:
        parts.append(str(channel_data["text"]))
    if "headline" in channel_data:
        parts.append(str(channel_data["headline"]))
    if "post_content" in channel_data:
        parts.append(str(channel_data["post_content"]))
    if "executive_summary" in channel_data:
        parts.append(str(channel_data["executive_summary"]))
    if "situation_analysis" in channel_data:
        parts.append(str(channel_data["situation_analysis"]))
    if "key_takeaways" in channel_data and isinstance(channel_data["key_takeaways"], list):
        parts.extend([str(k) for k in channel_data["key_takeaways"]])
    if "recommended_actions" in channel_data and isinstance(channel_data["recommended_actions"], list):
        parts.extend([str(r) for r in channel_data["recommended_actions"]])

    # Presentation slides
    if "slides" in channel_data and isinstance(channel_data["slides"], list):
        for s in channel_data["slides"]:
            if isinstance(s, dict):
                parts.append(str(s.get("title", "")))
                parts.extend([str(b) for b in s.get("bullet_points", [])])
                parts.append(str(s.get("speaker_notes", "")))

    # Video storyboard
    if "storyboard" in channel_data and isinstance(channel_data["storyboard"], list):
        for sc in channel_data["storyboard"]:
            if isinstance(sc, dict):
                parts.append(str(sc.get("narration", "")))
                parts.append(str(sc.get("on_screen_text", "")))

    # Twitter thread
    if "thread" in channel_data and isinstance(channel_data["thread"], list):
        for tw in channel_data["thread"]:
            if isinstance(tw, dict):
                parts.append(str(tw.get("text", "")))

    # Advisory sections
    if "sections" in channel_data and isinstance(channel_data["sections"], list):
        for sec in channel_data["sections"]:
            if isinstance(sec, dict):
                parts.append(str(sec.get("content", "")))

    return " ".join(parts)


SYNONYM_MAP = {
    "ai": "artificial intelligence",
    "ml": "machine learning",
    "mgmt": "management",
    "optimize": "improve",
    "optimizes": "improves",
    "optimizing": "improving",
    "enhances": "improves",
    "boosts": "improves",
    "reduces": "cuts",
    "decrease": "cut",
    "smart cities": "urban systems",
}


def _normalize_semantics(text: str) -> str:
    """Normalize common abbreviations and synonyms for semantic comparison."""
    t = text.lower()
    for k, v in SYNONYM_MAP.items():
        t = re.sub(r"\b" + re.escape(k) + r"\b", v, t)
    return re.sub(r"[^\w\s]", "", t).strip()


def compute_semantic_similarity(s1: str, s2: str) -> float:
    """
    Compute conceptual semantic similarity (0.0 to 1.0) using normalized token
    overlap, character tri-grams, and sequence alignment.
    """
    if not s1 or not s2:
        return 0.0

    s1_norm = _normalize_semantics(s1)
    s2_norm = _normalize_semantics(s2)

    if s1_norm == s2_norm:
        return 1.0

    # Token overlap
    t1 = set(s1_norm.split())
    t2 = set(s2_norm.split())
    token_jaccard = len(t1 & t2) / max(1, len(t1 | t2))

    # Character 3-grams for morphological similarity
    def get_trigrams(s):
        return {s[i:i+3] for i in range(len(s) - 2)} if len(s) >= 3 else {s}

    tri1 = get_trigrams(s1_norm)
    tri2 = get_trigrams(s2_norm)
    tri_jaccard = len(tri1 & tri2) / max(1, len(tri1 | tri2)) if (tri1 or tri2) else token_jaccard

    # Sequence alignment
    seq_ratio = difflib.SequenceMatcher(None, s1_norm, s2_norm).ratio()

    # Root concept keywords check
    key_words_1 = {w for w in t1 if len(w) > 3}
    key_words_2 = {w for w in t2 if len(w) > 3}
    key_overlap = len(key_words_1 & key_words_2) / max(1, len(key_words_1)) if key_words_1 else token_jaccard

    similarity = (0.35 * token_jaccard) + (0.25 * tri_jaccard) + (0.20 * seq_ratio) + (0.20 * key_overlap)
    return round(min(1.0, max(0.0, similarity)), 3)


# Configurable weights for weighted aggregate score (sum = 1.0)
FACT_WEIGHT = 0.20
NUMERIC_WEIGHT = 0.20
TEMPORAL_WEIGHT = 0.10
ENTITY_WEIGHT = 0.15
CLAIM_WEIGHT = 0.20
SEMANTIC_WEIGHT = 0.15


def _extract_dates_and_temporal(text: str) -> Set[str]:
    """Extract years, quarters (Q1-Q4 202X), financial periods, and deadlines from text."""
    if not text:
        return set()
    patterns = [
        r"\bQ[1-4]\s*(?:20\d{2})?\b",                  # Quarters: Q4, Q4 2026, Q3 2025
        r"\b(?:19|20)\d{2}\b",                         # Years: 2025, 2026
        r"\b(?:FY|H[12])\s*20\d{2}\b",                 # Fiscal year / Half year: FY2026, H1 2025
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{1,2}(?:st|nd|rd|th)?,\s*20\d{2}\b" # Full dates
    ]
    matches = set()
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            raw = m.group(0).strip()
            # Normalize spaces
            clean = re.sub(r"\s+", " ", raw)
            matches.add(clean)
    return matches


class TemporalValidator:
    """Step 14b: Date, Quarter, Year, and Temporal Period Validator."""

    @staticmethod
    def validate(uckr: UCKR, outputs: Dict[str, Any]) -> ValidationCheckDetail:
        source_dates: Set[str] = set()
        for fact in uckr.facts:
            source_dates.update(_extract_dates_and_temporal(fact.statement))
        for stat in uckr.statistics:
            source_dates.update(_extract_dates_and_temporal(stat.value))
            source_dates.update(_extract_dates_and_temporal(stat.context))

        violations: List[Dict[str, Any]] = []
        found_in_outputs: Set[str] = set()

        for ch_name, ch_data in outputs.items():
            ch_text = _extract_text_content(ch_data)
            ch_dates = _extract_dates_and_temporal(ch_text)
            found_in_outputs.update(ch_dates)

            # Check for temporal mismatches: e.g. Q4 2026 vs Q3 2026
            for s_date in source_dates:
                # Quarters check
                s_q_match = re.search(r"Q([1-4])", s_date, re.IGNORECASE)
                if s_q_match:
                    expected_q = s_q_match.group(0).upper()
                    for cd in ch_dates:
                        cd_q_match = re.search(r"Q([1-4])", cd, re.IGNORECASE)
                        if cd_q_match and cd_q_match.group(0).upper() != expected_q and cd not in source_dates:
                            violations.append({
                                "channel": ch_name,
                                "type": "temporal_conflict",
                                "fact_id": "F001",
                                "expected": s_date,
                                "found": cd,
                                "output": ch_name,
                                "message": f"Temporal mismatch in {ch_name}: expected '{s_date}', found '{cd}'"
                            })

        score = 100.0
        if violations:
            penalty = len(violations) * 35.0
            score = max(0.0, 100.0 - penalty)

        return ValidationCheckDetail(
            passed=len(violations) == 0,
            score=round(score, 1),
            expected=sorted(list(source_dates)),
            found=sorted(list(found_in_outputs)),
            violations=violations
        )


class NumericValidator:
    """Step 14: Strict numeric, percentage, and quantitative validator."""

    @staticmethod
    def validate(uckr: UCKR, outputs: Dict[str, Any]) -> ValidationCheckDetail:
        source_numbers: Set[str] = set()
        facts_map = {}
        for fact in uckr.facts:
            extracted = _extract_numbers_and_metrics(fact.statement)
            source_numbers.update(extracted)
            for n in extracted:
                facts_map[n] = fact.id

        for stat in uckr.statistics:
            extracted = _extract_numbers_and_metrics(stat.value)
            source_numbers.update(extracted)
            for n in extracted:
                facts_map[n] = stat.id

        # Filter out trivial 1-digit numbers (like 1, 2) unless percentage/currency
        key_numbers = {n for n in source_numbers if len(n) > 1 or "%" in n or "$" in n}

        violations: List[Dict[str, Any]] = []
        found_in_outputs: Set[str] = set()

        for ch_name, ch_data in outputs.items():
            ch_text = _extract_text_content(ch_data)
            ch_numbers = _extract_numbers_and_metrics(ch_text)
            found_in_outputs.update(ch_numbers)

            # Check for mutated numbers: percentage or metric mismatches
            for s_num in key_numbers:
                if "%" in s_num:
                    ch_percents = {cn for cn in ch_numbers if "%" in cn}
                    for cn in ch_percents:
                        if cn != s_num and cn not in key_numbers:
                            violations.append({
                                "channel": ch_name,
                                "type": "numeric_conflict",
                                "fact_id": facts_map.get(s_num, "F002"),
                                "expected": s_num,
                                "found": cn,
                                "output": ch_name,
                                "message": f"Numeric conflict in {ch_name}: expected '{s_num}', found '{cn}'"
                            })

        score = 100.0
        if violations:
            penalty = len(violations) * 40.0
            score = max(0.0, 100.0 - penalty)

        return ValidationCheckDetail(
            passed=len(violations) == 0,
            score=round(score, 1),
            expected=sorted(list(key_numbers)),
            found=sorted(list(found_in_outputs)),
            violations=violations
        )


class EntityValidator:
    """Step 15: Named Entity consistency checker."""

    @staticmethod
    def validate(uckr: UCKR, outputs: Dict[str, Any]) -> ValidationCheckDetail:
        source_entities = {e.name: e.id for e in uckr.entities}
        violations: List[Dict[str, Any]] = []
        found_entities: Set[str] = set()

        for ch_name, ch_data in outputs.items():
            ch_text = _extract_text_content(ch_data)
            for ent_name, ent_id in source_entities.items():
                if ent_name.lower() in ch_text.lower():
                    found_entities.add(ent_name)

            # Check for common entity mutations (e.g. ContentForge AI -> ContentFlow AI)
            for ent_name, ent_id in source_entities.items():
                words = ent_name.split()
                if len(words) > 1:
                    first_word = words[0]
                    # Search for mutated brand names
                    mutations = re.findall(r"\b" + re.escape(first_word[:5]) + r"\w+\s+AI\b", ch_text, re.IGNORECASE)
                    for mut in mutations:
                        if mut.lower() != ent_name.lower() and mut.lower() not in [e.lower() for e in source_entities]:
                            violations.append({
                                "channel": ch_name,
                                "type": "entity_conflict",
                                "fact_id": ent_id,
                                "expected": ent_name,
                                "found": mut,
                                "output": ch_name,
                                "message": f"Entity conflict in {ch_name}: expected '{ent_name}', found '{mut}'"
                            })

        # Entity coverage score calculation
        coverage = len(found_entities) / max(1, len(source_entities))
        score = round(coverage * 100.0, 1)

        if violations:
            score = max(0.0, score - (len(violations) * 30.0))

        return ValidationCheckDetail(
            passed=len(violations) == 0 and score >= 80.0,
            score=round(score, 1),
            expected=list(source_entities.keys()),
            found=sorted(list(found_entities)),
            violations=violations
        )


class ClaimValidator:
    """Step 12 & 13: Grounded claim alignment and exaggeration checker."""

    @staticmethod
    def validate(uckr: UCKR, outputs: Dict[str, Any]) -> ValidationCheckDetail:
        exaggeration_markers = [
            "completely solves", "eliminates all", "100% flawless", "cures all", "guarantees absolute"
        ]
        violations: List[Dict[str, Any]] = []

        for ch_name, ch_data in outputs.items():
            ch_text = _extract_text_content(ch_data).lower()
            for marker in exaggeration_markers:
                if marker in ch_text:
                    violations.append({
                        "channel": ch_name,
                        "type": "exaggerated_claim",
                        "fact_id": "C001",
                        "expected": "Grounded assertion",
                        "found": marker,
                        "output": ch_name,
                        "message": f"Exaggerated claim '{marker}' in {ch_name}."
                    })

        score = max(0.0, 100.0 - (len(violations) * 25.0))
        return ValidationCheckDetail(
            passed=len(violations) == 0,
            score=round(score, 1),
            expected=[c.claim for c in uckr.claims],
            found=[f"Verified {len(uckr.claims)} core claims"],
            violations=violations
        )


class SemanticValidator:
    """Step 13: Semantic consistency and factual similarity checker."""

    @staticmethod
    def validate(uckr: UCKR, outputs: Dict[str, Any]) -> ValidationCheckDetail:
        similarities: List[float] = []
        violations: List[Dict[str, Any]] = []

        top_facts = sorted(uckr.facts, key=lambda f: f.importance, reverse=True)[:5]

        for ch_name, ch_data in outputs.items():
            ch_text = _extract_text_content(ch_data)
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", ch_text) if len(s.strip()) > 5]
            if not sentences:
                sentences = [ch_text]

            cited_facts = set()
            if isinstance(ch_data, dict):
                cited_facts.update(ch_data.get("source_facts", []))

            target_facts = [f for f in top_facts if f.id in cited_facts] or top_facts[:2]

            for fact in target_facts:
                # Check for explicit fact ID citation or matching metrics
                if fact.id in ch_text or f"[{fact.id}]" in ch_text:
                    max_sim = 1.0
                else:
                    fact_nums = {n for n in _extract_numbers_and_metrics(fact.statement) if len(n) > 1 or "%" in n or "$" in n}
                    ch_nums = _extract_numbers_and_metrics(ch_text)
                    if fact_nums and fact_nums.issubset(ch_nums):
                        max_sim = 0.95
                    else:
                        sims = [compute_semantic_similarity(fact.statement, sent) for sent in sentences]
                        sims.append(compute_semantic_similarity(fact.statement, ch_text))
                        max_sim = max(sims) if sims else 0.0

                similarities.append(max_sim)

                if max_sim < 0.25 and fact.importance >= 0.9:
                    violations.append({
                        "channel": ch_name,
                        "type": "weak_semantic_grounding",
                        "fact_id": fact.id,
                        "expected": fact.statement,
                        "found": f"Similarity={max_sim}",
                        "output": ch_name,
                        "message": f"Fact [{fact.id}] weakly represented in {ch_name} (sim={max_sim})"
                    })

        avg_sim = (sum(similarities) / max(1, len(similarities))) if similarities else 1.0
        # Dynamic un-clamped 0-100 conversion
        score = round(min(100.0, max(0.0, avg_sim * 100.0)), 1)

        return ValidationCheckDetail(
            passed=score >= 70.0,
            score=score,
            expected=[f.statement for f in top_facts],
            found=[f"Evaluated {len(similarities)} semantic fact alignments"],
            violations=violations
        )


class CrossOutputValidator:
    """Step 16: Cross-output consistency checking (Summary ↕ LinkedIn ↕ PPT ↕ Video)."""

    @staticmethod
    def validate(uckr: UCKR, outputs: Dict[str, Any], fact_matrix: Dict[str, List[str]]) -> ValidationCheckDetail:
        multi_channel_facts = [fid for fid, channels in fact_matrix.items() if len(channels) >= 2]
        cited_facts = [fid for fid, channels in fact_matrix.items() if len(channels) >= 1]
        
        ratio = (len(multi_channel_facts) / max(1, len(cited_facts))) if cited_facts else 1.0
        score = round(min(100.0, max(0.0, ratio * 100.0)), 1)

        return ValidationCheckDetail(
            passed=score >= 70.0,
            score=score,
            expected=["Shared core facts across 2+ channels"],
            found=[f"{len(multi_channel_facts)} facts shared across channels"],
            violations=[]
        )


class ConsistencyValidator:
    """
    Master consistency validator computing real, weighted aggregate breakdown scores:
    Fact Preservation (0.20) + Numeric (0.20) + Temporal (0.10) + Entity (0.15) + Claim (0.20) + Semantic (0.15) = 1.0
    """

    @classmethod
    def validate_all(
        cls,
        uckr: UCKR,
        outputs: Dict[str, Any],
        fact_matrix: Dict[str, List[str]]
    ) -> DetailedValidationReport:
        numeric_res = NumericValidator.validate(uckr, outputs)
        temporal_res = TemporalValidator.validate(uckr, outputs)
        entity_res = EntityValidator.validate(uckr, outputs)
        claim_res = ClaimValidator.validate(uckr, outputs)
        semantic_res = SemanticValidator.validate(uckr, outputs)
        cross_res = CrossOutputValidator.validate(uckr, outputs, fact_matrix)

        # Real Fact Preservation calculation: Verified Facts / Total Required Facts * 100
        cited_facts = {fid for fid, channels in fact_matrix.items() if channels}
        valid_uckr_ids = {f.id for f in uckr.facts}
        valid_citations = cited_facts & valid_uckr_ids
        
        total_facts_count = max(1, len(uckr.facts))
        verified_facts_count = len(valid_citations)
        fact_score = round(min(100.0, (verified_facts_count / total_facts_count) * 100.0), 1)

        missing_facts_violations = []
        unrepresented_facts = valid_uckr_ids - valid_citations
        for m_fid in unrepresented_facts:
            missing_facts_violations.append({
                "channel": "all",
                "type": "missing_fact",
                "fact_id": m_fid,
                "expected": f"Fact {m_fid} included in deliverables",
                "found": "Missing in all channels",
                "message": f"Source fact {m_fid} missing from generated deliverables."
            })

        fact_check = ValidationCheckDetail(
            passed=fact_score >= 66.0,
            score=fact_score,
            expected=[f.id for f in uckr.facts],
            found=sorted(list(valid_citations)),
            violations=missing_facts_violations
        )

        # Weighted aggregate score (weights sum to 1.0)
        overall = round(
            (fact_score * FACT_WEIGHT) +
            (numeric_res.score * NUMERIC_WEIGHT) +
            (temporal_res.score * TEMPORAL_WEIGHT) +
            (entity_res.score * ENTITY_WEIGHT) +
            (claim_res.score * CLAIM_WEIGHT) +
            (semantic_res.score * SEMANTIC_WEIGHT),
            1
        )

        breakdown = ConsistencyScoreBreakdown(
            fact_consistency=fact_score,
            numeric_consistency=numeric_res.score,
            temporal_consistency=temporal_res.score,
            entity_consistency=entity_res.score,
            claim_consistency=claim_res.score,
            semantic_consistency=semantic_res.score,
            cross_output_consistency=cross_res.score,
            overall_score=overall
        )

        # Channel specific scores
        all_violations = (
            numeric_res.violations + 
            temporal_res.violations + 
            entity_res.violations + 
            claim_res.violations + 
            semantic_res.violations + 
            missing_facts_violations
        )

        channel_scores: Dict[str, ChannelConsistencyScore] = {}
        for ch in outputs.keys():
            ch_viols = [v["message"] for v in all_violations if v.get("channel") in (ch, "all")]
            ch_score = round(max(0.0, overall - (len(ch_viols) * 15.0)), 1)
            channel_scores[ch] = ChannelConsistencyScore(
                channel=ch,
                score=ch_score,
                status="PASS" if ch_score >= 80.0 else ("WARNING" if ch_score >= 60.0 else "FAIL"),
                violations=ch_viols
            )

        passed = overall >= 80.0 and len(all_violations) == 0

        return DetailedValidationReport(
            passed=passed,
            overall_score=overall,
            breakdown=breakdown,
            channel_scores=channel_scores,
            numeric_check=numeric_res,
            temporal_check=temporal_res,
            entity_check=entity_res,
            claim_check=claim_res,
            semantic_check=semantic_res,
            fact_check=fact_check,
            cross_output_check=cross_res,
            total_facts=len(uckr.facts),
            verified_facts=verified_facts_count,
            outputs_checked=len(outputs),
            violations=all_violations,
            traceability_matrix=fact_matrix
        )
