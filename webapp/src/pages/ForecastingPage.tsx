import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Info,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { computeClientForecast, type Forecast } from "../lib/forecaster";
import { currency, monthLabel, number, percent } from "../lib/utils";

const RELIABILITY_STYLES = {
  strong: {
    icon: ShieldCheck,
    chip: "bg-positive/10 text-positive border-positive/30",
    label: "Validated",
  },
  moderate: {
    icon: CheckCircle2,
    chip: "bg-brand/10 text-brand border-brand/30",
    label: "Directional",
  },
  weak: {
    icon: AlertTriangle,
    chip: "bg-negative/10 text-negative border-negative/30",
    label: "Not reliable",
  },
  unvalidated: {
    icon: Info,
    chip: "bg-muted/10 text-muted border-line",
    label: "Unvalidated",
  },
} as const;

function MetricTile({
  label,
  value,
  caption,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Target;
  tone?: "default" | "positive" | "negative";
}) {
  const valueTone =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink";
  return (
    <article className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
        <span>{label}</span>
        <Icon size={16} className="text-brand" />
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${valueTone}`}>{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{caption}</p>
    </article>
  );
}

export function ForecastingPage() {
  const { filteredRows, isLoading, error } = useData();
  const [measure, setMeasure] = useState<"sales" | "profit">("sales");
  const [horizon, setHorizon] = useState<number>(6);
  const [band, setBand] = useState<"none" | "80" | "95">("95");

  const result = useMemo<{ forecast: Forecast | null; failure: string | null }>(() => {
    if (!filteredRows.length) return { forecast: null, failure: null };
    try {
      return { forecast: computeClientForecast(filteredRows, measure, horizon), failure: null };
    } catch (cause) {
      return {
        forecast: null,
        failure: cause instanceof Error ? cause.message : "This selection could not be forecast.",
      };
    }
  }, [filteredRows, measure, horizon]);

  const forecast = result.forecast;

  const chartData = useMemo(() => {
    if (!forecast) return [];

    const history = forecast.historicalValues.map((point) => ({
      period: point.period,
      label: monthLabel(point.period),
      actual: point.value,
      projected: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
      bandBase: null as number | null,
      bandSize: null as number | null,
      isForecast: false,
    }));

    const lower = band === "80" ? forecast.lower80 : forecast.lower95;
    const upper = band === "80" ? forecast.upper80 : forecast.upper95;

    // Bridge the last actual into the projection so the two lines meet.
    const last = history[history.length - 1];
    if (last) {
      last.projected = last.actual;
      last.bandBase = last.actual;
      last.bandSize = 0;
    }

    const projected = forecast.forecastValues.map((point, index) => {
      const low = lower[index]?.value ?? point.value;
      const high = upper[index]?.value ?? point.value;
      return {
        period: point.period,
        label: monthLabel(point.period),
        actual: null as number | null,
        projected: point.value,
        lower: low,
        upper: high,
        // Recharts draws a band as a transparent base plus a visible height.
        bandBase: low,
        bandSize: Math.max(0, high - low),
        isForecast: true,
      };
    });

    return [...history, ...projected];
  }, [forecast, band]);

  const summary = useMemo(() => {
    if (!forecast) return null;
    const projectedTotal = forecast.forecastValues.reduce((acc, point) => acc + point.value, 0);
    const history = forecast.historicalValues;

    // Comparing the projection against the trailing months would set a low
    // season against a high one. For a seasonal series the only like-for-like
    // comparison is the same calendar months a year earlier.
    const byPeriod = new Map(history.map((point) => [point.period, point.value]));
    const priorYear = forecast.forecastValues.map((point) => {
      const [year, month] = point.period.split("-");
      return byPeriod.get(`${Number(year) - 1}-${month}`);
    });

    if (priorYear.every((value) => value !== undefined)) {
      const comparisonTotal = (priorYear as number[]).reduce((acc, value) => acc + value, 0);
      return {
        projectedTotal,
        comparisonTotal,
        comparisonLabel: "the same months last year",
        change:
          comparisonTotal !== 0
            ? ((projectedTotal - comparisonTotal) / Math.abs(comparisonTotal)) * 100
            : null,
      };
    }

    // Without a full year of history, fall back to the trailing window and say so.
    const trailing = history.slice(-forecast.horizon);
    const comparisonTotal = trailing.reduce((acc, point) => acc + point.value, 0);
    return {
      projectedTotal,
      comparisonTotal,
      comparisonLabel: `the trailing ${trailing.length} months`,
      change:
        comparisonTotal !== 0
          ? ((projectedTotal - comparisonTotal) / Math.abs(comparisonTotal)) * 100
          : null,
    };
  }, [forecast]);

  if (isLoading) return <LoadingState message="Loading transaction history…" />;
  if (error) return <EmptyState message={error} />;
  if (!filteredRows.length) {
    return (
      <EmptyState
        title="No rows in range"
        message="Widen the date filter to include transaction history, then the forecast will rebuild automatically."
      />
    );
  }
  if (!forecast || !summary) {
    return (
      <EmptyState
        title="Not enough history to validate a forecast"
        message={
          result.failure ??
          "A validated forecast needs several months of history so the model can be tested on periods it never saw."
        }
      />
    );
  }

  const { validation } = forecast;
  const style = RELIABILITY_STYLES[validation.reliability];
  const ReliabilityIcon = style.icon;
  const mape = validation.selected.mape;
  const skill = validation.skillVsBaseline;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Validated forecasting"
        title={`${forecast.measureLabel} outlook, with its own error bars`}
        description="Every model below was chosen by backtest and scored on months it never saw during selection. The accuracy figure is the model's real out-of-sample error, not its fit to history."
      />

      {/* Honest verdict first, before any projection is shown. */}
      <section
        className={`flex flex-wrap items-start gap-4 rounded-xl border p-5 shadow-sm ${style.chip}`}
      >
        <ReliabilityIcon size={22} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">{validation.reliabilityHeadline}</h2>
            <span className="rounded-md border border-current/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {style.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-ink/80">{validation.reliabilityDetail}</p>
        </div>
      </section>

      {/* Controls */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Measure</span>
          <div className="segmented">
            <button
              type="button"
              className={measure === "sales" ? "selected" : ""}
              onClick={() => setMeasure("sales")}
            >
              Revenue
            </button>
            <button
              type="button"
              className={measure === "profit" ? "selected" : ""}
              onClick={() => setMeasure("profit")}
            >
              Profit
            </button>
          </div>

          <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Horizon
          </span>
          <div className="segmented">
            {[3, 6, 12].map((option) => (
              <button
                key={option}
                type="button"
                className={horizon === option ? "selected" : ""}
                onClick={() => setHorizon(option)}
              >
                {option}M
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Interval</span>
          <div className="segmented">
            <button
              type="button"
              className={band === "95" ? "selected" : ""}
              onClick={() => setBand("95")}
            >
              95%
            </button>
            <button
              type="button"
              className={band === "80" ? "selected" : ""}
              onClick={() => setBand("80")}
            >
              80%
            </button>
            <button
              type="button"
              className={band === "none" ? "selected" : ""}
              onClick={() => setBand("none")}
            >
              Off
            </button>
          </div>
        </div>
      </section>

      {/* The accuracy figures come before the projection on purpose. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Out-of-sample error"
          value={mape !== null ? percent(mape) : currency(validation.selected.mae, true)}
          caption={
            mape !== null
              ? `Mean absolute percentage error across ${validation.selected.forecastCount} held-out forecasts. Typical monthly miss: ${currency(validation.selected.mae, true)}.`
              : `Mean absolute error across ${validation.selected.forecastCount} held-out forecasts. Percentage error is not meaningful for a series that crosses zero.`
          }
          icon={Target}
          tone={validation.reliability === "weak" ? "negative" : "default"}
        />
        <MetricTile
          label="Versus baseline"
          value={skill !== null ? `${skill >= 0 ? "−" : "+"}${Math.abs(skill).toFixed(1)}% error` : "n/a"}
          caption={`Against ${validation.baselineLabel.toLowerCase()}, which misses by ${currency(validation.baseline.mae, true)} a month on the same periods. MASE ${validation.selected.mase !== null ? validation.selected.mase.toFixed(2) : "n/a"}.`}
          icon={FlaskConical}
          tone={skill !== null && skill > 0 ? "positive" : "negative"}
        />
        <MetricTile
          label="Selected model"
          value={forecast.methodLabel.replace(/\s*\(.*\)/, "")}
          caption={`${forecast.methodLabel} won on backtest against ${validation.candidatesEvaluated - 1} alternatives, including the naive baselines.`}
          icon={TrendingUp}
        />
        <MetricTile
          label={`Next ${forecast.horizon} months`}
          value={currency(summary.projectedTotal, true)}
          caption={
            summary.change !== null
              ? `${summary.change >= 0 ? "+" : ""}${summary.change.toFixed(1)}% against ${summary.comparisonLabel} (${currency(summary.comparisonTotal, true)}).`
              : "No comparable prior period."
          }
          icon={TrendingUp}
          tone={summary.change !== null && summary.change >= 0 ? "positive" : "negative"}
        />
      </section>

      <ChartCard
        title={`${forecast.measureLabel} history and ${forecast.horizon}-month projection`}
        description={
          band === "none"
            ? "Solid line is actuals, dashed line is the projection."
            : `Solid line is actuals, dashed line is the projection, shaded band is the ${band}% interval derived from observed backtest errors.`
        }
      >
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--line))" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--line))" }}
                tick={{ fill: "hsl(var(--muted))", fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--line))" }}
                tickFormatter={(value) => currency(value, true)}
                tick={{ fill: "hsl(var(--muted))", fontSize: 11 }}
                width={64}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-line bg-surface p-3 shadow-lg">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        {monthLabel(point.period)} · {point.isForecast ? "Projected" : "Actual"}
                      </p>
                      {point.actual !== null && (
                        <p className="mt-1 text-sm font-bold text-ink">
                          {currency(point.actual)}
                        </p>
                      )}
                      {point.isForecast && point.projected !== null && (
                        <>
                          <p className="mt-1 text-sm font-bold text-brand">
                            {currency(point.projected)}
                          </p>
                          {band !== "none" && (
                            <p className="mt-1 text-xs text-muted">
                              {band}% interval {currency(point.lower, true)} to{" "}
                              {currency(point.upper, true)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                }}
              />

              {band !== "none" && (
                <Area
                  dataKey="bandBase"
                  stackId="band"
                  stroke="none"
                  fill="none"
                  isAnimationActive={false}
                  activeDot={false}
                />
              )}
              {band !== "none" && (
                <Area
                  dataKey="bandSize"
                  stackId="band"
                  stroke="none"
                  fill="hsl(var(--brand))"
                  fillOpacity={0.14}
                  isAnimationActive={false}
                  activeDot={false}
                />
              )}

              <ReferenceLine
                x={monthLabel(forecast.historicalValues[forecast.historicalValues.length - 1].period)}
                stroke="hsl(var(--muted))"
                strokeDasharray="2 4"
                label={{
                  value: "forecast starts",
                  position: "insideTopRight",
                  fill: "hsl(var(--muted))",
                  fontSize: 10,
                }}
              />

              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="hsl(var(--ink))"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="projected"
                name="Projected"
                stroke="hsl(var(--brand))"
                strokeWidth={2.25}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: "hsl(var(--brand))" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-line/60 pt-3 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 rounded bg-ink" /> Actuals
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0 w-6 border-b-2 border-dashed border-brand" /> Projection
          </span>
          {band !== "none" && (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded bg-brand/15" /> {band}% interval
            </span>
          )}
        </div>
      </ChartCard>

      {/* How the number was produced. */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <FlaskConical size={16} className="text-brand" />
            <span>How this was validated</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink/80">{validation.designNote}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            {[
              ["Months of history", number(validation.observedMonths)],
              ["Minimum training window", `${number(validation.trainingMonths)} months`],
              ["Selection origins", number(validation.selectionOrigins)],
              ["Holdout origins", number(validation.holdoutOrigins)],
              [
                "Holdout period",
                validation.holdoutRange
                  ? `${monthLabel(validation.holdoutRange.start)} – ${monthLabel(validation.holdoutRange.end)}`
                  : "n/a",
              ],
              ["Candidates scored", number(validation.candidatesEvaluated)],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="font-semibold uppercase tracking-wider text-muted">{term}</dt>
                <dd className="mt-0.5 font-bold text-ink">{detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-line/60 pt-3 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">Intervals:</span> {forecast.intervalBasis}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <Target size={16} className="text-brand" />
            <span>Error grows with distance</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Holdout error at each horizon. A forecast six months out is a weaker claim than one
            month out, and this is the measured cost of that distance.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Months ahead</th>
                  <th className="text-right">MAE</th>
                  <th className="text-right">MAPE</th>
                  <th className="text-right">Forecasts</th>
                </tr>
              </thead>
              <tbody>
                {validation.perHorizon.map((row) => (
                  <tr key={row.horizon}>
                    <td className="font-semibold text-ink">{row.horizon}</td>
                    <td className="text-right">{currency(row.mae, true)}</td>
                    <td className="text-right">{row.mape !== null ? percent(row.mape) : "—"}</td>
                    <td className="text-right text-muted">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Like-for-like comparison on the same held-out months */}
      {validation.references.length > 1 && (
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">
                Measured against the obvious alternatives
              </h3>
              <p className="mt-1 text-xs text-muted">
                Every model below was scored on the same held-out months, so these are
                like-for-like. A forecast is only as good as the naive guess it beats.
              </p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="text-right">MAPE</th>
                  <th className="text-right">MAE</th>
                  <th className="text-right">MASE</th>
                </tr>
              </thead>
              <tbody>
                {validation.references.map((reference) => (
                  <tr key={reference.id} className={reference.selected ? "bg-brand/5" : undefined}>
                    <td className="font-semibold text-ink">
                      {reference.label}
                      {reference.selected && (
                        <span className="ml-2 rounded border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          Selected
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {reference.score.mape !== null ? percent(reference.score.mape) : "—"}
                    </td>
                    <td className="text-right">{currency(reference.score.mae, true)}</td>
                    <td className="text-right">
                      {reference.score.mase !== null ? reference.score.mase.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Model bake-off */}
      {validation.leaderboard.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">Model bake-off</h3>
              <p className="mt-1 text-xs text-muted">
                Best distinct approaches at the selection stage, ranked by mean absolute scaled
                error. Below 1.00 beats a same-month-last-year guess.
              </p>
            </div>
            <span className="text-xs font-medium text-brand">
              {validation.candidatesEvaluated} candidates scored
            </span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Family</th>
                  <th className="text-right">Selection MASE</th>
                  <th className="text-right">Selection MAE</th>
                </tr>
              </thead>
              <tbody>
                {validation.leaderboard.map((row) => (
                  <tr key={row.id} className={row.selected ? "bg-brand/5" : undefined}>
                    <td className="font-semibold text-ink">
                      {row.label}
                      {row.selected && (
                        <span className="ml-2 rounded border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          Selected
                        </span>
                      )}
                    </td>
                    <td className="text-muted">{row.family}</td>
                    <td className="text-right font-bold text-ink">
                      {row.selectionMase !== null ? row.selectionMase.toFixed(3) : "—"}
                    </td>
                    <td className="text-right text-muted">{currency(row.selectionMae, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Month-by-month numbers */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">Month-by-month projection</h3>
            <p className="mt-1 text-xs text-muted">
              Plan against the interval rather than the central value.
            </p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Low (95%)</th>
                <th className="text-right">Low (80%)</th>
                <th className="text-right">Projection</th>
                <th className="text-right">High (80%)</th>
                <th className="text-right">High (95%)</th>
              </tr>
            </thead>
            <tbody>
              {forecast.forecastValues.map((point, index) => (
                <tr key={point.period}>
                  <td className="font-semibold text-ink">{monthLabel(point.period)}</td>
                  <td className="text-right text-muted">
                    {currency(forecast.lower95[index]?.value ?? point.value, true)}
                  </td>
                  <td className="text-right text-muted">
                    {currency(forecast.lower80[index]?.value ?? point.value, true)}
                  </td>
                  <td className="text-right font-bold text-brand">{currency(point.value)}</td>
                  <td className="text-right text-muted">
                    {currency(forecast.upper80[index]?.value ?? point.value, true)}
                  </td>
                  <td className="text-right text-muted">
                    {currency(forecast.upper95[index]?.value ?? point.value, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Limitations, stated rather than buried */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <AlertTriangle size={16} className="text-brand" />
          <span>What this forecast cannot do</span>
        </div>
        <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-muted">
          {forecast.warnings.map((warning) => (
            <li key={warning} className="flex gap-2.5">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span>{warning}</span>
            </li>
          ))}
          <li className="flex gap-2.5">
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-brand" />
            <span>
              The model extrapolates the level, trend and seasonal shape of past orders. It knows
              nothing about pricing changes, stock-outs, marketing spend or competitor moves, so a
              deliberate change to the business will break it before the error bars do.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-brand" />
            <span>
              Accuracy is measured on this dataset only. Loading a different file re-runs selection
              and validation from scratch, and the figures above will change with it.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
