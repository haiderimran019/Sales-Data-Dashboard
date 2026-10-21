from dataclasses import dataclass
from datetime import date, datetime, timedelta
from math import sqrt
from statistics import mean
from typing import Any


class ForecastUnavailable(ValueError):
    pass


@dataclass
class ForecastOutput:
    date_column: str
    measure_column: str
    frequency: str
    historical_observation_count: int
    forecast_horizon: int
    historical_values: list[dict[str, Any]]
    forecast_values: list[dict[str, Any]]
    method: str
    lower_bound: list[dict[str, Any]]
    upper_bound: list[dict[str, Any]]
    mae: float | None
    warnings: list[str]
    result_scope: str


def _parse_date(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = str(value or "").strip()
    for parser in (datetime.fromisoformat,):
        try:
            return parser(text.replace("Z", "+00:00"))
        except ValueError:
            pass
    for pattern in ("%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(text, pattern)
        except ValueError:
            pass
    return None


def _number(value: Any) -> float | None:
    try:
        return float(str(value).replace(",", "").replace("%", ""))
    except (TypeError, ValueError):
        return None


def detect_frequency(dates: list[datetime]) -> tuple[str, int]:
    if len(dates) < 2:
        raise ForecastUnavailable("At least two dated observations are required")
    ordered = sorted(set(dates))
    gaps = [(right - left).days for left, right in zip(ordered, ordered[1:]) if (right - left).days > 0]
    if not gaps:
        raise ForecastUnavailable("Distinct dated observations are required")
    typical = sorted(gaps)[len(gaps) // 2]
    if typical <= 2:
        return "daily", 7
    if typical <= 10:
        return "weekly", 7
    return "monthly", 12


def _period_key(value: datetime, frequency: str) -> str:
    if frequency == "daily":
        return value.strftime("%Y-%m-%d")
    if frequency == "weekly":
        return value.strftime("%G-W%V")
    return value.strftime("%Y-%m")


def _next_period(value: datetime, frequency: str) -> datetime:
    if frequency == "daily":
        return value + timedelta(days=1)
    if frequency == "weekly":
        return value + timedelta(days=7)
    month = value.month % 12 + 1
    year = value.year + (1 if value.month == 12 else 0)
    return value.replace(year=year, month=month, day=1)


def _aggregate(rows: list[dict[str, Any]], date_column: str, measure_column: str) -> tuple[list[tuple[datetime, float]], str, int]:
    parsed = []
    for row in rows:
        when = _parse_date(row.get(date_column))
        number = _number(row.get(measure_column))
        if when and number is not None:
            parsed.append((when, number))
    if len(parsed) < 3:
        raise ForecastUnavailable("At least three valid dated numeric observations are required")
    frequency, _ = detect_frequency([when for when, _ in parsed])
    grouped: dict[str, tuple[datetime, float]] = {}
    for when, number in parsed:
        key = _period_key(when, frequency)
        existing = grouped.get(key)
        grouped[key] = (when if existing is None else min(existing[0], when), number + (existing[1] if existing else 0))
    values = sorted(grouped.values(), key=lambda item: item[0])
    return values, frequency, len(parsed)


def _linear_forecast(values: list[float], horizon: int) -> tuple[list[float], list[float]]:
    count = len(values)
    x_mean = (count - 1) / 2
    y_mean = mean(values)
    denominator = sum((index - x_mean) ** 2 for index in range(count)) or 1
    slope = sum((index - x_mean) * (value - y_mean) for index, value in enumerate(values)) / denominator
    intercept = y_mean - slope * x_mean
    fitted = [intercept + slope * index for index in range(count)]
    residual = sqrt(mean([(actual - expected) ** 2 for actual, expected in zip(values, fitted)])) if count > 1 else 0.0
    predictions = [intercept + slope * (count + index) for index in range(horizon)]
    return predictions, [max(0.0, residual * 1.96 * sqrt(1 + index / max(1, horizon))) for index in range(horizon)]


def _seasonal_forecast(values: list[float], horizon: int, season_length: int) -> tuple[list[float], list[float]]:
    predictions = [values[-season_length + (index % season_length)] for index in range(horizon)]
    residuals = [values[index] - values[index - season_length] for index in range(season_length, len(values))]
    spread = sqrt(mean([residual * residual for residual in residuals])) if residuals else 0.0
    return predictions, [spread * 1.96 for _ in range(horizon)]


def _mae(values: list[float], season_length: int, method: str) -> float | None:
    holdout = min(max(2, season_length), len(values) // 3)
    if len(values) - holdout < 3:
        return None
    train, actual = values[:-holdout], values[-holdout:]
    if method == "seasonal_naive" and len(train) >= season_length:
        predicted = [train[-season_length + (index % season_length)] for index in range(holdout)]
    else:
        predicted, _ = _linear_forecast(train, holdout)
    return mean(abs(expected - predicted_value) for expected, predicted_value in zip(actual, predicted))


def forecast_series(rows: list[dict[str, Any]], date_column: str, measure_column: str, horizon: int = 6, result_scope: str = "exact") -> ForecastOutput:
    if horizon < 1 or horizon > 12:
        raise ForecastUnavailable("Forecast horizon must be between 1 and 12 periods")
    historical, frequency, raw_count = _aggregate(rows, date_column, measure_column)
    dates = [when for when, _ in historical]
    values = [number for _, number in historical]
    _, season_length = detect_frequency(dates)
    if len(values) >= max(2 * season_length, 12):
        method = "seasonal_naive"
        predictions, spreads = _seasonal_forecast(values, horizon, season_length)
    elif len(values) >= 3:
        method = "linear_trend"
        predictions, spreads = _linear_forecast(values, horizon)
    else:
        raise ForecastUnavailable("Insufficient history for a stable forecast")
    warnings = []
    if len(historical) < raw_count:
        warnings.append("Duplicate observations were aggregated into frequency periods.")
    expected_gap = 1 if frequency == "daily" else 7 if frequency == "weekly" else 28
    if any((right - left).days > expected_gap * 1.5 for left, right in zip(dates, dates[1:])):
        warnings.append("Missing historical periods were retained as gaps; no values were imputed.")
    if len(historical) < 2 * season_length:
        warnings.append("History is shorter than two seasonal cycles; a linear trend was used.")
    if result_scope != "exact":
        warnings.append("Forecast is based on estimated/sample-based analytical input.")
    last_date = dates[-1]
    future_dates = []
    for _ in range(horizon):
        last_date = _next_period(last_date, frequency)
        future_dates.append(last_date)
    historical_values = [{"period": when.isoformat(), "value": value} for when, value in historical]
    forecast_values = [{"period": when.isoformat(), "value": value} for when, value in zip(future_dates, predictions)]
    lower = [{"period": when.isoformat(), "value": value - spread} for when, value, spread in zip(future_dates, predictions, spreads)]
    upper = [{"period": when.isoformat(), "value": value + spread} for when, value, spread in zip(future_dates, predictions, spreads)]
    return ForecastOutput(date_column=date_column, measure_column=measure_column, frequency=frequency, historical_observation_count=len(historical), forecast_horizon=horizon, historical_values=historical_values, forecast_values=forecast_values, method=method, lower_bound=lower, upper_bound=upper, mae=_mae(values, season_length, method), warnings=warnings, result_scope=result_scope)
