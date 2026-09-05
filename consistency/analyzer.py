import json
import re
import logging
from typing import Dict, Any, Optional, List

from text.qwen_service import generate_with_qwen, QwenServiceError
from .schemas import (
    NormalizedSource,
    UCKR,
    DocumentMetadata,
    FactItem,
    EntityItem,
    ClaimItem,
    StatisticItem,
    RelationshipItem
)

logger = logging.getLogger(__name__)


UCKR_ANALYSIS_PROMPT_TEMPLATE = """
You are an expert knowledge engineering and content understanding AI.
Analyze the following source document and construct a comprehensive, structured representation of its knowledge.

Instead of writing a summary, extract and structure ALL:
1. Atomic Facts (independent, verifiable factual statements)
2. Entities (organizations, technologies, domains, people, key concepts)
3. Claims (arguments, assertions, theses)
4. Statistics (numerical metrics, percentages, dollar amounts, timeline milestones)
5. Key Concepts (important terminology and themes)
6. Semantic Relationships (Source Entity -> Action/Relation -> Target Entity)

SOURCE TITLE: {title}
SOURCE ID: {source_id}
SOURCE CONTENT:
{source_text}

OUTPUT FORMAT CONSTRAINTS:
- Return ONLY a single valid JSON object.
- Do NOT wrap in markdown explanation or conversational text.
- Follow this exact JSON structure:
{{
  "document": {{
    "id": "{source_id}",
    "title": "{title}",
    "domain": "Primary Knowledge Domain (e.g. Artificial Intelligence, Healthcare, Finance)",
    "author": "Author or Organization if mentioned"
  }},
  "core_topic": "Concise definition of the primary core topic",
  "summary": "High-level 2-3 sentence knowledge summary",
  "facts": [
    {{
      "id": "F001",
      "statement": "Clear, standalone factual statement.",
      "importance": 0.95,
      "source_reference": "page_1 or section name",
      "confidence": 0.95,
      "category": "Technology/Policy/Market/etc.",
      "entities_mentioned": ["Entity1", "Entity2"]
    }}
  ],
  "entities": [
    {{
      "id": "E001",
      "name": "Entity Name",
      "type": "Technology / Organization / Domain / Metric",
      "description": "Brief description of the entity"
    }}
  ],
  "claims": [
    {{
      "id": "C001",
      "claim": "Claim or central thesis statement.",
      "support": "Evidence or rationale provided in source",
      "status": "Supported"
    }}
  ],
  "statistics": [
    {{
      "id": "S001",
      "value": "35% or $10B",
      "context": "Context describing what this number measures",
      "source_reference": "section reference"
    }}
  ],
  "key_concepts": [
    "Concept 1",
    "Concept 2",
    "Concept 3"
  ],
  "relationships": [
    {{
      "source": "Entity A",
      "relation": "improves / reduces / enables / drives",
      "target": "Entity B"
    }}
  ]
}}
"""


def _clean_json_response(raw_text: str) -> str:
    """Strip markdown code fences and extraneous text from LLM response."""
    text = raw_text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1]
        if "```" in text:
            text = text.split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1]
        if "```" in text:
            text = text.split("```", 1)[0]
    return text.strip()


def _normalize_and_reindex_uckr_data(data: Dict[str, Any], source: NormalizedSource) -> UCKR:
    """Normalize fields and ensure strict, sequential ID naming for facts, entities, etc."""
    doc_data = data.get("document", {})
    doc_meta = DocumentMetadata(
        id=doc_data.get("id") or source.source_id,
        title=doc_data.get("title") or source.title,
        domain=doc_data.get("domain") or "General",
        author=doc_data.get("author") or source.metadata.get("author", ""),
        created_date=doc_data.get("created_date") or source.created_at or ""
    )

    core_topic = data.get("core_topic") or source.title or "General Topic"
    summary = data.get("summary") or "Comprehensive structured knowledge representation."

    # Normalize facts
    raw_facts = data.get("facts", [])
    facts: List[FactItem] = []
    for idx, f in enumerate(raw_facts, 1):
        if isinstance(f, str):
            f_stmt = f
            f_imp = 0.8
            f_ref = "source_text"
            f_conf = 0.9
            f_cat = "General"
            f_ents = []
        elif isinstance(f, dict):
            f_stmt = f.get("statement") or f.get("text") or f.get("fact") or str(f)
            f_imp = float(f.get("importance", 0.8))
            f_ref = str(f.get("source_reference") or f.get("source") or "source_text")
            f_conf = float(f.get("confidence", 0.9))
            f_cat = str(f.get("category", "General"))
            f_ents = f.get("entities_mentioned") or []
        else:
            continue

        facts.append(FactItem(
            id=f"F{idx:03d}",
            statement=f_stmt.strip(),
            importance=max(0.0, min(1.0, f_imp)),
            source_reference=f_ref,
            confidence=max(0.0, min(1.0, f_conf)),
            category=f_cat,
            entities_mentioned=f_ents if isinstance(f_ents, list) else [str(f_ents)]
        ))

    # Normalize entities
    raw_entities = data.get("entities", [])
    entities: List[EntityItem] = []
    for idx, e in enumerate(raw_entities, 1):
        if isinstance(e, str):
            e_name = e
            e_type = "Concept"
            e_desc = ""
        elif isinstance(e, dict):
            e_name = e.get("name") or str(e)
            e_type = e.get("type") or "Concept"
            e_desc = e.get("description") or ""
        else:
            continue

        entities.append(EntityItem(
            id=f"E{idx:03d}",
            name=e_name.strip(),
            type=e_type,
            description=e_desc
        ))

    # Normalize claims
    raw_claims = data.get("claims", [])
    claims: List[ClaimItem] = []
    for idx, c in enumerate(raw_claims, 1):
        if isinstance(c, str):
            c_claim = c
            c_sup = "source"
            c_stat = "Supported"
        elif isinstance(c, dict):
            c_claim = c.get("claim") or c.get("statement") or str(c)
            c_sup = c.get("support") or ""
            c_stat = c.get("status") or "Supported"
        else:
            continue

        claims.append(ClaimItem(
            id=f"C{idx:03d}",
            claim=c_claim.strip(),
            support=c_sup,
            status=c_stat
        ))

    # Normalize statistics
    raw_stats = data.get("statistics", [])
    stats: List[StatisticItem] = []
    for idx, s in enumerate(raw_stats, 1):
        if isinstance(s, dict):
            val = str(s.get("value") or "")
            ctx = str(s.get("context") or "")
            ref = str(s.get("source_reference") or "")
            if val or ctx:
                stats.append(StatisticItem(
                    id=f"S{idx:03d}",
                    value=val,
                    context=ctx,
                    source_reference=ref
                ))

    # Normalize key concepts
    raw_concepts = data.get("key_concepts", [])
    key_concepts: List[str] = [str(c).strip() for c in raw_concepts if str(c).strip()]

    # Normalize relationships
    raw_rels = data.get("relationships", [])
    relationships: List[RelationshipItem] = []
    for r in raw_rels:
        if isinstance(r, dict) and "source" in r and "relation" in r and "target" in r:
            relationships.append(RelationshipItem(
                source=str(r["source"]).strip(),
                relation=str(r["relation"]).strip(),
                target=str(r["target"]).strip()
            ))

    # Fallback if no facts extracted: extract sentences as atomic facts
    if not facts:
        sentences = [s.strip() for s in re.split(r"[.!?]\s+", source.raw_text) if len(s.strip()) > 15]
        for idx, s in enumerate(sentences[:10], 1):
            facts.append(FactItem(
                id=f"F{idx:03d}",
                statement=s,
                importance=0.85,
                source_reference="paragraph_1",
                confidence=0.88,
                category="Extracted Fact"
            ))

    return UCKR(
        document=doc_meta,
        core_topic=core_topic,
        summary=summary,
        facts=facts,
        entities=entities,
        claims=claims,
        statistics=stats,
        key_concepts=key_concepts or [core_topic],
        relationships=relationships
    )


