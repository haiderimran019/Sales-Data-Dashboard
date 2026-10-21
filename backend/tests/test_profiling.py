from pathlib import Path
from uuid import uuid4

from app.services.profiling.column_profiler import profile_columns
from app.services.profiling.domain import classify_domain
from app.services.profiling.opportunities import detect_opportunities
from app.services.profiling.quality import quality_score
from app.services.profiling.relationships import detect_relationships
from app.services.profiling.type_detection import classify_semantic, detect_storage_type, normalize_name, normalized_unique_names


def test_type_and_semantic_detection() -> None:
    assert detect_storage_type([1, 2, 3]) == "integer"
    assert detect_storage_type(["2024-01-01", "2024-02-01"]) == "date"
    assert detect_storage_type(["yes", "no"]) == "boolean"
    assert normalize_name("Total Sales ($)") == "total_sales"
    assert normalized_unique_names(["Order Date", "Order-Date"]) == ["order_date", "order_date_2"]
    semantic, confidence, _ = classify_semantic("customer_id", [1001, 1002, 1003], "integer", 1.0)
    assert semantic == "identifier"
    assert confidence > 0.7
    assert classify_semantic("discount", ["10%", "20%"], "float", 1.0)[0] == "percentage"
    assert classify_semantic("country", ["US", "US", "CA"], "string", 2 / 3)[0] == "location"


def test_column_profile_statistics_missing_top_values_and_outliers() -> None:
    rows = [
        {"Sales": 10, "Category": "A", "Phone": ""},
        {"Sales": 11, "Category": "A", "Phone": "555"},
        {"Sales": 12, "Category": "B", "Phone": None},
        {"Sales": 1000, "Category": "A", "Phone": ""},
    ]

    profiles = profile_columns(rows, row_count=4)
    sales = profiles[0]
    phone = profiles[2]

    assert sales.statistics["mean"] > 200
    assert sales.outlier_method == "IQR"
    assert sales.outlier_count == 1
    assert phone.null_count == 3
    assert phone.null_percentage == 75.0
    assert profiles[1].top_values[0]["value"] == "A"


def test_quality_score_is_transparent_and_bounded() -> None:
    score, details = quality_score(missing_percentage=10, duplicate_percentage=2, outlier_percentage=5)

    assert 0 <= score <= 100
    assert score < 100
    assert "formula" in details
    assert details["missing_penalty"] == 4.5


def test_domain_relationship_and_opportunity_detection() -> None:
    columns = [
        {"original_name": "Order Date", "normalized_name": "order_date", "inferred_type": "date", "semantic_type": "date"},
        {"original_name": "Revenue", "normalized_name": "revenue", "inferred_type": "float", "semantic_type": "numeric_measure"},
        {"original_name": "Customer ID", "normalized_name": "customer_id", "inferred_type": "integer", "semantic_type": "identifier"},
        {"original_name": "Country", "normalized_name": "country", "inferred_type": "string", "semantic_type": "location"},
    ]
    domain, confidence, evidence = classify_domain(columns)
    opportunities = detect_opportunities(columns, relationship_count=1)
    relationships = detect_relationships([
        {"name": "customers", "columns": [{"original_name": "Customer ID", "normalized_name": "customer_id", "semantic_type": "identifier", "sample_values": ["1", "2"], "uniqueness_percentage": 100}]},
        {"name": "orders", "columns": [{"original_name": "Customer ID", "normalized_name": "customer_id", "semantic_type": "identifier", "sample_values": ["1", "2", "2"], "uniqueness_percentage": 50}]},
    ])

    assert domain == "Sales"
    assert confidence > 0
    assert evidence
    assert {item["kind"] for item in opportunities} >= {"time_series", "geographic", "entity_behavior", "relational"}
    assert relationships[0]["relationship_type"] == "one-to-many"
    assert relationships[0]["confidence"] > 0.5
