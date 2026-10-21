import json
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import AnalysisResult, AnalysisRun, Dataset, DatasetColumn, File, ForecastArtifact, Project, ProjectVersion, RelationshipCandidate


def build_context(db: Session, *, project: Project, version: ProjectVersion, settings: Settings) -> dict[str, Any]:
    datasets = list(db.scalars(select(Dataset).where(Dataset.version_id == version.id).order_by(Dataset.created_at).limit(settings.ai_max_datasets)))
    dataset_ids = [dataset.id for dataset in datasets]
    columns = list(db.scalars(select(DatasetColumn).where(DatasetColumn.dataset_id.in_(dataset_ids)).order_by(DatasetColumn.created_at).limit(settings.ai_max_columns))) if dataset_ids else []
    results = list(db.scalars(select(AnalysisResult).where(AnalysisResult.version_id == version.id).order_by(AnalysisResult.created_at.desc()).limit(settings.ai_max_results)))
    latest_run = db.scalar(select(AnalysisRun).where(AnalysisRun.version_id == version.id).order_by(AnalysisRun.created_at.desc()).limit(1))
    relationships = list(db.scalars(select(RelationshipCandidate).where(RelationshipCandidate.version_id == version.id).limit(30)))
    forecasts = list(db.scalars(select(ForecastArtifact).where(ForecastArtifact.version_id == version.id).order_by(ForecastArtifact.created_at.desc()).limit(10)))
    files = {file.id: file for file in db.scalars(select(File).where(File.version_id == version.id))}
    context: dict[str, Any] = {
        "project": {"id": str(project.id), "name": project.name},
        "version": {"id": str(version.id), "created_at": version.created_at.isoformat()},
        "datasets": [{"id": str(dataset.id), "name": dataset.name, "type": dataset.dataset_type, "rows": dataset.row_count, "columns": dataset.column_count, "quality_score": dataset.quality_score, "quality_details": dataset.quality_details, "domain": dataset.domain, "domain_confidence": dataset.domain_confidence, "profile_scope": dataset.profile_scope} for dataset in datasets],
        "columns": [{"dataset_id": str(column.dataset_id), "name": column.original_name, "semantic_type": column.semantic_type, "inferred_type": column.inferred_type, "confidence": column.confidence, "missing_percentage": column.null_percentage, "statistics": column.statistics, "top_values": column.top_values[:5] if column.top_values else []} for column in columns],
        "relationships": [{"left_dataset_id": str(item.left_dataset_id), "left_column_id": str(item.left_column_id), "right_dataset_id": str(item.right_dataset_id), "right_column_id": str(item.right_column_id), "type": item.relationship_type, "confidence": item.confidence, "evidence": item.evidence} for item in relationships],
        "analytical_results": [{"id": str(result.id), "type": result.analysis_type, "title": result.title, "description": result.description, "calculation": result.calculation, "inputs": result.inputs, "result": result.result_data, "scope": result.result_scope, "warnings": result.warnings} for result in results],
        "analytical_plan": latest_run.plan if latest_run else {"status": "not_available", "reason": "No deterministic analysis run has been stored for this version."},
        "forecasts": [{"id": str(forecast.id), "dataset_id": str(forecast.dataset_id), "date_column": forecast.date_column, "measure_column": forecast.measure_column, "frequency": forecast.frequency, "method": forecast.method, "historical_observation_count": forecast.historical_observation_count, "forecast_horizon": forecast.forecast_horizon, "historical_values": forecast.historical_values[-50:], "forecast_values": forecast.forecast_values, "lower_bound": forecast.lower_bound, "upper_bound": forecast.upper_bound, "mae": forecast.mae, "warnings": forecast.warnings, "scope": forecast.result_scope} for forecast in forecasts],
        "documents": [],
        "truncation": {"datasets_limited": False, "columns_limited": len(columns) >= settings.ai_max_columns, "results_limited": len(results) >= settings.ai_max_results, "text_limited": False},
    }
    for dataset in datasets:
        file = files.get(dataset.file_id)
        if not file or not file.extraction_metadata or dataset.dataset_type == "table":
            continue
        text = " ".join(block.get("text", "") for block in file.extraction_metadata.get("text_blocks", []))
        context["documents"].append({"filename": file.original_filename, "text_excerpt": text[:settings.ai_max_text_chars], "truncated": len(text) > settings.ai_max_text_chars})
    serialized = json.dumps(context, ensure_ascii=True, separators=(",", ":"))
    while len(serialized) > settings.ai_max_context_chars and (context["analytical_results"] or context["forecasts"] or context["columns"] or context["documents"]):
        if context["analytical_results"]:
            context["analytical_results"].pop()
        elif context["forecasts"]:
            context["forecasts"].pop()
        elif context["columns"]:
            context["columns"].pop()
        else:
            context["documents"].pop()
        serialized = json.dumps(context, ensure_ascii=True, separators=(",", ":"))
        context["truncation"]["total_context_limited"] = True
    return context
