import type { OrderRow } from "../types";
import { monthly } from "./analytics";

/**
 * Validated monthly forecasting engine.
 *
 * The engine works in three stages, and the order matters:
 *
 *   1. Every candidate model is backtested with a rolling origin, so each error
 *      it records comes from a forecast made without having seen the actual.
 *   2. A model is selected on an early block of origins, then scored on a later
 *      block it never influenced. This is what keeps the headline accuracy
 *      figure honest: tuning and scoring never look at the same months.
 *   3. Prediction intervals are built from the spread of observed backtest
 *      errors at each horizon, not from the model's own in-sample residuals,
 *      which would badly understate real forecast uncertainty.
 *
 * Reported accuracy always travels with the seasonal-naive baseline measured on
 * the same months, so a reader can see whether the model earned its complexity.
 */

export type SeriesPoint = { period: string; value: number };

export type Measure = "sales" | "profit";

/** A model is a pure function: given history, return `horizon` future values. */
type ModelFn = (history: number[], horizon: number) => number[];

type Candidate = { id: string; label: string; family: string; fit: ModelFn };

export type HorizonError = {
  horizon: number;
  mae: number;
  mape: number | null;
  count: number;
};

export type AccuracyScore = {
  /** Mean absolute error, in the units of the series. */
  mae: number;
  /**
   * Mean absolute percentage error, or null when the series has non-positive
   * actuals, where a percentage error is undefined or misleading.
   */
  mape: number | null;
  /**
   * Mean absolute scaled error: forecast error divided by the average
   * year-over-year change in the training window. Below 1.0 beats that
   * reference, above 1.0 does not. Stays meaningful when a series crosses zero.
   */
  mase: number | null;
  /** How many individual (origin, horizon) forecasts are behind these figures. */
  forecastCount: number;
};

export type LeaderboardRow = {
  id: string;
  label: string;
  family: string;
  /** Selection-stage MASE. Lower is better; this is what picked the winner. */
  selectionMase: number | null;
  selectionMae: number;
  selected: boolean;
};

export type ReferenceScore = {
  id: string;
  label: string;
  /** Scored on the same holdout months as the selected model. */
  score: AccuracyScore;
  selected: boolean;
};

export type ValidationDesign = "selection-holdout" | "rolling-origin" | "insufficient-history";

export type ValidationReport = {
  design: ValidationDesign;
  /** Plain-language description of how these numbers were produced. */
  designNote: string;
  seasonalPeriod: number;
  observedMonths: number;
  trainingMonths: number;
  selectionOrigins: number;
  holdoutOrigins: number;
  holdoutRange: { start: string; end: string } | null;
  /** Out-of-sample accuracy of the selected model. */
  selected: AccuracyScore;
  /** The same measurement, over the same months, for the baseline. */
  baseline: AccuracyScore;
  baselineLabel: string;
  /** Percentage reduction in MAE against the baseline. Negative means worse. */
  skillVsBaseline: number | null;
  perHorizon: HorizonError[];
  candidatesEvaluated: number;
  /** The strongest candidates at the selection stage, best first. */
  leaderboard: LeaderboardRow[];
  /**
   * Fixed reference models scored on the same holdout as the selected model,
   * so the headline figure can be read against a like-for-like comparison.
   */
  references: ReferenceScore[];
  reliability: "strong" | "moderate" | "weak" | "unvalidated";
  reliabilityHeadline: string;
  reliabilityDetail: string;
};

export type Forecast = {
  measure: Measure;
  measureLabel: string;
  horizon: number;
  seasonalPeriod: number;
  method: string;
  methodLabel: string;
  methodFamily: string;
  historicalValues: SeriesPoint[];
  forecastValues: SeriesPoint[];
  lower80: SeriesPoint[];
  upper80: SeriesPoint[];
  lower95: SeriesPoint[];
  upper95: SeriesPoint[];
  intervalBasis: string;
  validation: ValidationReport;
  warnings: string[];
};

