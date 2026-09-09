from app.services.analytics.aggregations import descriptive, grouped
from app.services.analytics.anomalies import iqr_anomalies
from app.services.analytics.correlations import pearson
from app.services.analytics.comparisons import compare_groups
from app.services.analytics.distributions import histogram
from app.services.analytics.executor import execute_plan
from app.services.analytics.planner import build_plan
from app.services.analytics.trends import rolling_average, time_series


ROWS = [
    {"date": "2024-01-01", "category": "A", "sales": 10.0, "profit": 2.0, "customer_id": "1"},
    {"date": "2024-01-15", "category": "A", "sales": 12.0, "profit": 3.0, "customer_id": "2"},
    {"date": "2024-02-01", "category": "B", "sales": 100.0, "profit": 20.0, "customer_id": "2"},
]


def test_metric_and_grouped_calculations() -> None:
    result = descriptive(ROWS, "sales")
    groups = grouped(ROWS, "category", "sales")

    assert result["sum"] == 122
    assert result["median"] == 12
    assert groups[0]["key"] == "B"
    assert round(groups[0]["contribution_percentage"], 2) == round(100 / 122 * 100, 2)


def test_time_series_growth_and_distribution() -> None:
    points = time_series(ROWS, "date", "sales", "monthly")
    distribution = histogram(ROWS, "sales", bins=2)

    assert points[0]["period"] == "2024-01"
    assert points[1]["period_over_period_percentage"] is not None
    assert sum(item["count"] for item in distribution["bins"]) == 3
    assert rolling_average(points, 2)[-1]["rolling_average"] == 56.0
    assert compare_groups(ROWS, "category", "sales", "A", "B")["difference"] == -78.0


def test_correlation_and_potential_anomalies() -> None:
    correlation = pearson(ROWS, "sales", "profit")
    anomalies = iqr_anomalies(ROWS, "sales")

    assert correlation["method"] == "Pearson"
    assert correlation["coefficient"] > 0
    assert anomalies["method"] == "IQR"
    assert isinstance(anomalies["potential_anomalies"], list)


def test_planning_prerequisites_and_exact_estimated_scope() -> None:
    datasets = [{
        "id": "dataset-1",
        "profile_scope": "preview",
        "columns": [
            {"original_name": "date", "semantic_type": "date", "inferred_type": "date"},
            {"original_name": "sales", "semantic_type": "numeric_measure", "inferred_type": "float"},
            {"original_name": "category", "semantic_type": "categorical_dimension", "inferred_type": "string"},
        ],
    }]
    plan = build_plan(datasets)
    results = execute_plan(plan, {"dataset-1": {"id": "dataset-1", "rows": ROWS, "row_count": 100, "profile_scope": "preview"}})

    assert plan["analyses"]
    assert any(spec["analysis_type"] == "time_series" for spec in plan["analyses"])
    assert results
    assert all(result.result_scope == "estimated" for result in results)
    assert all(result.warnings for result in results)


def test_unsupported_analysis_is_structured_not_exception() -> None:
    results = execute_plan({"analyses": [{"analysis_type": "unknown", "dataset_id": "dataset-1"}]}, {"dataset-1": {"id": "dataset-1", "rows": ROWS, "profile_scope": "exact"}})

    assert results[0].status == "not_available"
    assert results[0].result_data is None
