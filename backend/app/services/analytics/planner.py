from typing import Any


def build_plan(datasets: list[dict[str, Any]], relationships: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    analyses: list[dict[str, Any]] = []
    for dataset in datasets:
        columns = dataset.get("columns", [])
        dates = [column for column in columns if column["semantic_type"] in {"date", "datetime"}]
        measures = [column for column in columns if column["semantic_type"] == "numeric_measure"]
        dimensions = [column for column in columns if column["semantic_type"] in {"categorical_dimension", "location", "boolean"}]
        identifiers = [column for column in columns if column["semantic_type"] == "identifier"]
        for measure in measures[:3]:
            analyses.append({"analysis_type": "descriptive", "dataset_id": dataset["id"], "measure": measure["original_name"]})
            for dimension in dimensions[:3]: analyses.append({"analysis_type": "grouped", "dataset_id": dataset["id"], "measure": measure["original_name"], "dimension": dimension["original_name"]})
            if dates: analyses.append({"analysis_type": "time_series", "dataset_id": dataset["id"], "measure": measure["original_name"], "date_column": dates[0]["original_name"], "granularity": "monthly"})
            if dates: analyses.append({"analysis_type": "rolling_average", "dataset_id": dataset["id"], "measure": measure["original_name"], "date_column": dates[0]["original_name"], "granularity": "monthly", "window": 3})
            analyses.append({"analysis_type": "distribution", "dataset_id": dataset["id"], "measure": measure["original_name"]})
            analyses.append({"analysis_type": "anomaly", "dataset_id": dataset["id"], "measure": measure["original_name"]})
        if len(measures) >= 2:
            analyses.append({"analysis_type": "correlation", "dataset_id": dataset["id"], "left": measures[0]["original_name"], "right": measures[1]["original_name"]})
        if identifiers and dates and measures:
            analyses.append({"analysis_type": "entity_activity", "dataset_id": dataset["id"], "identifier": identifiers[0]["original_name"], "measure": measures[0]["original_name"], "date_column": dates[0]["original_name"]})
    return {"version": 1, "analyses": analyses[:50], "relationships_considered": len(relationships or []), "notes": ["Plans are generated from deterministic semantic metadata; missing prerequisites are not scheduled."]}
