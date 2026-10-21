from typing import Any


def quality_score(*, missing_percentage: float, duplicate_percentage: float, outlier_percentage: float, invalid_percentage: float = 0.0) -> tuple[float, dict[str, Any]]:
    missing_penalty = min(45.0, missing_percentage * 0.45)
    duplicate_penalty = min(25.0, duplicate_percentage * 0.25)
    outlier_penalty = min(10.0, outlier_percentage * 0.10)
    invalid_penalty = min(20.0, invalid_percentage * 0.20)
    score = round(max(0.0, 100.0 - missing_penalty - duplicate_penalty - outlier_penalty - invalid_penalty), 1)
    return score, {
        "formula": "100 - min(45, missing_percentage*0.45) - min(25, duplicate_percentage*0.25) - min(10, outlier_percentage*0.10) - min(20, invalid_percentage*0.20)",
        "missing_penalty": round(missing_penalty, 2),
        "duplicate_penalty": round(duplicate_penalty, 2),
        "outlier_penalty": round(outlier_penalty, 2),
        "invalid_penalty": round(invalid_penalty, 2),
    }
