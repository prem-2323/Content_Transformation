import json
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field


router = APIRouter(prefix="/results", tags=["Results Workspace"])


class ResultsExportRequest(BaseModel):
    outputs: dict[str, Any] = Field(default_factory=dict)
    active_channel: str | None = None
    validation_report: dict[str, Any] = Field(default_factory=dict)
    format: Literal["all", "structured"] = "all"


def _display_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    return json.dumps(value, indent=2, ensure_ascii=False)


def _safe_filename(value: str) -> str:
    cleaned = "".join(character.lower() if character.isalnum() else "_" for character in value)
    return cleaned.strip("_") or "deliverable"


@router.post("/export")
def export_results(request: ResultsExportRequest) -> Response:
    """Create a downloadable deliverables file from Results Workspace outputs."""
    if not request.outputs:
        raise HTTPException(status_code=400, detail="At least one output is required.")

    outputs = {key: _display_text(value) for key, value in request.outputs.items()}
    channel = request.active_channel or next(iter(outputs))

    if request.format == "structured":
        if channel not in outputs:
            raise HTTPException(status_code=400, detail="The selected channel does not exist.")
        score = request.validation_report.get("overall_score", "")
        content = (
            f'---\ntitle: "{channel}"\n'
            f'date: "{date.today().isoformat()}"\n'
            'author: "Synthetix AI Content Intelligence Engine"\n'
            'pipeline: "Unified Content Knowledge Representation (UCKR)"\n'
            f"consistency_score: {score}%\n"
            'fact_attributions: ["F001", "F002", "F003"]\n'
            f'tags: ["documentation", "synthetix", "ai-generated", "{_safe_filename(channel)}"]\n'
            f"---\n\n{outputs[channel]}\n\n---\n"
            "Exported from Synthetix AI Content Intelligence Workspace\n"
        )
        filename = f"{_safe_filename(channel)}_structured.md"
    else:
        sections = [
            "Synthetix AI - Aggregated Multi-Channel Deliverables",
            "Generated via Unified Content Knowledge Representation (UCKR)",
        ]
        for title, output in outputs.items():
            sections.extend(["", "---", f"CHANNEL: {title}", "---", "", output])
        content = "\n".join(sections) + "\n"
        filename = "synthetix_all_deliverables.md"

    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
