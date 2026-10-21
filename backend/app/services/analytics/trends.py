from collections import defaultdict
from datetime import datetime
from typing import Any

from app.services.analytics.aggregations import values


def period_key(value: Any, granularity: str) -> str | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        for pattern in ("%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"):
            try:
                parsed = datetime.strptime(str(value), pattern)
                break
            except ValueError:
                continue
        else:
            return None
    if granularity == "yearly": return parsed.strftime("%Y")
    if granularity == "quarterly": return f"{parsed.year}-Q{(parsed.month - 1) // 3 + 1}"
    if granularity == "weekly": return parsed.strftime("%G-W%V")
    if granularity == "daily": return parsed.strftime("%Y-%m-%d")
    return parsed.strftime("%Y-%m")


def time_series(rows: list[dict[str, Any]], date_column: str, measure: str, granularity: str = "monthly") -> list[dict[str, Any]]:
    periods: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        key = period_key(row.get(date_column), granularity)
        if key and values([row], measure): periods[key].append(values([row], measure)[0])
    ordered = sorted(periods)
    result: list[dict[str, Any]] = []
    previous: float | None = None
    for key in ordered:
        total = sum(periods[key])
        result.append({"period": key, "value": total, "count": len(periods[key]), "period_over_period_percentage": ((total - previous) / abs(previous) * 100 if previous not in (None, 0) else None)})
        previous = total
    return result


def rolling_average(points: list[dict[str, Any]], window: int = 3) -> list[dict[str, Any]]:
    if window < 1:
        raise ValueError("Rolling window must be positive")
    output = []
    for index, point in enumerate(points):
        values = [item["value"] for item in points[max(0, index - window + 1): index + 1]]
        output.append({**point, "rolling_average": sum(values) / len(values)})
    return output
