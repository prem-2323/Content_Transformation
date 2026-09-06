import re
import logging
from typing import Dict, List, Any, Optional, Set
from .schemas import FactItem, UCKR, ConsistencyAuditResult

logger = logging.getLogger(__name__)


class FactRegistry:
    """
    Central Fact Registry for Unified Content Knowledge Representation (UCKR).
    Stores, indexes, validates, queries, and audits atomic facts.
    """

    def __init__(self, source_id: Optional[str] = None):
        self.source_id = source_id or "DEFAULT"
        self._facts: Dict[str, FactItem] = {}

    @classmethod
    def from_uckr(cls, uckr: UCKR) -> "FactRegistry":
        registry = cls(source_id=uckr.document.id)
        for fact in uckr.facts:
            registry.register_fact(fact)
        return registry

    def register_fact(self, fact: FactItem) -> None:
        """Register a single fact item into the central registry."""
        self._facts[fact.id] = fact

    def get_fact(self, fact_id: str) -> Optional[FactItem]:
        """Retrieve a fact by its ID."""
        return self._facts.get(fact_id)

    def list_facts(self) -> List[FactItem]:
        """Return all registered facts in order."""
        return list(self._facts.values())

    def search_facts(self, query: str) -> List[FactItem]:
        """Search facts by substring match in statement or category."""
        q_lower = query.lower()
        return [
            f for f in self._facts.values()
            if q_lower in f.statement.lower() or (f.category and q_lower in f.category.lower())
        ]

    def get_critical_facts(self, min_importance: float = 0.85) -> List[FactItem]:
        """Retrieve high importance facts that must be preserved across deliverables."""
        return [f for f in self._facts.values() if f.importance >= min_importance]

    def validate_fact_ids(self, cited_fact_ids: List[str]) -> Dict[str, Any]:
        """Check if cited fact IDs exist in the registry and detect hallucinations."""
        valid_ids: List[str] = []
        invalid_ids: List[str] = []

        for fid in cited_fact_ids:
            if fid in self._facts:
                valid_ids.append(fid)
            else:
                invalid_ids.append(fid)

        return {
            "valid": valid_ids,
            "invalid": invalid_ids,
            "is_valid": len(invalid_ids) == 0
        }

    def audit_deliverables(self, outputs: Dict[str, Any]) -> ConsistencyAuditResult:
        """
        Perform a comprehensive cross-deliverable consistency audit.
        Constructs the Fact Traceability Matrix, checks fact coverage,
        detects hallucinated fact citations, and scores cross-channel alignment.
        """
        total_facts = len(self._facts)
        traceability_matrix: Dict[str, List[str]] = {fid: [] for fid in self._facts.keys()}
        all_cited_ids: Set[str] = set()
        invalid_ids: Set[str] = set()

        def _record_citation(fid: str, channel_label: str):
            if fid in self._facts:
                all_cited_ids.add(fid)
                if channel_label not in traceability_matrix[fid]:
                    traceability_matrix[fid].append(channel_label)
            else:
                invalid_ids.add(fid)

        # Universal citation extractor helper
        def _extract_citations_from_value(val: Any) -> Set[str]:
            c_set = set()
            if isinstance(val, str):
                for match in re.findall(r"\b(F\d+)\b", val):
                    c_set.add(match)
            elif isinstance(val, list):
                for item in val:
                    c_set.update(_extract_citations_from_value(item))
            elif isinstance(val, dict):
                for k, v in val.items():
                    c_set.update(_extract_citations_from_value(v))
            return c_set

        # Inspect all outputs dynamically
        for ch_key, ch_val in outputs.items():
            found_ids = _extract_citations_from_value(ch_val)
            for fid in found_ids:
                _record_citation(fid, ch_key)

        cited_count = len(all_cited_ids)
        coverage_pct = round((cited_count / max(1, total_facts)) * 100, 2)

        # Calculate citation integrity (penalize invalid fact references)
        total_citations_attempted = cited_count + len(invalid_ids)
        citation_integrity = 1.0
        if total_citations_attempted > 0:
            citation_integrity = round(cited_count / total_citations_attempted, 3)

        # Unreferenced critical facts (importance >= 0.85)
        unreferenced_critical = [
            f for f in self.get_critical_facts(0.85)
            if f.id not in all_cited_ids
        ]

        # Cross channel consistency score (ratio of facts appearing in >= 2 deliverables)
        multi_channel_facts = [fid for fid, channels in traceability_matrix.items() if len(channels) >= 2]
        cross_channel_score = round(len(multi_channel_facts) / max(1, cited_count), 3) if cited_count else 0.0

        return ConsistencyAuditResult(
            total_registered_facts=total_facts,
            total_cited_facts=cited_count,
            fact_coverage_percentage=coverage_pct,
            citation_integrity_score=citation_integrity,
            invalid_fact_citations=sorted(list(invalid_ids)),
            unreferenced_critical_facts=unreferenced_critical,
            traceability_matrix=traceability_matrix,
            cross_channel_consistency_score=cross_channel_score
        )


# Global registry store for persistent lookup by source_id
_REGISTRY_STORE: Dict[str, FactRegistry] = {}


def get_or_create_registry(uckr: UCKR) -> FactRegistry:
    """Get existing registry or register new one from UCKR."""
    source_id = uckr.document.id
    registry = FactRegistry.from_uckr(uckr)
    _REGISTRY_STORE[source_id] = registry
    return registry


def get_registry(source_id: str) -> Optional[FactRegistry]:
    """Retrieve fact registry by source_id."""
    return _REGISTRY_STORE.get(source_id)
