from typing import Any


def detect_opportunities(columns: list[dict[str, Any]], relationship_count: int = 0) -> list[dict[str, Any]]:
    semantics = {column["semantic_type"] for column in columns}
    opportunities: list[dict[str, Any]] = []
    if "date" in semantics or "datetime" in semantics:
        if "numeric_measure" in semantics:
            opportunities.append({"kind": "time_series", "title": "Trend analysis", "description": "A time field and numeric measure support temporal trend analysis.", "evidence": ["Detected date/time column", "Detected numeric measure"], "confidence": 0.9})
    if "categorical_dimension" in semantics and "numeric_measure" in semantics:
        opportunities.append({"kind": "comparison", "title": "Category comparison", "description": "Categorical dimensions can be compared against numeric measures.", "evidence": ["Detected categorical dimension", "Detected numeric measure"], "confidence": 0.86})
    if "location" in semantics and "numeric_measure" in semantics:
        opportunities.append({"kind": "geographic", "title": "Geographic analysis", "description": "Location fields and numeric measures support geographic comparisons.", "evidence": ["Detected location field", "Detected numeric measure"], "confidence": 0.84})
    if "identifier" in semantics and ("date" in semantics or "datetime" in semantics) and "numeric_measure" in semantics:
        opportunities.append({"kind": "entity_behavior", "title": "Entity behavior analysis", "description": "An identifier, time field, and measure support entity-level behavior analysis.", "evidence": ["Detected identifier", "Detected date/time column", "Detected numeric measure"], "confidence": 0.82})
    if len([column for column in columns if column["inferred_type"] in {"integer", "float"}]) >= 2:
        opportunities.append({"kind": "correlation", "title": "Correlation analysis", "description": "Multiple numeric columns support deterministic correlation analysis.", "evidence": ["Detected multiple numeric columns"], "confidence": 0.78})
    if relationship_count:
        opportunities.append({"kind": "relational", "title": "Relational analysis", "description": "Potential relationships connect multiple uploaded datasets.", "evidence": [f"Detected {relationship_count} relationship candidate(s)"], "confidence": 0.75})
    return opportunities
