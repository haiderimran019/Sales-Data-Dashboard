from itertools import combinations
from typing import Any


def detect_relationships(datasets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for left, right in combinations(datasets, 2):
        for left_column in left.get("columns", []):
            for right_column in right.get("columns", []):
                same_name = left_column["normalized_name"] == right_column["normalized_name"]
                identifier_match = left_column["semantic_type"] == "identifier" or right_column["semantic_type"] == "identifier"
                if not (same_name or identifier_match):
                    continue
                left_values = {str(value) for value in left_column.get("sample_values", []) if value not in (None, "")}
                right_values = {str(value) for value in right_column.get("sample_values", []) if value not in (None, "")}
                overlap = len(left_values & right_values) / max(1, min(len(left_values), len(right_values)))
                if overlap == 0 and not same_name:
                    continue
                left_unique = left_column.get("uniqueness_percentage", 0) >= 95
                right_unique = right_column.get("uniqueness_percentage", 0) >= 95
                relation_type = "one-to-one" if left_unique and right_unique else "one-to-many" if left_unique else "many-to-one" if right_unique else "unknown"
                confidence = min(0.98, 0.45 + (0.25 if same_name else 0) + overlap * 0.3 + (0.1 if left_unique or right_unique else 0))
                candidates.append({"left_dataset": left["name"], "left_column": left_column["original_name"], "right_dataset": right["name"], "right_column": right_column["original_name"], "relationship_type": relation_type, "confidence": round(confidence, 2), "evidence": {"matching_names": same_name, "sample_overlap_percentage": round(overlap * 100, 1), "left_unique": left_unique, "right_unique": right_unique}})
    return candidates
