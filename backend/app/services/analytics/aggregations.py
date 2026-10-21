from collections import defaultdict
from statistics import mean, median, pstdev
from typing import Any


def values(rows: list[dict[str, Any]], column: str) -> list[float]:
    output: list[float] = []
    for row in rows:
        value = row.get(column)
        try:
            if value is not None and str(value).strip() != "":
                output.append(float(str(value).replace(",", "").replace("%", "")))
        except (TypeError, ValueError):
            continue
    return output


def descriptive(rows: list[dict[str, Any]], measure: str) -> dict[str, Any]:
    numbers = values(rows, measure)
    if not numbers:
        return {"count": 0}
    ordered = sorted(numbers)
    return {
        "count": len(numbers),
        "sum": sum(numbers),
        "mean": mean(numbers),
        "median": median(numbers),
        "min": min(numbers),
        "max": max(numbers),
        "standard_deviation": pstdev(numbers) if len(numbers) > 1 else 0.0,
        "quantiles": {"q25": ordered[int((len(ordered) - 1) * 0.25)], "q75": ordered[int((len(ordered) - 1) * 0.75)]},
    }


def grouped(rows: list[dict[str, Any]], dimension: str, measure: str, limit: int = 20, descending: bool = True) -> list[dict[str, Any]]:
    groups: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        number = values([row], measure)
        if number:
            groups[str(row.get(dimension, "(missing)"))].append(number[0])
    total = sum(sum(numbers) for numbers in groups.values())
    output = [{"key": key, "value": sum(numbers), "count": len(numbers), "contribution_percentage": (sum(numbers) / total * 100 if total else 0)} for key, numbers in groups.items()]
    return sorted(output, key=lambda item: item["value"], reverse=descending)[:limit]
