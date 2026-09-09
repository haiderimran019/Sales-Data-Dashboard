from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class AnalysisResultData:
    analysis_type: str
    dataset_id: str
    title: str
    description: str
    status: str
    calculation: dict[str, Any]
    inputs: dict[str, Any]
    result_data: dict[str, Any] | None
    units: str | None = None
    result_scope: str = "exact"
    warnings: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def as_dict(self) -> dict[str, Any]:
        return {
            "analysis_type": self.analysis_type,
            "dataset_id": self.dataset_id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "calculation": self.calculation,
            "inputs": self.inputs,
            "result_data": self.result_data,
            "units": self.units,
            "result_scope": self.result_scope,
            "warnings": self.warnings,
            "created_at": self.created_at,
        }
