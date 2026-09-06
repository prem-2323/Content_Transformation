import copy
import logging
from typing import Dict, List, Any, Optional, Tuple

from .schemas import (
    UCKR,
    FactItem,
    OutputGenerationConfig,
    UCKRDiff,
    SelectiveRegenerationResponse
)
from .generators import (
    SummaryGenerator,
    LinkedInGenerator,
    PresentationGenerator,
    VideoGenerator,
    TwitterGenerator,
    AdvisoryGenerator
)
from .validators import ConsistencyValidator
from .fact_registry import get_or_create_registry

logger = logging.getLogger(__name__)


class UCKRVersionManager:
    """Step 19: UCKR Versioning and Incremental Selective Regeneration."""

    def __init__(self):
        self._versions: Dict[str, Dict[int, UCKR]] = {}

    def save_version(self, uckr: UCKR) -> int:
        """Store UCKR version in document history."""
        doc_id = uckr.document.id
        if doc_id not in self._versions:
            self._versions[doc_id] = {}

        v_num = uckr.document.version or len(self._versions[doc_id]) + 1
        uckr.document.version = v_num
        self._versions[doc_id][v_num] = copy.deepcopy(uckr)
        return v_num

    def get_version(self, doc_id: str, version: int) -> Optional[UCKR]:
        """Retrieve historical UCKR by version number."""
        return self._versions.get(doc_id, {}).get(version)

    @staticmethod
    def diff_uckr(v1: UCKR, v2: UCKR) -> UCKRDiff:
        """Compute atomic fact difference between two UCKR snapshots."""
        v1_facts = {f.id: f for f in v1.facts}
        v2_facts = {f.id: f for f in v2.facts}

        added = [f for fid, f in v2_facts.items() if fid not in v1_facts]
        deleted = [fid for fid in v1_facts.keys() if fid not in v2_facts]
        unchanged = []
        changed = []
        affected_ids = []

        for fid, f2 in v2_facts.items():
            if fid in v1_facts:
                f1 = v1_facts[fid]
                if f1.statement != f2.statement or f1.importance != f2.importance:
                    changed.append({
                        "id": fid,
                        "old_statement": f1.statement,
                        "new_statement": f2.statement,
                        "old_importance": f1.importance,
                        "new_importance": f2.importance
                    })
                    affected_ids.append(fid)
                else:
                    unchanged.append(fid)

        affected_ids.extend([f.id for f in added])
        affected_ids.extend(deleted)

        return UCKRDiff(
            old_version=v1.document.version,
            new_version=v2.document.version,
            added_facts=added,
            changed_facts=changed,
            deleted_facts=deleted,
            unchanged_facts=unchanged,
            affected_fact_ids=sorted(list(set(affected_ids)))
        )

    @classmethod
    def selective_regenerate(
        cls,
        uckr_v2: UCKR,
        diff: UCKRDiff,
        previous_outputs: Dict[str, Any],
        config: Optional[OutputGenerationConfig] = None,
        use_llm: bool = True
    ) -> SelectiveRegenerationResponse:
        """
        Regenerate ONLY the channels and sections affected by changed/added/deleted facts.
        Untouched outputs remain intact without redundant regeneration.
        """
        cfg = config or OutputGenerationConfig()
        updated_outputs = copy.deepcopy(previous_outputs)
        affected_channels: List[str] = []
        affected_set = set(diff.affected_fact_ids)

        registry = get_or_create_registry(uckr_v2)

        # Check each channel
        for ch_name, ch_data in previous_outputs.items():
            ch_used_facts = set()
            if isinstance(ch_data, dict):
                ch_used_facts.update(ch_data.get("source_facts", []))
                for s in ch_data.get("slides", []):
                    ch_used_facts.update(s.get("source_facts", []))
                for sc in ch_data.get("storyboard", []):
                    ch_used_facts.update(sc.get("source_facts", []))

            # If any fact in this channel was affected, regenerate ONLY this channel
            if ch_used_facts & affected_set or not ch_used_facts:
                affected_channels.append(ch_name)
                if ch_name == "summary":
                    updated_outputs["summary"] = SummaryGenerator.generate(uckr_v2, cfg, use_llm=use_llm).model_dump()
                elif ch_name == "linkedin":
                    updated_outputs["linkedin"] = LinkedInGenerator.generate(uckr_v2, cfg, use_llm=use_llm).model_dump()
                elif ch_name == "presentation":
                    updated_outputs["presentation"] = PresentationGenerator.generate(uckr_v2, cfg, use_llm=use_llm).model_dump()
                elif ch_name == "video":
                    updated_outputs["video"] = VideoGenerator.generate(uckr_v2, cfg, use_llm=use_llm).model_dump()
                elif ch_name == "twitter":
                    updated_outputs["twitter"] = TwitterGenerator.generate(uckr_v2, cfg).model_dump()
                elif ch_name == "advisory":
                    updated_outputs["advisory"] = AdvisoryGenerator.generate(uckr_v2, cfg).model_dump()

        audit = registry.audit_deliverables(updated_outputs)
        report = ConsistencyValidator.validate_all(uckr_v2, updated_outputs, audit.traceability_matrix)

        return SelectiveRegenerationResponse(
            diff=diff,
            affected_channels=affected_channels,
            affected_fact_ids=diff.affected_fact_ids,
            updated_outputs=updated_outputs,
            new_consistency_score=report.overall_score
        )


_VERSION_MANAGER = UCKRVersionManager()


def get_version_manager() -> UCKRVersionManager:
    return _VERSION_MANAGER
