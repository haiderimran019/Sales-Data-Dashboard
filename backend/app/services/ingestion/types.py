from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class DetectedFile:
    kind: str
    mime_type: str
    extension: str


@dataclass
class TablePreview:
    name: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int | None = None
    missing_values: dict[str, int] = field(default_factory=dict)
    data_types: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


@dataclass
class TextBlock:
    location: str
    text: str


@dataclass
class NormalizedExtraction:
    detected_type: str
    status: str = "completed"
    tables: list[TablePreview] = field(default_factory=list)
    text_blocks: list[TextBlock] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    confidence: float | None = None

    def to_metadata(self) -> dict[str, Any]:
        value = asdict(self)
        value["tables"] = [asdict(table) for table in self.tables]
        value["text_blocks"] = [asdict(block) for block in self.text_blocks]
        return value
