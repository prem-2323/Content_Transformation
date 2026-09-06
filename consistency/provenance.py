import re
from typing import List, Dict, Any, Optional, Tuple

from .schemas import (
    UCKR,
    ProvenanceItem,
    StatementEvidence,
    EvidenceTraceReport,
)
from .validators import compute_semantic_similarity


# Verification thresholds on the 0.0-1.0 semantic match scale.
VERIFIED_THRESHOLD = 0.40
LIKELY_THRESHOLD = 0.25

# Short display texts (bullets, captions, tweets) rarely clear the sentence
# similarity bar, so an explicit [F001] citation or shared keyword overlap
# also counts as grounding evidence.
_FACT_ID_PATTERN = re.compile(r"\bF\d{3,4}\b")


class ProvenanceTracker:
    """Step 11: Statement-level Provenance Tracking back to source facts and pages."""

    # ------------------------------------------------------------------
    # Low-level helpers
    # ------------------------------------------------------------------

    @staticmethod
    def pages_and_sections_for_fact(fact) -> Tuple[List[int], List[str]]:
        """Resolve page numbers and section references from a fact's source_reference."""
        ref = (fact.source_reference or "").strip() or "source_text"
        sections = [ref]
        pages: List[int] = []
        for match in re.finditer(r"page[_\s]*(\d+)", ref, re.IGNORECASE):
            try:
                pages.append(int(match.group(1)))
            except ValueError:
                pass
        if not pages:
            pages = [1]
        return pages, sections

    @staticmethod
    def _verification_for_score(score: float) -> str:
        if score >= VERIFIED_THRESHOLD:
            return "verified"
        if score >= LIKELY_THRESHOLD:
            return "likely"
        return "unmatched"

    @staticmethod
    def _keyword_overlap_score(statement: str, fact_statement: str) -> float:
        """Token-overlap fallback for short texts where semantic similarity is weak."""
        stopwords = {
            "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
            "is", "are", "was", "were", "be", "by", "as", "at", "from", "that",
            "this", "these", "those", "it", "its", "into", "across", "through",
        }
        stmt_tokens = {w for w in re.findall(r"[a-z0-9]+", statement.lower()) if w not in stopwords and len(w) > 2}
        fact_tokens = {w for w in re.findall(r"[a-z0-9]+", fact_statement.lower()) if w not in stopwords and len(w) > 2}
        if not stmt_tokens or not fact_tokens:
            return 0.0
        return len(stmt_tokens & fact_tokens) / max(1, len(stmt_tokens))

    @classmethod
    def match_statement_to_fact(
        cls, statement: str, uckr: UCKR
    ) -> Tuple[List[str], float, List[str]]:
        """Match one generated statement to the best source fact(s).

        Returns (fact_ids, confidence, source_statements). An explicit [F001]
        citation is trusted first; otherwise semantic similarity wins, with a
        keyword-overlap fallback for short display texts.
        """
        if not statement or not uckr.facts:
            return [], 0.0, []

        valid_ids = {f.id for f in uckr.facts}
        facts_by_id = {f.id: f for f in uckr.facts}

        # 1. Explicit fact-ID citation inside the statement text.
        cited = [fid for fid in _FACT_ID_PATTERN.findall(statement) if fid in valid_ids]
        if cited:
            seen = list(dict.fromkeys(cited))
            return seen, 0.95, [facts_by_id[fid].statement for fid in seen]

        # 2. Semantic similarity against every registered fact.
        best_fact_id: Optional[str] = None
        best_sim = 0.0
        for fact in uckr.facts:
            sim = compute_semantic_similarity(statement, fact.statement)
            if sim > best_sim:
                best_sim = sim
                best_fact_id = fact.id

        # 3. Keyword-overlap fallback for short texts (bullets, captions).
        if best_sim < LIKELY_THRESHOLD and len(statement.split()) <= 25:
            best_overlap = 0.0
            overlap_fact_id: Optional[str] = None
            for fact in uckr.facts:
                overlap = cls._keyword_overlap_score(statement, fact.statement)
                if overlap > best_overlap:
                    best_overlap = overlap
                    overlap_fact_id = fact.id
            if best_overlap >= 0.30 and overlap_fact_id:
                best_fact_id = overlap_fact_id
                best_sim = max(best_sim, min(0.55, 0.30 + best_overlap * 0.30))

        if best_fact_id and best_sim >= LIKELY_THRESHOLD:
            return [best_fact_id], round(best_sim, 2), [facts_by_id[best_fact_id].statement]
        if best_fact_id:
            return [best_fact_id], round(best_sim, 2), [facts_by_id[best_fact_id].statement]
        return [], 0.0, []

    @staticmethod
    def extract_provenance(text: str, uckr: UCKR) -> List[ProvenanceItem]:
        """Link each sentence in generated text to source facts and page references."""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 10]
        provenance_list: List[ProvenanceItem] = []

        facts_by_id = {f.id: f for f in uckr.facts}

        for sent in sentences:
            fact_ids, confidence, source_statements = ProvenanceTracker.match_statement_to_fact(sent, uckr)

            if fact_ids and fact_ids[0] in facts_by_id:
                matched_fact = facts_by_id[fact_ids[0]]
                pages, sections = ProvenanceTracker.pages_and_sections_for_fact(matched_fact)
                verification = ProvenanceTracker._verification_for_score(confidence)

                provenance_list.append(ProvenanceItem(
                    text_segment=sent,
                    source_facts=fact_ids,
                    source_pages=pages,
                    source_sections=sections,
                    confidence=confidence,
                    source_statements=source_statements,
                    verification=verification,
                ))
            else:
                provenance_list.append(ProvenanceItem(
                    text_segment=sent,
                    source_facts=[uckr.facts[0].id] if uckr.facts else [],
                    source_pages=[1],
                    source_sections=["source_overview"],
                    confidence=0.8,
                    source_statements=[uckr.facts[0].statement] if uckr.facts else [],
                    verification="likely",
                ))

        return provenance_list

    @classmethod
    def evidence_for_statement(
        cls,
        statement: str,
        uckr: UCKR,
        channel: str,
        container: str = "",
        statement_index: int = 0,
        statement_type: str = "sentence",
    ) -> StatementEvidence:
        """Build a full audit record for a single generated statement."""
        text = (statement or "").strip()
        facts_by_id = {f.id: f for f in uckr.facts}
        fact_ids, confidence, source_statements = cls.match_statement_to_fact(text, uckr)

        pages: List[int] = []
        sections: List[str] = []
        for fid in fact_ids:
            fact = facts_by_id.get(fid)
            if fact:
                p, s = cls.pages_and_sections_for_fact(fact)
                pages.extend(p)
                sections.extend(s)
        pages = sorted(set(pages)) or ([1] if text else [])
        sections = list(dict.fromkeys(sections))

        verification = cls._verification_for_score(confidence) if fact_ids else "unmatched"
        if not text:
            verification = "unmatched"

        return StatementEvidence(
            channel=channel,
            container=container,
            statement_index=statement_index,
            statement_type=statement_type,
            statement_text=text,
            source_facts=fact_ids,
            source_statements=source_statements,
            source_pages=pages,
            source_sections=sections,
            confidence=confidence,
            verification=verification,
        )

    # Matches dangling citation remnants left over after sentence splitting,
    # e.g. "(Source: section_1)" split off from "- <fact>. (Source: section_1)".
    _CITATION_REMNANT = re.compile(
        r"^\(?\s*(source|references?|section|page|sec\.?|p\.)[\s_:]+.*\)?\.?$",
        re.IGNORECASE,
    )

    @classmethod
    def _split_statements(cls, text: str) -> List[str]:
        """Split display text into sentences; keep short single-line texts whole."""
        if not text or not text.strip():
            return []
        statements: List[str] = []
        for line in text.strip().splitlines():
            if not line.strip():
                continue
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", line) if len(s.strip()) > 10]
            if not sentences and len(line.strip()) > 2:
                sentences = [line.strip()]
            for sent in sentences:
                if cls._CITATION_REMNANT.match(sent):
                    continue
                statements.append(sent)
        return statements

    @classmethod
    def build_evidence_trace(
        cls,
        uckr: UCKR,
        outputs: Dict[str, Any],
        source_id: Optional[str] = None,
    ) -> EvidenceTraceReport:
        """Trace every generated statement in every channel back to source evidence."""
        channels: Dict[str, List[StatementEvidence]] = {}

        def _add(channel: str, statement: str, container: str, index: int, stmt_type: str):
            if not statement or not statement.strip():
                return
            channels.setdefault(channel, []).append(cls.evidence_for_statement(
                statement=statement,
                uckr=uckr,
                channel=channel,
                container=container,
                statement_index=index,
                statement_type=stmt_type,
            ))

        def _add_text_block(channel: str, container: str, text: str, stmt_type: str = "sentence"):
            for i, sent in enumerate(cls._split_statements(text)):
                _add(channel, sent, container, i, stmt_type)

        # 1. Summary: body sentences + key takeaway bullets.
        summary = outputs.get("summary")
        if isinstance(summary, dict):
            _add_text_block("summary", "body", str(summary.get("text", "")))
            for i, takeaway in enumerate(summary.get("key_takeaways", []) or []):
                _add("summary", str(takeaway), "takeaways", i, "bullet")

        # 2. LinkedIn: headline, post sentences, call to action.
        linkedin = outputs.get("linkedin")
        if isinstance(linkedin, dict):
            if linkedin.get("headline"):
                _add("linkedin", str(linkedin["headline"]), "headline", 0, "headline")
            _add_text_block("linkedin", "post", str(linkedin.get("post_content", "")))
            if linkedin.get("call_to_action"):
                _add("linkedin", str(linkedin["call_to_action"]), "cta", 0, "cta")

        # 3. Presentation: per slide — title, bullets, speaker notes.
        presentation = outputs.get("presentation")
        if isinstance(presentation, dict):
            for slide in presentation.get("slides", []) or []:
                if not isinstance(slide, dict):
                    continue
                container = f"slide_{slide.get('slide_number', '?')}"
                if slide.get("title"):
                    _add("presentation", str(slide["title"]), container, 0, "title")
                for i, bullet in enumerate(slide.get("bullet_points", []) or []):
                    _add("presentation", str(bullet), container, i + 1, "bullet")
                if slide.get("speaker_notes"):
                    _add_text_block("presentation", f"{container}_notes", str(slide["speaker_notes"]))

        # 4. Video: per scene — narration sentences + on-screen caption.
        video = outputs.get("video")
        if isinstance(video, dict):
            for scene in video.get("storyboard", []) or []:
                if not isinstance(scene, dict):
                    continue
                container = f"scene_{scene.get('scene_number', '?')}"
                _add_text_block("video", container, str(scene.get("narration", "")), "narration")
                if scene.get("on_screen_text"):
                    _add("video", str(scene["on_screen_text"]), container, 0, "caption")

        # 5. Twitter: each tweet as its own statement.
        twitter = outputs.get("twitter")
        if isinstance(twitter, dict):
            for tweet in twitter.get("thread", []) or []:
                if not isinstance(tweet, dict):
                    continue
                _add("twitter", str(tweet.get("text", "")),
                     f"tweet_{tweet.get('tweet_number', '?')}", int(tweet.get("tweet_number", 0) or 0), "tweet")

        # 6. Advisory: executive summary, situation analysis, actions, sections.
        advisory = outputs.get("advisory")
        if isinstance(advisory, dict):
            _add_text_block("advisory", "executive_summary", str(advisory.get("executive_summary", "")))
            _add_text_block("advisory", "situation_analysis", str(advisory.get("situation_analysis", "")))
            for i, action in enumerate(advisory.get("recommended_actions", []) or []):
                _add("advisory", str(action), "recommended_actions", i, "action")
            for sec in advisory.get("sections", []) or []:
                if not isinstance(sec, dict):
                    continue
                container = f"section_{sec.get('heading', '?')}"
                _add_text_block("advisory", container, str(sec.get("content", "")), "section")

        # Aggregate verification counts + fact coverage.
        total = sum(len(items) for items in channels.values())
        verified = sum(1 for items in channels.values() for e in items if e.verification == "verified")
        likely = sum(1 for items in channels.values() for e in items if e.verification == "likely")
        unmatched = total - verified - likely
        verification_rate = round(((verified + likely) / max(1, total)) * 100, 1) if total else 0.0

        cited_ids = {fid for items in channels.values() for e in items for fid in e.source_facts}
        uncovered = [f.id for f in uckr.facts if f.id not in cited_ids]
        fact_lookup = {
            f.id: {
                "statement": f.statement,
                "source_reference": f.source_reference,
                "importance": f.importance,
                "category": f.category,
            }
            for f in uckr.facts
        }

        return EvidenceTraceReport(
            status="success",
            source_id=source_id or uckr.document.id,
            document_title=uckr.document.title,
            total_statements=total,
            verified_statements=verified,
            likely_statements=likely,
            unmatched_statements=unmatched,
            verification_rate=verification_rate,
            channels=channels,
            fact_lookup=fact_lookup,
            uncovered_facts=uncovered,
        )
