from math import floor
from typing import Any

from app.services.analytics.aggregations import values


def histogram(rows: list[dict[str, Any]], measure: str, bins: int = 10) -> dict[str, Any]:
    numbers = values(rows, measure)
    if not numbers:
        return {"bins": [], "count": 0}
    minimum, maximum = min(numbers), max(numbers)
    width = (maximum - minimum) / bins if maximum != minimum else 1
    counts = [0] * bins
    for number in numbers:
        counts[min(bins - 1, floor((number - minimum) / width))] += 1
    return {"count": len(numbers), "minimum": minimum, "maximum": maximum, "bins": [{"start": minimum + index * width, "end": minimum + (index + 1) * width, "count": count} for index, count in enumerate(counts)]}
