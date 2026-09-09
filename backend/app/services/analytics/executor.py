from typing import Any

from app.services.analytics.aggregations import descriptive, grouped
from app.services.analytics.anomalies import iqr_anomalies
from app.services.analytics.correlations import pearson
from app.services.analytics.comparisons import compare_groups
from app.services.analytics.distributions import histogram
from app.services.analytics.results import AnalysisResultData
from app.services.analytics.trends import rolling_average, time_series


def execute_one(spec: dict[str, Any], dataset: dict[str, Any]) -> AnalysisResultData:
    rows = dataset.get("rows", [])
    analysis_type = spec["analysis_type"]
    common = {"dataset_id": str(dataset["id"]), "calculation": {"analysis_type": analysis_type, **{key: value for key, value in spec.items() if key != "analysis_type"}}, "inputs": {"row_count": dataset.get("row_count"), "profile_scope": dataset.get("profile_scope", "exact")}}
    scope = "estimated" if dataset.get("profile_scope") == "preview" else "exact"
    warning = ["Result is based on the bounded extraction preview and is estimated."] if scope == "estimated" else []
    if analysis_type == "descriptive": data, title, description = descriptive(rows, spec["measure"]), f"Descriptive statistics for {spec['measure']}", "Deterministic descriptive statistics."
    elif analysis_type == "grouped": data, title, description = {"groups": grouped(rows, spec["dimension"], spec["measure"])}, f"{spec['measure']} by {spec['dimension']}", "Grouped aggregation with contribution percentages."
    elif analysis_type == "time_series": data, title, description = {"points": time_series(rows, spec["date_column"], spec["measure"], spec.get("granularity", "monthly"))}, f"{spec['measure']} over time", "Period totals and period-over-period changes."
    elif analysis_type == "rolling_average":
        points = time_series(rows, spec["date_column"], spec["measure"], spec.get("granularity", "monthly"))
        data, title, description = {"points": rolling_average(points, spec.get("window", 3))}, f"Rolling average of {spec['measure']}", "Rolling average over ordered time periods."
    elif analysis_type == "distribution": data, title, description = histogram(rows, spec["measure"]), f"Distribution of {spec['measure']}", "Histogram-ready deterministic bins."
    elif analysis_type == "correlation": data, title, description = pearson(rows, spec["left"], spec["right"]), f"{spec['left']} vs {spec['right']}", "Pearson correlation; association does not establish causation."
    elif analysis_type == "anomaly": data, title, description = iqr_anomalies(rows, spec["measure"]), f"Potential anomalies in {spec['measure']}", "IQR-based potential anomaly detection."
    elif analysis_type == "comparison": data, title, description = compare_groups(rows, spec["dimension"], spec["measure"], spec["left"], spec["right"]), f"{spec['measure']}: {spec['left']} vs {spec['right']}", "Descriptive group comparison."
    else: return AnalysisResultData(analysis_type=analysis_type, title="Analysis unavailable", description="This analysis type is not implemented or its prerequisites are unavailable.", status="not_available", result_data=None, warnings=["No deterministic executor is registered for this analysis type."], **common)
    return AnalysisResultData(analysis_type=analysis_type, title=title, description=description, status="completed", result_data=data, result_scope=scope, warnings=warning, **common)


def execute_plan(plan: dict[str, Any], datasets: dict[str, dict[str, Any]]) -> list[AnalysisResultData]:
    results = []
    for spec in plan.get("analyses", []):
        dataset = datasets.get(str(spec["dataset_id"]))
        if dataset:
            results.append(execute_one(spec, dataset))
    return results