const SEASONAL_PERIOD = 12;
/** Horizon the backtest scores over, and the furthest we can justify an interval. */
const BACKTEST_HORIZON = 6;
/** Seasonal models need two complete cycles before they mean anything. */
const MIN_SEASONAL_TRAINING = 2 * SEASONAL_PERIOD;
const MIN_TOTAL_MONTHS = 4;

/* ------------------------------------------------------------------- models */

function linearFit(y: number[]): { intercept: number; slope: number } {
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    numerator += dx * (y[i] - yMean);
    denominator += dx * dx;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  return { intercept: yMean - slope * xMean, slope };
}

const naive: ModelFn = (history, horizon) =>
  Array.from({ length: horizon }, () => history[history.length - 1]);

const seasonalNaive: ModelFn = (history, horizon) => {
  if (history.length < SEASONAL_PERIOD) return naive(history, horizon);
  return Array.from(
    { length: horizon },
    (_, i) => history[history.length - SEASONAL_PERIOD + (i % SEASONAL_PERIOD)],
  );
};

const linearTrend: ModelFn = (history, horizon) => {
  const { intercept, slope } = linearFit(history);
  const n = history.length;
  return Array.from({ length: horizon }, (_, i) => intercept + slope * (n + i));
};

type HoltWintersOptions = {
  alpha: number;
  beta: number;
  gamma: number;
  /** Trend damping. 1 leaves the trend linear; below 1 flattens it as the horizon grows. */
  phi: number;
  seasonality: "additive" | "multiplicative";
};

/**
 * Holt-Winters triple exponential smoothing with an optionally damped trend.
 * Level, trend and seasonal components update one observation at a time, so the
 * model tracks drift instead of assuming a single fixed slope forever.
 */
function holtWinters(options: HoltWintersOptions): ModelFn {
  const { alpha, beta, gamma, phi, seasonality } = options;
  const multiplicative = seasonality === "multiplicative";

  return (history, horizon) => {
    const n = history.length;
    if (n < MIN_SEASONAL_TRAINING) return linearTrend(history, horizon);

    const firstCycle = history.slice(0, SEASONAL_PERIOD);
    const secondCycle = history.slice(SEASONAL_PERIOD, 2 * SEASONAL_PERIOD);
    const firstMean = firstCycle.reduce((a, b) => a + b, 0) / SEASONAL_PERIOD;
    const secondMean = secondCycle.reduce((a, b) => a + b, 0) / SEASONAL_PERIOD;

    // A multiplicative season is undefined once the level reaches zero.
    if (multiplicative && firstMean <= 0) return linearTrend(history, horizon);

    let level = firstMean;
    let trend = (secondMean - firstMean) / SEASONAL_PERIOD;
    const season = firstCycle.map((value) =>
      multiplicative ? value / firstMean : value - firstMean,
    );

    const guard = (value: number) => (Math.abs(value) < 1e-6 ? 1e-6 : value);

    for (let i = 0; i < n; i++) {
      const slot = i % SEASONAL_PERIOD;
      const previousLevel = level;
      const observed = history[i];

      if (multiplicative) {
        level = alpha * (observed / guard(season[slot])) + (1 - alpha) * (level + phi * trend);
        trend = beta * (level - previousLevel) + (1 - beta) * phi * trend;
        season[slot] = gamma * (observed / guard(level)) + (1 - gamma) * season[slot];
      } else {
        level = alpha * (observed - season[slot]) + (1 - alpha) * (level + phi * trend);
        trend = beta * (level - previousLevel) + (1 - beta) * phi * trend;
        season[slot] = gamma * (observed - level) + (1 - gamma) * season[slot];
      }
    }

    return Array.from({ length: horizon }, (_, i) => {
      const step = i + 1;
      // A damped trend accumulates as phi + phi^2 + ... + phi^step.
      let damped = 0;
      for (let k = 1; k <= step; k++) damped += Math.pow(phi, k);
      const slot = (n + step - 1) % SEASONAL_PERIOD;
      return multiplicative
        ? (level + trend * damped) * season[slot]
        : level + trend * damped + season[slot];
    });
  };
}

