from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AnalysisOpportunity, Dataset, DatasetColumn, File, RelationshipCandidate
from app.services.profiling.column_profiler import profile_columns
from app.services.profiling.domain import classify_domain
from app.services.profiling.opportunities import detect_opportunities
from app.services.profiling.quality import quality_score
from app.services.profiling.relationships import detect_relationships


def _duplicate_count(rows: list[dict[str, Any]]) -> int:
    seen: set[tuple[tuple[str, str], ...]] = set()
    duplicates = 0
    for row in rows:
        key = tuple(sorted((str(name), str(value)) for name, value in row.items()))
        if key in seen:
            duplicates += 1
        seen.add(key)
    return duplicates


def _dataset_understanding(table: dict[str, Any], extraction: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    rows = table.get("rows") or []
    row_count = table.get("row_count")
    columns = profile_columns(rows, row_count, table.get("missing_values"))
    column_payload = [{
        "original_name": column.original_name,
        "normalized_name": column.normalized_name,
        "inferred_type": column.inferred_type,
        "semantic_type": column.semantic_type,
        "confidence": column.confidence,
        "evidence": column.evidence,
        "null_count": column.null_count,
        "null_percentage": column.null_percentage,
        "unique_count": column.unique_count,
        "uniqueness_percentage": column.uniqueness_percentage,
        "sample_values": column.sample_values,
        "statistics": column.statistics,
        "top_values": column.top_values,
        "outlier_count": column.outlier_count,
        "outlier_percentage": column.outlier_percentage,
        "outlier_method": column.outlier_method,
    } for column in columns]
    missing_total = sum(column.null_count for column in columns)
    denominator = max(1, (row_count or len(rows)) * max(1, len(columns)))
    duplicate_count = _duplicate_count(rows)
    duplicate_percentage = duplicate_count / max(1, len(rows)) * 100
    outlier_percentage = sum(column.outlier_percentage for column in columns) / max(1, len(columns))
    missing_percentage = missing_total / denominator * 100
    score, details = quality_score(missing_percentage=missing_percentage, duplicate_percentage=duplicate_percentage, outlier_percentage=outlier_percentage)
    domain, domain_confidence, domain_evidence = classify_domain(column_payload)
    profile_scope = "preview" if row_count is not None and row_count > len(rows) else "exact"
    details.update({"missing_value_count": missing_total, "missing_percentage": round(missing_percentage, 2), "duplicate_row_count": duplicate_count, "duplicate_percentage": round(duplicate_percentage, 2), "duplicate_scope": profile_scope, "warnings": [f"{column.null_percentage:.1f}% missing values in {column.original_name}" for column in columns if column.null_percentage >= 20] + ["Potential duplicate rows were observed in the profiling sample."] * bool(duplicate_count)})
    understanding = {
        "name": table.get("name") or "Table",
        "dataset_type": "table",
        "row_count": row_count,
        "column_count": len(columns),
        "profile_scope": profile_scope,
        "quality_score": score,
        "quality_details": details,
        "domain": domain,
        "domain_confidence": domain_confidence,
        "domain_evidence": domain_evidence,
        "metadata": {"extraction_warnings": table.get("warnings", []), "statistics_scope": profile_scope},
    }
    return understanding, column_payload


def profile_extraction(db: Session, *, organization_id: UUID, project_id: UUID, version_id: UUID, file: File, extraction: dict[str, Any]) -> list[Dataset]:
    dataset_payloads: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    tables = extraction.get("tables") or []
    if tables:
        dataset_payloads = [_dataset_understanding(table, extraction) for table in tables]
    else:
        document = {
            "name": file.original_filename,
            "dataset_type": "document",
            "row_count": None,
            "column_count": 0,
            "profile_scope": "exact",
            "quality_score": None,
            "quality_details": {"formula": "Not applicable to document-only extraction."},
            "domain": "General/Unknown",
            "domain_confidence": 0.25,
            "domain_evidence": ["Document content requires semantic understanding in a later phase."],
            "metadata": extraction.get("metadata", {}),
        }
        dataset_payloads = [(document, [])]
    created: list[Dataset] = []
    column_payloads: list[list[dict[str, Any]]] = []
    for payload, columns in dataset_payloads:
        dataset = Dataset(organization_id=organization_id, project_id=project_id, version_id=version_id, file_id=file.id, name=payload["name"], dataset_type=payload["dataset_type"], row_count=payload["row_count"], column_count=payload["column_count"], profile_scope=payload["profile_scope"], quality_score=payload["quality_score"], quality_details=payload["quality_details"], domain=payload["domain"], domain_confidence=payload["domain_confidence"], domain_evidence=payload["domain_evidence"], dataset_metadata=payload["metadata"])
        db.add(dataset)
        db.flush()
        for column in columns:
            db.add(DatasetColumn(organization_id=organization_id, dataset=dataset, **column))
        created.append(dataset)
        column_payloads.append(columns)
    db.flush()
    relationship_inputs = [{"name": dataset.name, "columns": columns} for dataset, columns in zip(created, column_payloads)]
    relationships = detect_relationships(relationship_inputs)
    dataset_by_name = {dataset.name: dataset for dataset in created}
    columns_by_name = {(dataset.name, column.original_name): column for dataset in created for column in dataset.columns}
    for relationship in relationships:
        left = columns_by_name.get((relationship["left_dataset"], relationship["left_column"]))
        right = columns_by_name.get((relationship["right_dataset"], relationship["right_column"]))
        if left and right:
            db.add(RelationshipCandidate(organization_id=organization_id, project_id=project_id, version_id=version_id, left_dataset_id=dataset_by_name[relationship["left_dataset"]].id, left_column_id=left.id, right_dataset_id=dataset_by_name[relationship["right_dataset"]].id, right_column_id=right.id, relationship_type=relationship["relationship_type"], confidence=relationship["confidence"], evidence=relationship["evidence"]))
    opportunities = [opportunity for _, columns in dataset_payloads for opportunity in detect_opportunities(columns, len(relationships))]
    for opportunity in opportunities:
        db.add(AnalysisOpportunity(organization_id=organization_id, project_id=project_id, version_id=version_id, dataset_id=created[0].id if created else None, **opportunity))
    db.flush()
    return created
