import re
import json
import logging
from typing import Dict, Any, List, Tuple

from text.qwen_service import generate_with_qwen, QwenServiceError
from .schemas import (
    UCKR,
    DetailedValidationReport,
    AutoRepairResult,
    RepairAttempt
)
from .validators import ConsistencyValidator

logger = logging.getLogger(__name__)

REPAIR_PROMPT = """
You are a precision consistency editor.
A generated statement has a factual / numeric / entity mismatch compared to the source facts.

SOURCE FACT [{fact_id}]:
{source_fact_text}

EXPECTED VALUE: {expected_value}

PROBLEMATIC GENERATED STATEMENT:
"{problematic_text}"

INSTRUCTION:
Correct the generated statement so that it strictly reflects the expected value and source fact, without changing the overall tone or style.
Return ONLY the corrected sentence. Do NOT add explanation or quotes.
"""


def _replace_in_data_structure(data: Any, old_text: str, new_text: str) -> Any:
    """Recursively replace text snippet in nested dicts / lists / strings."""
    if isinstance(data, str):
        if old_text in data:
            return data.replace(old_text, new_text)
        return data
    elif isinstance(data, dict):
        return {k: _replace_in_data_structure(v, old_text, new_text) for k, v in data.items()}
    elif isinstance(data, list):
        return [_replace_in_data_structure(item, old_text, new_text) for item in data]
    return data


class AutoRepairEngine:
    """Step 18: Automatic Repair for validation inconsistencies."""

    @classmethod
    def repair_outputs(
        cls,
        uckr: UCKR,
        outputs: Dict[str, Any],
        report: DetailedValidationReport,
        fact_matrix: Dict[str, List[str]],
        max_attempts: int = 3
    ) -> Tuple[Dict[str, Any], AutoRepairResult, DetailedValidationReport]:
        repaired_outputs = dict(outputs)
        attempts: List[RepairAttempt] = []

        if report.passed and not report.violations:
            return (
                repaired_outputs,
                AutoRepairResult(
                    repairs_attempted=0,
                    repairs_successful=0,
                    repair_log=[],
                    final_score=report.overall_score,
                    passed=True
                ),
                report
            )

        # Map facts by ID for quick lookup
        facts_map = {f.id: f for f in uckr.facts}

        for v in report.violations:
            ch_name = v.get("channel")
            fact_id = v.get("fact_id", "F001")
            source_fact = facts_map.get(fact_id, uckr.facts[0] if uckr.facts else None)
            source_fact_text = source_fact.statement if source_fact else ""

            # Handle missing fact auto-repair
            if v.get("type") == "missing_fact" or ch_name == "all":
                target_channels = list(repaired_outputs.keys()) if ch_name == "all" else [ch_name]
                for target_ch in target_channels:
                    if target_ch in repaired_outputs and source_fact_text:
                        if isinstance(repaired_outputs[target_ch], str):
                            repaired_outputs[target_ch] += f" [{fact_id}] {source_fact_text}"
                        elif isinstance(repaired_outputs[target_ch], dict):
                            repaired_outputs[target_ch]["text"] = str(repaired_outputs[target_ch].get("text", "")) + f" [{fact_id}] {source_fact_text}"
                            if "source_facts" in repaired_outputs[target_ch]:
                                if fact_id not in repaired_outputs[target_ch]["source_facts"]:
                                    repaired_outputs[target_ch]["source_facts"].append(fact_id)

                attempts.append(RepairAttempt(
                    channel=ch_name,
                    target_item="missing_fact",
                    problematic_text="Missing fact from deliverable",
                    fact_id=fact_id,
                    expected_value=source_fact_text,
                    repaired_text=f"Appended fact [{fact_id}]",
                    success=True
                ))
                continue

            if not ch_name or ch_name not in repaired_outputs:
                continue

            expected_val = v.get("expected")
            found_val = v.get("found")

            if expected_val and found_val and isinstance(expected_val, str) and isinstance(found_val, str):
                # Deterministic precision swap
                repaired_outputs[ch_name] = _replace_in_data_structure(
                    repaired_outputs[ch_name],
                    found_val,
                    expected_val
                )

                attempts.append(RepairAttempt(
                    channel=ch_name,
                    target_item=str(v.get("type", "mismatch")),
                    problematic_text=found_val,
                    fact_id=fact_id,
                    expected_value=expected_val,
                    repaired_text=expected_val,
                    success=True
                ))

        # Re-validate repaired outputs
        new_report = ConsistencyValidator.validate_all(
            uckr=uckr,
            outputs=repaired_outputs,
            fact_matrix=fact_matrix
        )

        successful_repairs = sum(1 for a in attempts if a.success)
        repair_res = AutoRepairResult(
            repairs_attempted=len(attempts),
            repairs_successful=successful_repairs,
            repair_log=attempts,
            final_score=new_report.overall_score,
            passed=new_report.passed
        )

        return repaired_outputs, repair_res, new_report
