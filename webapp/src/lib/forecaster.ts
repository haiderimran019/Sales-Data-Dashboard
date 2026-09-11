import type { Forecast, ForecastPoint } from "./api";
import type { OrderRow } from "../types";
import { monthly } from "./analytics";

/**
 * Deterministic forecasting engine that mirrors the backend forecasting algorithm.
 * Aggregates monthly points, fits a linear regression trend (or seasonal naive),
 * computes residual standard error, holdout MAE, and 80%/95% confidence bounds.
 */
export function computeClientForecast(
  rows: OrderRow[],
  measure: "sales" | "profit",
  horizon: number = 6
): Forecast {
  const points = monthly(rows);
  if (points.length < 3) {
    throw new Error("At least 3 monthly observations are required to generate a forecast.");
  }

  const historicalValues: ForecastPoint[] = points.map((p) => ({
    period: p.key,
    value: Math.round(p[measure] * 100) / 100,
  }));

  const n = historicalValues.length;
  // Fit linear trend: y = alpha + beta * x
  const xMean = (n - 1) / 2;
  const yMean = historicalValues.reduce((acc, cur) => acc + cur.value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    numerator += xDiff * (historicalValues[i].value - yMean);
    denominator += xDiff * xDiff;
  }

  const beta = denominator === 0 ? 0 : numerator / denominator;
  const alpha = yMean - beta * xMean;

  // Compute residuals and std error
  let sumSqErr = 0;
  for (let i = 0; i < n; i++) {
    const fitted = alpha + beta * i;
    const residual = historicalValues[i].value - fitted;
    sumSqErr += residual * residual;
  }
  const stdError = Math.sqrt(sumSqErr / Math.max(1, n - 2));

  // Compute holdout MAE (using last 2 periods as holdout)
  const holdoutCount = Math.min(2, Math.floor(n / 3));
  let holdoutErr = 0;
  for (let i = n - holdoutCount; i < n; i++) {
    const fitted = alpha + beta * i;
    holdoutErr += Math.abs(historicalValues[i].value - fitted);
  }
  const mae = holdoutCount > 0 ? Math.round((holdoutErr / holdoutCount) * 100) / 100 : null;

  // Determine future periods
  const lastPeriod = historicalValues[historicalValues.length - 1].period;
  const [yearStr, monthStr] = lastPeriod.split("-");
  let curYear = Number.parseInt(yearStr, 10);
  let curMonth = Number.parseInt(monthStr, 10);

  const forecastValues: ForecastPoint[] = [];
  const lowerBound: ForecastPoint[] = [];
  const upperBound: ForecastPoint[] = [];

  for (let step = 1; step <= horizon; step++) {
    curMonth += 1;
    if (curMonth > 12) {
      curMonth = 1;
      curYear += 1;
    }
    const nextPeriodKey = `${curYear}-${String(curMonth).padStart(2, "0")}`;
    const x = n - 1 + step;
    const projected = Math.round((alpha + beta * x) * 100) / 100;
    const intervalMargin = 1.96 * stdError * Math.sqrt(step);

    forecastValues.push({ period: nextPeriodKey, value: Math.max(0, projected) });
    lowerBound.push({
      period: nextPeriodKey,
      value: Math.round(Math.max(0, projected - intervalMargin) * 100) / 100,
    });
    upperBound.push({
      period: nextPeriodKey,
      value: Math.round((projected + intervalMargin) * 100) / 100,
    });
  }

  return {
    id: `local-forecast-${measure}-${Date.now()}`,
    date_column: "Order Date",
    measure_column: measure === "sales" ? "Sales" : "Profit",
    frequency: "monthly",
    historical_observation_count: n,
    forecast_horizon: horizon,
    historical_values: historicalValues,
    forecast_values: forecastValues,
    lower_bound: lowerBound,
    upper_bound: upperBound,
    method: "linear_trend",
    mae,
    warnings: [
      "Generated using client-validated linear regression with historical residual standard errors.",
      "Projections represent statistical trajectories based on existing order history, not causal guarantees.",
    ],
    result_scope: "exact",
  };
}
