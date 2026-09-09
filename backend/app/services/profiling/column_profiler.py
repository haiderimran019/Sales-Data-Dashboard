from collections import Counter
from datetime import date, datetime
from math import sqrt
from statistics import mean, median
from typing import Any

from app.services.profiling.models import ColumnProfile
from app.services.profiling.type_detection import classify_semantic, detect_storage_type, normalized_unique_names


def _missing(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _number(value: Any) -> float | None:
    if _missing(value) or isinstance(value, bool):
        return None
    try:
        return float(str(value).replace(",", "").replace("%", ""))
    except (TypeError, ValueError):
        return None


def _date_value(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        for pattern in ("%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(text, pattern)
            except ValueError:
                continue
    return None


def _safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def profile_columns(rows: list[dict[str, Any]], row_count: int | None, missing_counts: dict[str, int] | None = None) -> list[ColumnProfile]:
    if not rows:
        return []
    names = list(rows[0].keys())
    normalized = normalized_unique_names(names)
    observed_count = len(rows)
    profiles: list[ColumnProfile] = []
    for original_name, normalized_name in zip(names, normalized):
        values = [row.get(original_name) for row in rows]
        present = [value for value in values if not _missing(value)]
        inferred_type = detect_storage_type(values)
        unique_values = {_safe(value) for value in present}
        unique_count = len(unique_values)
        uniqueness_percentage = round(unique_count / max(1, len(present)) * 100, 2)
        semantic_type, confidence, evidence = classify_semantic(original_name, values, inferred_type, unique_count / max(1, len(present)))
        null_count = (missing_counts or {}).get(original_name, sum(_missing(value) for value in values))
        denominator = row_count or observed_count
        null_percentage = round(null_count / max(1, denominator) * 100, 2)
        top_values = [{"value": _safe(value), "count": count, "percentage": round(count / max(1, len(present)) * 100, 2)} for value, count in Counter(_safe(value) for value in present).most_common(10)]
        statistics: dict[str, Any] = {"scope": "preview" if row_count is not None and row_count > observed_count else "exact"}
        numeric_values = [number for value in present if (number := _number(value)) is not None]
        if inferred_type in {"integer", "float"} and numeric_values:
            ordered = sorted(numeric_values)
            q1 = ordered[max(0, int((len(ordered) - 1) * 0.25))]
            q3 = ordered[max(0, int((len(ordered) - 1) * 0.75))]
            iqr = q3 - q1
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            outliers = [number for number in numeric_values if number < lower or number > upper]
            standard_deviation = sqrt(mean([(number - mean(numeric_values)) ** 2 for number in numeric_values])) if len(numeric_values) > 1 else 0.0
            statistics.update({"minimum": min(numeric_values), "maximum": max(numeric_values), "mean": round(mean(numeric_values), 6), "median": median(numeric_values), "standard_deviation": round(standard_deviation, 6), "quantiles": {"q25": q1, "q50": median(numeric_values), "q75": q3}, "iqr": iqr})
            outlier_count = len(outliers)
            outlier_percentage = round(outlier_count / max(1, len(numeric_values)) * 100, 2)
            outlier_method = "IQR"
        elif inferred_type in {"date", "datetime"}:
            dates = [parsed for value in present if (parsed := _date_value(value)) is not None]
            if dates:
                span_days = (max(dates) - min(dates)).days
                statistics.update({"minimum": min(dates).date().isoformat(), "maximum": max(dates).date().isoformat(), "date_range_days": span_days, "granularity": "yearly" if span_days > 3650 else "monthly" if span_days > 90 else "weekly" if span_days > 14 else "daily"})
            outlier_count = 0
            outlier_percentage = 0.0
            outlier_method = None
        else:
            outlier_count = 0
            outlier_percentage = 0.0
            outlier_method = None
        if null_percentage >= 50:
            evidence.append(f"{null_percentage:.1f}% of rows are missing this value.")
        profiles.append(ColumnProfile(original_name=original_name, normalized_name=normalized_name, inferred_type=inferred_type, semantic_type=semantic_type, confidence=round(confidence, 2), evidence=evidence, null_count=null_count, null_percentage=null_percentage, unique_count=unique_count, uniqueness_percentage=uniqueness_percentage, sample_values=[_safe(value) for value in present[:8]], statistics=statistics, top_values=top_values, outlier_count=outlier_count, outlier_percentage=outlier_percentage, outlier_method=outlier_method))
    return profiles
