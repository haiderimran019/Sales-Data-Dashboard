from typing import Any

DOMAIN_TERMS = {
    "Sales": {"sales", "revenue", "order", "quantity", "product", "customer", "profit"},
    "Marketing": {"campaign", "spend", "impression", "click", "conversion", "lead", "cac", "roi"},
    "Finance": {"revenue", "expense", "margin", "cash", "balance", "asset", "liability", "ratio"},
    "HR": {"employee", "department", "hire", "salary", "compensation", "attrition", "tenure"},
    "Inventory": {"stock", "inventory", "sku", "supplier", "turnover", "stockout", "demand"},
    "Operations": {"operation", "process", "delivery", "shipment", "cycle", "incident", "facility"},
    "Customers": {"customer", "client", "account", "segment", "churn", "lifetime"},
    "Logistics": {"shipment", "shipping", "carrier", "warehouse", "delivery", "route", "tracking"},
    "Healthcare": {"patient", "diagnosis", "treatment", "clinic", "medication", "provider"},
    "Education": {"student", "course", "grade", "teacher", "school", "enrollment"},
}


def classify_domain(columns: list[dict[str, Any]]) -> tuple[str, float, list[str]]:
    scores: dict[str, int] = {domain: 0 for domain in DOMAIN_TERMS}
    evidence: dict[str, list[str]] = {domain: [] for domain in DOMAIN_TERMS}
    for column in columns:
        tokens = set(column["normalized_name"].split("_"))
        for domain, terms in DOMAIN_TERMS.items():
            matches = sorted(tokens & terms)
            if matches:
                scores[domain] += len(matches)
                evidence[domain].append(f"{column['original_name']} matches: {', '.join(matches)}")
    if not scores or max(scores.values()) == 0:
        return "General/Unknown", 0.25, ["No strong domain-specific column-name evidence was found."]
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    domain, score = ordered[0]
    second = ordered[1][1] if len(ordered) > 1 else 0
    confidence = min(0.95, 0.5 + score / max(1, len(columns)) * 0.35 + (0.1 if score > second else 0))
    return domain, round(confidence, 2), evidence[domain][:8]
