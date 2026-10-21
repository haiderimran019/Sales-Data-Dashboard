from typing import Any

from app.services.analytics.aggregations import grouped, values


def compare_groups(rows: list[dict[str, Any]], dimension: str, measure: str, left: str, right: str) -> dict[str, Any]:
    groups = {item["key"]: item for item in grouped(rows, dimension, measure, limit=100, descending=False)}
    left_value = groups.get(left, {}).get("value")
    right_value = groups.get(right, {}).get("value")
    if left_value is None or right_value is None:
        return {"left": left, "right": right, "status": "not_available", "warning": "Both comparison groups must exist."}
    return {"left": {"key": left, "value": left_value}, "right": {"key": right, "value": right_value}, "difference": left_value - right_value, "percentage_difference": (left_value - right_value) / abs(right_value) * 100 if right_value else None, "warning": "This is a descriptive comparison, not a causal claim."}
