import re
from datetime import date, datetime
from typing import Any


def normalize_name(name: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower()).strip("_")
    return normalized or "column"


def normalized_unique_names(names: list[str]) -> list[str]:
    counts: dict[str, int] = {}
    result: list[str] = []
    for name in names:
        base = normalize_name(name)
        counts[base] = counts.get(base, 0) + 1
        result.append(base if counts[base] == 1 else f"{base}_{counts[base]}")
    return result


def _non_empty(values: list[Any]) -> list[Any]:
    return [value for value in values if value is not None and str(value).strip()]


def _is_bool(value: Any) -> bool:
    return isinstance(value, bool) or str(value).strip().lower() in {"true", "false", "yes", "no"}


def _is_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    try:
        float(str(value).replace(",", "").replace("%", ""))
        return True
    except (TypeError, ValueError):
        return False


def _is_date(value: Any) -> bool:
    if isinstance(value, (date, datetime)):
        return True
    text = str(value).strip()
    if not text or len(text) < 6:
        return False
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
        return True
    except ValueError:
        for pattern in ("%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"):
            try:
                datetime.strptime(text, pattern)
                return True
            except ValueError:
                continue
    return False


def detect_storage_type(values: list[Any]) -> str:
    present = _non_empty(values)
    if not present:
        return "unknown"
    if all(_is_bool(value) for value in present):
        return "boolean"
    if all(_is_date(value) for value in present):
        return "datetime" if any("T" in str(value) or ":" in str(value) for value in present) else "date"
    if all(_is_number(value) for value in present):
        numeric = [float(str(value).replace(",", "").replace("%", "")) for value in present]
        return "integer" if all(number.is_integer() for number in numeric) else "float"
    return "string"


def classify_semantic(name: str, values: list[Any], inferred_type: str, unique_ratio: float) -> tuple[str, float, list[str]]:
    normalized = normalize_name(name)
    present = _non_empty(values)
    evidence: list[str] = []
    identifier_signal = bool(re.search(r"(^|_)(id|key|code|number|no|sku|zip|postal|phone|invoice)($|_)", normalized))
    if identifier_signal:
        evidence.append("Column name contains an identifier or code pattern.")
    if inferred_type in {"date", "datetime"} or re.search(r"(^|_)(date|time|month|year|week)($|_)", normalized):
        evidence.append("Values or column name indicate temporal data.")
        return ("date" if inferred_type == "date" else "datetime", 0.93 if inferred_type in {"date", "datetime"} else 0.7, evidence)
    if identifier_signal and unique_ratio >= 0.7:
        evidence.append(f"{unique_ratio:.1%} of observed values are unique.")
        return "identifier", min(0.98, 0.72 + unique_ratio * 0.25), evidence
    if re.search(r"(^|_)(email|e_mail)($|_)", normalized) or (present and sum("@" in str(value) for value in present) / len(present) > 0.8):
        evidence.append("Values match an email-address pattern.")
        return "email", 0.95, evidence
    if re.search(r"(^|_)(phone|mobile|telephone)($|_)", normalized):
        evidence.append("Column name indicates telephone data.")
        return "phone", 0.82, evidence
    if re.search(r"(^|_)(country|state|city|region|address|location|postal|zip)($|_)", normalized):
        evidence.append("Column name indicates geographic data.")
        return "location", 0.84, evidence
    if re.search(r"(^|_)(percent|percentage|pct|rate|margin|discount)($|_)", normalized) or (present and sum(str(value).strip().endswith("%") for value in present) / len(present) > 0.6):
        evidence.append("Column name or values indicate a percentage/rate.")
        return "percentage", 0.88, evidence
    if inferred_type == "boolean":
        evidence.append("Values are boolean-like.")
        return "boolean", 0.95, evidence
    if inferred_type in {"integer", "float"}:
        evidence.append("Values are numeric and not strongly identifier-like.")
        return "numeric_measure", 0.7, evidence
    if inferred_type == "string" and unique_ratio <= 0.5:
        evidence.append("Repeated text values indicate a categorical dimension.")
        return "categorical_dimension", 0.78, evidence
    if inferred_type == "string":
        evidence.append("Text values have high variety and are not clearly identifiers.")
        return "text", 0.6, evidence
    return "unknown", 0.35, ["Insufficient evidence for a more specific semantic class."]