def create_fallback_uckr(source: NormalizedSource) -> UCKR:
    """Deterministic fallback UCKR constructor when LLM is unavailable."""
    doc_meta = DocumentMetadata(
        id=source.source_id,
        title=source.title,
        domain="Information Technology & Transformation",
        author="Source Author",
        created_date=source.created_at or ""
    )

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", source.raw_text) if len(s.strip()) > 20]
    facts: List[FactItem] = []
    for idx, s in enumerate(sentences[:12], 1):
        facts.append(FactItem(
            id=f"F{idx:03d}",
            statement=s,
            importance=round(0.95 - (idx * 0.03), 2),
            source_reference=f"section_{min(idx, len(source.sections)) if source.sections else '1'}",
            confidence=0.92,
            category="Core Finding",
            entities_mentioned=[]
        ))

    # Extract basic statistics (numbers or percentages)
    stats: List[StatisticItem] = []
    stat_matches = re.findall(r"(\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?(?:[BMK]| billion| million)?|\b\d{2,}\b)", source.raw_text)
    for idx, sm in enumerate(stat_matches[:5], 1):
        stats.append(StatisticItem(
            id=f"S{idx:03d}",
            value=sm,
            context=f"Metric observed in document: {sm}",
            source_reference="source_text"
        ))

    # Extract capital phrases as entities
    ent_matches = list(set(re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", source.raw_text)))
    entities = [
        EntityItem(id=f"E{idx:03d}", name=ent, type="Concept", description=f"Entity identified in {source.title}")
        for idx, ent in enumerate(ent_matches[:8], 1)
        if len(ent) > 3 and ent not in ["The", "This", "That", "There", "Here"]
    ]

    return UCKR(
        document=doc_meta,
        core_topic=source.title,
        summary=f"Structured knowledge model for {source.title}. Extracted {len(facts)} key facts.",
        facts=facts,
        entities=entities,
        claims=[
            ClaimItem(
                id="C001",
                claim=f"{source.title} drives transformative operational insights.",
                support="source_section_1",
                status="Supported"
            )
        ],
        statistics=stats,
        key_concepts=[source.title] + [e.name for e in entities[:4]],
        relationships=[
            RelationshipItem(
                source=entities[0].name if entities else source.title,
                relation="enables",
                target=entities[1].name if len(entities) > 1 else "Transformation"
            )
        ] if entities else []
    )


def analyze_source_and_build_uckr(source: NormalizedSource) -> UCKR:
    """
    Stage 3 & 4: Content Understanding & Common Knowledge Representation Creation.
    Sends extracted source to Qwen3 4B to build the Unified Content Knowledge Representation (UCKR).
    """
    prompt = UCKR_ANALYSIS_PROMPT_TEMPLATE.format(
        title=source.title,
        source_id=source.source_id,
        source_text=source.raw_text[:6000]  # Limit length for prompt context window
    )

    try:
        raw_response = generate_with_qwen(prompt)
        cleaned_json = _clean_json_response(raw_response)
        data = json.loads(cleaned_json)
        if isinstance(data, dict):
            return _normalize_and_reindex_uckr_data(data, source)
    except (QwenServiceError, json.JSONDecodeError, Exception) as e:
        logger.warning(f"Qwen UCKR analysis failed or invalid JSON returned: {e}. Using deterministic fallback.")

    return create_fallback_uckr(source)
