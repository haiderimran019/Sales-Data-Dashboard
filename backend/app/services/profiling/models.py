from dataclasses import dataclass, field
from typing import Any


@dataclass
class ColumnProfile:
    original_name: str
    normalized_name: str
    inferred_type: str
    semantic_type: str
    confidence: float
    evidence: list[str]
    null_count: int
    null_percentage: float
    unique_count: int
    uniqueness_percentage: float
    sample_values: list[Any]
    statistics: dict[str, Any]
    top_values: list[dict[str, Any]]
    outlier_count: int = 0
    outlier_percentage: float = 0.0
    outlier_method: str | None = None


@dataclass
class DatasetUnderstanding:
    name: str
    dataset_type: str
    row_count: int | None
    column_count: int
    profile_scope: str
    quality_score: float | None
    quality_details: dict[str, Any]
    domain: str
    domain_confidence: float
    domain_evidence: list[str]
    metadata: dict[str, Any] = field(default_factory=dict)
    columns: list[ColumnProfile] = field(default_factory=list)
