from typing import Any

from app.services.analytics.aggregations import values


def iqr_anomalies(rows: list[dict[str, Any]], measure: str) -> dict[str, Any]:
    indexed = [(index, value[0]) for index, row in enumerate(rows) if (value := values([row], measure))]
    if not indexed: return {"method": "IQR", "potential_anomalies": []}
    ordered = sorted(value for _, value in indexed)
    q1, q3 = ordered[int((len(ordered) - 1) * 0.25)], ordered[int((len(ordered) - 1) * 0.75)]
    lower, upper = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
    anomalies = [{"row_index": index, "value": value, "severity": "high" if value < lower - (q3 - q1) or value > upper + (q3 - q1) else "moderate"} for index, value in indexed if value < lower or value > upper]
    return {"method": "IQR", "lower_bound": lower, "upper_bound": upper, "potential_anomalies": anomalies, "warning": "Potential anomalies are not necessarily errors."}
