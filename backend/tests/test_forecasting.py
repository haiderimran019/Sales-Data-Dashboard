from datetime import datetime

from app.services.forecasting.service import ForecastUnavailable, detect_frequency, forecast_series


def rows(count: int = 12):
    return [{"date": f"2024-{index + 1:02d}-01", "sales": index * 10 + 100} for index in range(count)]


def test_frequency_detection() -> None:
    frequency, season = detect_frequency([datetime(2024, 1, index + 1) for index in range(3)])
    assert frequency == "daily"
    assert season == 7


def test_duplicate_aggregation_and_linear_forecast() -> None:
    data = rows(6) + [{"date": "2024-01-03", "sales": 5}]
    result = forecast_series(data, "date", "sales", horizon=3)

    assert result.frequency == "monthly"
    assert result.method == "linear_trend"
    assert result.historical_observation_count == 6
    assert len(result.forecast_values) == 3
    assert len(result.lower_bound) == len(result.upper_bound) == 3
    assert result.mae is not None
    assert any("Duplicate" in warning for warning in result.warnings)


def test_insufficient_data_is_explicit() -> None:
    try:
        forecast_series([{"date": "2024-01-01", "sales": 1}], "date", "sales")
    except ForecastUnavailable as error:
        assert "three" in str(error)
    else:
        raise AssertionError("Expected unavailable forecast")


def test_estimated_scope_warning() -> None:
    result = forecast_series(rows(), "date", "sales", horizon=2, result_scope="estimated")
    assert result.result_scope == "estimated"
    assert any("estimated" in warning for warning in result.warnings)
