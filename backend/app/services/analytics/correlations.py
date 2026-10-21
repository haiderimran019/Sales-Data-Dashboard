from math import sqrt
from typing import Any

from app.services.analytics.aggregations import values


def pearson(rows: list[dict[str, Any]], left: str, right: str) -> dict[str, Any]:
    pairs = []
    for row in rows:
        left_value, right_value = values([row], left), values([row], right)
        if left_value and right_value: pairs.append((left_value[0], right_value[0]))
    if len(pairs) < 2: return {"coefficient": None, "sample_size": len(pairs), "warning": "At least two paired numeric observations are required."}
    left_mean = sum(pair[0] for pair in pairs) / len(pairs)
    right_mean = sum(pair[1] for pair in pairs) / len(pairs)
    numerator = sum((left - left_mean) * (right - right_mean) for left, right in pairs)
    denominator = sqrt(sum((left - left_mean) ** 2 for left, _ in pairs) * sum((right - right_mean) ** 2 for _, right in pairs))
    return {"coefficient": numerator / denominator if denominator else None, "sample_size": len(pairs), "method": "Pearson", "interpretation_warning": "Association does not establish causation."}
