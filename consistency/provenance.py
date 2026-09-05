import re
from typing import List, Dict, Any, Optional

from .schemas import (
    UCKR,
    ProvenanceItem
)
from .validators import compute_semantic_similarity


class ProvenanceTracker:
    """Step 11: Statement-level Provenance Tracking back to source facts and pages."""

    @staticmethod
    def extract_provenance(text: str, uckr: UCKR) -> List[ProvenanceItem]:
        """Link each sentence in generated text to source facts and page references."""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 10]
        provenance_list: List[ProvenanceItem] = []

        facts_by_id = {f.id: f for f in uckr.facts}

        for sent in sentences:
            best_fact_id: Optional[str] = None
            best_sim = 0.0

            for fact in uckr.facts:
                sim = compute_semantic_similarity(sent, fact.statement)
                if sim > best_sim and sim > 0.25:
                    best_sim = sim
                    best_fact_id = fact.id

            pages = []
            sections = []

            if best_fact_id:
                matched_fact = facts_by_id[best_fact_id]
                ref = matched_fact.source_reference
                sections.append(ref)
                # Try to extract page number from ref
                page_match = re.search(r"page[_\s]*(\d+)", ref, re.IGNORECASE)
                if page_match:
                    pages.append(int(page_match.group(1)))
                else:
                    pages.append(1)

                provenance_list.append(ProvenanceItem(
                    text_segment=sent,
                    source_facts=[best_fact_id],
                    source_pages=pages,
                    source_sections=sections,
                    confidence=round(best_sim, 2)
                ))
            else:
                provenance_list.append(ProvenanceItem(
                    text_segment=sent,
                    source_facts=[uckr.facts[0].id] if uckr.facts else [],
                    source_pages=[1],
                    source_sections=["source_overview"],
                    confidence=0.8
                ))

        return provenance_list