/**
 * The candidate library. Holt-Winters variants are enumerated over a coarse
 * grid rather than numerically optimised: with only a few dozen monthly
 * observations, a coarse grid scored out-of-sample generalises better than a
 * tightly optimised fit, and it keeps selection cheap enough to run in-browser.
 */
function buildCandidates(): Candidate[] {
  const candidates: Candidate[] = [
    { id: "naive", label: "Naive (last month repeated)", family: "Baseline", fit: naive },
    {
      id: "seasonal-naive",
      label: "Seasonal naive (same month last year)",
      family: "Baseline",
      fit: seasonalNaive,
    },
    { id: "linear-trend", label: "Linear trend", family: "Trend", fit: linearTrend },
  ];

  for (const alpha of [0.2, 0.3, 0.4]) {
    for (const beta of [0, 0.05, 0.15]) {
      for (const gamma of [0.3, 0.5]) {
        for (const phi of [1, 0.9]) {
          for (const seasonality of ["additive", "multiplicative"] as const) {
            const damped = phi < 1 ? ", damped" : "";
            candidates.push({
              id: `holt-winters-${seasonality}-a${alpha}-b${beta}-g${gamma}-p${phi}`,
              label: `Holt-Winters (${seasonality}${damped})`,
              family: "Holt-Winters seasonal smoothing",
              fit: holtWinters({ alpha, beta, gamma, phi, seasonality }),
            });
          }
        }
      }
    }
  }

  return candidates;
}

/* ----------------------------------------------------------------- scoring */

type ForecastError = { horizon: number; actual: number; predicted: number; signed: number };
type OriginResult = { origin: number; scale: number | null; errors: ForecastError[] };

/**
 * Average absolute year-over-year change inside the training window. This is
 * the MASE scaling factor: how much a "same month last year" guess would
 * typically miss by, computed only from data the model was allowed to see.
 */
function scalingFactor(training: number[]): number | null {
  if (training.length <= SEASONAL_PERIOD) return null;
  let total = 0;
  let count = 0;
  for (let i = SEASONAL_PERIOD; i < training.length; i++) {
    total += Math.abs(training[i] - training[i - SEASONAL_PERIOD]);
    count += 1;
  }
  if (!count) return null;
  const scale = total / count;
  return scale > 0 ? scale : null;
}

/** Runs a model across every origin and collects its out-of-sample errors. */
function backtest(values: number[], model: ModelFn, origins: number[]): OriginResult[] {
  const results: OriginResult[] = [];
  for (const origin of origins) {
    const available = Math.min(BACKTEST_HORIZON, values.length - origin);
    if (available < 1) continue;
    const training = values.slice(0, origin);
    const predictions = model(training, BACKTEST_HORIZON);
    const errors: ForecastError[] = [];
    for (let step = 0; step < available; step++) {
      const actual = values[origin + step];
      const predicted = predictions[step];
      if (!Number.isFinite(predicted)) continue;
      errors.push({ horizon: step + 1, actual, predicted, signed: actual - predicted });
    }
    results.push({ origin, scale: scalingFactor(training), errors });
  }
  return results;
}

function flatten(results: OriginResult[]): ForecastError[] {
  return results.flatMap((result) => result.errors);
}

function score(results: OriginResult[]): AccuracyScore {
  const errors = flatten(results);
  if (!errors.length) {
    return { mae: Number.NaN, mape: null, mase: null, forecastCount: 0 };
  }

  const mae = errors.reduce((a, e) => a + Math.abs(e.signed), 0) / errors.length;

  // MAPE is only reported when nearly every actual is strictly positive;
  // otherwise it is an unstable and misleading summary.
  const positives = errors.filter((e) => e.actual > 0);
  const mape =
    positives.length >= errors.length * 0.95 && positives.length > 0
      ? (positives.reduce((a, e) => a + Math.abs(e.signed / e.actual), 0) / positives.length) * 100
      : null;

  // MASE scales each origin's errors by that origin's own training window.
  let scaledTotal = 0;
  let scaledCount = 0;
  for (const result of results) {
    if (!result.scale) continue;
    for (const e of result.errors) {
      scaledTotal += Math.abs(e.signed) / result.scale;
      scaledCount += 1;
    }
  }

  return {
    mae,
    mape,
    mase: scaledCount ? scaledTotal / scaledCount : null,
    forecastCount: errors.length,
  };
}

function perHorizonErrors(results: OriginResult[]): HorizonError[] {
  const buckets = new Map<number, ForecastError[]>();
  for (const e of flatten(results)) {
    const bucket = buckets.get(e.horizon) ?? [];
    bucket.push(e);
    buckets.set(e.horizon, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([horizon, errors]) => {
      const positives = errors.filter((e) => e.actual > 0);
      return {
        horizon,
        mae: errors.reduce((a, e) => a + Math.abs(e.signed), 0) / errors.length,
        mape:
          positives.length === errors.length && errors.length > 0
            ? (positives.reduce((a, e) => a + Math.abs(e.signed / e.actual), 0) / errors.length) *
              100
            : null,
        count: errors.length,
      };
    });
}

/* --------------------------------------------------------------- utilities */

function monthAfter(period: string, step: number): string {
  const [yearPart, monthPart] = period.split("-");
  const year = Number.parseInt(yearPart, 10);
  const monthIndex = Number.parseInt(monthPart, 10) - 1 + step;
  const nextYear = year + Math.floor(monthIndex / 12);
  const nextMonth = ((monthIndex % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

function quantile(sorted: number[], probability: number): number {
  if (!sorted.length) return Number.NaN;
  if (sorted.length === 1) return sorted[0];
  const position = probability * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
}

/* ------------------------------------------------------------------ public */

export function buildMonthlySeries(rows: OrderRow[], measure: Measure): SeriesPoint[] {
  return monthly(rows).map((point) => ({ period: point.key, value: round2(point[measure]) }));
}

export class InsufficientHistoryError extends Error {}

/**
 * Selects and validates a model for a monthly series, then projects it forward.
 *
 * @param series  Monthly observations, ascending, one entry per calendar month.
 * @param measure Which business measure the series represents.
 * @param horizon How many months to project.
 */
export function forecastSeries(
  series: SeriesPoint[],
  measure: Measure,
  horizon = 6,
): Forecast {
  const observed = series.length;
  if (observed < MIN_TOTAL_MONTHS) {
    throw new InsufficientHistoryError(
      `At least ${MIN_TOTAL_MONTHS} monthly observations are needed to validate a forecast; this selection has ${observed}.`,
    );
  }

  const values = series.map((point) => point.value);
  const warnings: string[] = [];

  // Origins are the points in time we pretend to forecast from. Seasonal models
  // need two cycles of training, so with enough history we start there.
  const minTraining =
    observed >= MIN_SEASONAL_TRAINING + 4
      ? MIN_SEASONAL_TRAINING
      : Math.max(3, Math.ceil(observed / 2));
  const allOrigins = range(minTraining, observed);

  let design: ValidationDesign;
  let selectionOrigins: number[];
  let holdoutOrigins: number[];

  if (allOrigins.length >= 8) {
    // Hold back the most recent block of origins and never let selection see it.
    const holdoutCount = Math.min(12, Math.floor(allOrigins.length / 2));
    selectionOrigins = allOrigins.slice(0, allOrigins.length - holdoutCount);
    holdoutOrigins = allOrigins.slice(allOrigins.length - holdoutCount);
    design = "selection-holdout";
  } else if (allOrigins.length >= 2) {
    selectionOrigins = allOrigins;
    holdoutOrigins = allOrigins;
    design = "rolling-origin";
    warnings.push(
      "History is too short to hold periods back from model selection, so the accuracy below is measured on the same months used to choose the model and should be read as optimistic.",
    );
  } else {
    selectionOrigins = [];
    holdoutOrigins = [];
    design = "insufficient-history";
    warnings.push(
      "There is not enough history to backtest this series, so no accuracy figure can be reported. Treat the projection as an illustration only.",
    );
  }

  if (observed < MIN_SEASONAL_TRAINING) {
    warnings.push(
      `Seasonal models need ${MIN_SEASONAL_TRAINING} months of history to fit a yearly pattern; only ${observed} are available, so seasonal candidates fall back to a trend fit.`,
    );
  }

  const candidates = buildCandidates();
  const baselineCandidate =
    candidates.find((candidate) => candidate.id === "seasonal-naive") ?? candidates[0];

  // ---- stage 1 + 2: select on the selection block, score on the holdout block
  let selected = baselineCandidate;
  const selectionScores: Array<{ candidate: Candidate; criterion: number; sc: AccuracyScore }> = [];
  if (selectionOrigins.length) {
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const results = backtest(values, candidate.fit, selectionOrigins);
      const candidateScore = score(results);
      // MASE is the selection criterion: scale-free, and valid even for a
      // series that crosses zero, where MAPE would blow up.
      const criterion =
        candidateScore.mase ?? (Number.isFinite(candidateScore.mae) ? candidateScore.mae : null);
      if (criterion === null) continue;
      selectionScores.push({ candidate, criterion, sc: candidateScore });
      if (criterion < bestScore) {
        bestScore = criterion;
        selected = candidate;
      }
    }
  }

  // Keep the best of each family plus the overall top entries, so the
  // leaderboard shows genuinely different approaches rather than 70 near-identical
  // parameter variants of the same one.
  const leaderboard: LeaderboardRow[] = (() => {
    const sorted = [...selectionScores].sort((a, b) => a.criterion - b.criterion);
    const seenFamily = new Set<string>();
    const picked: typeof sorted = [];
    for (const entry of sorted) {
      const key = `${entry.candidate.family}|${entry.candidate.label}`;
      if (seenFamily.has(key)) continue;
      seenFamily.add(key);
      picked.push(entry);
      if (picked.length >= 6) break;
    }
    return picked.map((entry) => ({
      id: entry.candidate.id,
      label: entry.candidate.label,
      family: entry.candidate.family,
      selectionMase: entry.sc.mase,
      selectionMae: entry.sc.mae,
      selected: entry.candidate.id === selected.id,
    }));
  })();

  const holdoutResults = backtest(values, selected.fit, holdoutOrigins);
  const baselineResults = backtest(values, baselineCandidate.fit, holdoutOrigins);
  const selectedScore = score(holdoutResults);
  const baselineScore = score(baselineResults);

  // Score the fixed reference models on the same holdout, so the published
  // comparison is like-for-like rather than taken from a different split.
  const references: ReferenceScore[] = ["naive", "seasonal-naive", "linear-trend"]
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      score:
        candidate.id === selected.id
          ? selectedScore
          : score(backtest(values, candidate.fit, holdoutOrigins)),
      selected: candidate.id === selected.id,
    }));
  if (!references.some((reference) => reference.selected)) {
    references.push({
      id: selected.id,
      label: selected.label,
      score: selectedScore,
      selected: true,
    });
  }

  const skillVsBaseline =
    Number.isFinite(selectedScore.mae) && Number.isFinite(baselineScore.mae) && baselineScore.mae > 0
      ? ((baselineScore.mae - selectedScore.mae) / baselineScore.mae) * 100
      : null;

  // ---- stage 3: intervals from the spread of observed backtest errors
  // Interval width uses every origin available, which gives the horizon buckets
  // more samples than the holdout block alone would.
  const intervalResults =
    design === "selection-holdout"
      ? backtest(values, selected.fit, allOrigins)
      : holdoutResults;
  const errorsByHorizon = new Map<number, number[]>();
  for (const e of flatten(intervalResults)) {
    const bucket = errorsByHorizon.get(e.horizon) ?? [];
    bucket.push(e.signed);
    errorsByHorizon.set(e.horizon, bucket);
  }

  const allSigned = flatten(intervalResults).map((e) => e.signed);
  const globalSigma = standardDeviation(allSigned);
  const empiricalHorizons = [...errorsByHorizon.entries()].filter(
    ([, bucket]) => bucket.length >= 6,
  ).length;

  let intervalBasis: string;
  if (design === "insufficient-history" || !allSigned.length) {
    intervalBasis = "No validated error history is available, so no interval is shown.";
  } else if (empiricalHorizons > 0) {
    intervalBasis = `Empirical quantiles of ${allSigned.length} out-of-sample backtest errors, bucketed by how many months ahead the forecast was made.`;
  } else {
    intervalBasis = `Normal approximation from the standard deviation of ${allSigned.length} out-of-sample backtest errors.`;
  }

  /** Interval offsets at a given horizon, as [low80, high80, low95, high95]. */
  const offsetsFor = (step: number): [number, number, number, number] => {
    if (!allSigned.length) return [0, 0, 0, 0];
    const bucket = errorsByHorizon.get(Math.min(step, BACKTEST_HORIZON));
    // Beyond the backtested horizon, widen the last validated bucket by the
    // square root of the extra distance rather than pretending it was measured.
    const stretch = step > BACKTEST_HORIZON ? Math.sqrt(step / BACKTEST_HORIZON) : 1;
    if (bucket && bucket.length >= 6) {
      const sorted = [...bucket].sort((a, b) => a - b);
      return [
        quantile(sorted, 0.1) * stretch,
        quantile(sorted, 0.9) * stretch,
        quantile(sorted, 0.025) * stretch,
        quantile(sorted, 0.975) * stretch,
      ];
    }
    const spread = globalSigma * Math.sqrt(step);
    return [-1.282 * spread, 1.282 * spread, -1.96 * spread, 1.96 * spread];
  };

  if (horizon > BACKTEST_HORIZON && allSigned.length) {
    warnings.push(
      `Accuracy was validated out to ${BACKTEST_HORIZON} months. Intervals beyond month ${BACKTEST_HORIZON} are extrapolated from the ${BACKTEST_HORIZON}-month error spread and carry more uncertainty than the figures above imply.`,
    );
  }

  // ---- project forward using the full history
  const projections = selected.fit(values, horizon);
  const lastPeriod = series[series.length - 1].period;
  // Only floor the projection at zero when the series itself never goes negative.
  const nonNegative = values.every((value) => value >= 0);
  const clamp = (value: number) => (nonNegative ? Math.max(0, value) : value);

  const forecastValues: SeriesPoint[] = [];
  const lower80: SeriesPoint[] = [];
  const upper80: SeriesPoint[] = [];
  const lower95: SeriesPoint[] = [];
  const upper95: SeriesPoint[] = [];

  for (let step = 1; step <= horizon; step++) {
    const period = monthAfter(lastPeriod, step);
    const point = projections[step - 1];
    const projected = Number.isFinite(point) ? clamp(point) : 0;
    const [low80, high80, low95, high95] = offsetsFor(step);
    forecastValues.push({ period, value: round2(projected) });
    lower80.push({ period, value: round2(clamp(projected + low80)) });
    upper80.push({ period, value: round2(projected + high80) });
    lower95.push({ period, value: round2(clamp(projected + low95)) });
    upper95.push({ period, value: round2(projected + high95) });
  }

  // ---- reliability verdict
  let reliability: ValidationReport["reliability"] = "unvalidated";
  let reliabilityHeadline = "Not validated";
  let reliabilityDetail =
    "There is not enough history to measure this model out of sample, so its accuracy is unknown.";

  if (design !== "insufficient-history" && selectedScore.forecastCount > 0) {
    const beatsBaseline = (skillVsBaseline ?? 0) > 0;
    const mape = selectedScore.mape;
    const mase = selectedScore.mase;
    const scaleHint =
      mape !== null
        ? `typical miss of ${mape.toFixed(1)}%`
        : `typical miss of ${Math.round(selectedScore.mae).toLocaleString()} per month`;

    if (mape !== null && mape < 15 && beatsBaseline) {
      reliability = "strong";
      reliabilityHeadline = "Reliable enough to plan against";
      reliabilityDetail = `A ${scaleHint} out of sample, and better than the seasonal baseline. Safe for directional planning, with the interval as the working range.`;
    } else if (
      beatsBaseline &&
      (mape !== null ? mape < 30 : mase !== null && mase < 1)
    ) {
      reliability = "moderate";
      reliabilityHeadline = "Useful for direction, not for precision";
      reliabilityDetail = `A ${scaleHint} out of sample. The shape of the seasonal pattern is trustworthy; individual month values are not. Plan against the interval, not the central line.`;
    } else {
      reliability = "weak";
      reliabilityHeadline = "Not reliable at this granularity";
      if (!beatsBaseline) {
        reliabilityDetail = `A ${scaleHint} out of sample, and no better than simply repeating last year's figures. The model adds no information over the naive baseline here.`;
      } else if (mape !== null && mape >= 30) {
        reliabilityDetail = `A ${scaleHint} out of sample. That beats the baseline, but an error this large means the monthly values are dominated by noise rather than a repeatable pattern. Use the annual total, not the monthly line.`;
      } else {
        reliabilityDetail = `A ${scaleHint} out of sample is too large to plan against at monthly granularity.`;
      }
    }
  }

  const designNote =
    design === "selection-holdout"
      ? `${candidates.length} candidate models were scored on ${selectionOrigins.length} rolling origins, then the winner was measured on ${holdoutOrigins.length} later origins held back from selection. Every figure below comes from forecasts made without seeing the actual.`
      : design === "rolling-origin"
        ? `${candidates.length} candidate models were scored across ${selectionOrigins.length} rolling origins. History is too short to hold months back from selection, so these figures are optimistic.`
        : "Not enough history to backtest.";

  const holdoutRange =
    holdoutOrigins.length && design !== "insufficient-history"
      ? {
          start: series[holdoutOrigins[0]]?.period ?? lastPeriod,
          end: lastPeriod,
        }
      : null;

  if (reliability === "weak") {
    warnings.push(
      "This measure did not pass validation. It is shown so the weakness is visible, not because the projection should be acted on.",
    );
  }

  return {
    measure,
    measureLabel: measure === "sales" ? "Revenue" : "Profit",
    horizon,
    seasonalPeriod: SEASONAL_PERIOD,
    method: selected.id,
    methodLabel: selected.label,
    methodFamily: selected.family,
    historicalValues: series,
    forecastValues,
    lower80,
    upper80,
    lower95,
    upper95,
    intervalBasis,
    warnings,
    validation: {
      design,
      designNote,
      seasonalPeriod: SEASONAL_PERIOD,
      observedMonths: observed,
      trainingMonths: minTraining,
      selectionOrigins: selectionOrigins.length,
      holdoutOrigins: holdoutOrigins.length,
      holdoutRange,
      selected: selectedScore,
      baseline: baselineScore,
      baselineLabel: baselineCandidate.label,
      skillVsBaseline,
      perHorizon: perHorizonErrors(holdoutResults),
      candidatesEvaluated: candidates.length,
      leaderboard,
      references,
      reliability,
      reliabilityHeadline,
      reliabilityDetail,
    },
  };
}

export function computeClientForecast(
  rows: OrderRow[],
  measure: Measure,
  horizon = 6,
): Forecast {
  return forecastSeries(buildMonthlySeries(rows, measure), measure, horizon);
}
