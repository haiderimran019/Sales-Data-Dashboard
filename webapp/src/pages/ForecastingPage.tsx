import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Calculator,
  Calendar,
  CheckCircle2,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { computeClientForecast } from "../lib/forecaster";
import { currency, monthLabel, percent } from "../lib/utils";

export function ForecastingPage() {
  const { filteredRows, isLoading, error } = useData();
  const [measure, setMeasure] = useState<"sales" | "profit">("sales");
  const [horizon, setHorizon] = useState<number>(6);
  const [showConfidence, setShowConfidence] = useState<boolean>(true);

  const forecast = useMemo(() => {
    if (!filteredRows.length) return null;
    try {
      return computeClientForecast(filteredRows, measure, horizon);
    } catch {
      return null;
    }
  }, [filteredRows, measure, horizon]);

  // Merge historical and forecasted data for continuous Recharts rendering
  const chartData = useMemo(() => {
    if (!forecast) return [];
    const historical = forecast.historical_values.map((item) => ({
      period: item.period,
      label: monthLabel(item.period),
      actual: item.value,
      projected: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
      isForecast: false,
    }));

    // Bridge point: connect last actual to first forecast point
    const lastActual = historical[historical.length - 1];
    if (lastActual) {
      lastActual.projected = lastActual.actual;
      lastActual.lower = lastActual.actual;
      lastActual.upper = lastActual.actual;
    }

    const projected = forecast.forecast_values.map((item, index) => ({
      period: item.period,
      label: monthLabel(item.period),
      actual: null as number | null,
      projected: item.value,
      lower: forecast.lower_bound[index]?.value ?? item.value,
      upper: forecast.upper_bound[index]?.value ?? item.value,
      isForecast: true,
    }));

    return [...historical, ...projected];
  }, [forecast]);

  const summaryMetrics = useMemo(() => {
    if (!forecast) return null;
    const projectedSum = forecast.forecast_values.reduce((acc, cur) => acc + cur.value, 0);
    const projectedAvg = projectedSum / Math.max(forecast.forecast_horizon, 1);
    const histSum = forecast.historical_values.reduce((acc, cur) => acc + cur.value, 0);
    const histAvg = histSum / Math.max(forecast.historical_observation_count, 1);
    const growthDelta = histAvg > 0 ? ((projectedAvg - histAvg) / histAvg) * 100 : 0;
    return { projectedSum, projectedAvg, histAvg, growthDelta };
  }, [forecast]);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!filteredRows.length || !forecast || !summaryMetrics) {
    return (
      <EmptyState
        title="Insufficient historical data"
        message="A deterministic forecast requires at least 3 historical months of transaction records."
      />
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Commercial Projections"
        title="Predictive Trajectory & Scenario Modeling"
        description="Deterministic time-series forecasting with statistical confidence intervals, grounded directly in verified transaction history."
      />

      {/* Control bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Metric:</span>
          <div className="segmented">
            <button
              type="button"
              className={measure === "sales" ? "selected" : ""}
              onClick={() => setMeasure("sales")}
            >
              Gross Revenue
            </button>
            <button
              type="button"
              className={measure === "profit" ? "selected" : ""}
              onClick={() => setMeasure("profit")}
            >
              Operating Profit
            </button>
          </div>

          <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-muted">Horizon:</span>
          <div className="segmented">
            {[3, 6, 12].map((h) => (
              <button
                key={h}
                type="button"
                className={horizon === h ? "selected" : ""}
                onClick={() => setHorizon(h)}
              >
                {h} Months
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink">
          <input
            type="checkbox"
            className="rounded border-line text-brand focus:ring-brand"
            checked={showConfidence}
            onChange={(e) => setShowConfidence(e.target.checked)}
          />
          Show 95% Confidence Interval
        </label>
      </section>

      {/* Executive Metric Callout Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Projected {horizon}M Total</span>
            <Calculator size={16} className="text-brand" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {currency(summaryMetrics.projectedSum, true)}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
            <span
              className={
                summaryMetrics.growthDelta >= 0
                  ? "font-semibold text-positive"
                  : "font-semibold text-negative"
              }
            >
              {summaryMetrics.growthDelta >= 0 ? "+" : ""}
              {summaryMetrics.growthDelta.toFixed(1)}%
            </span>
            <span>vs historical monthly run-rate</span>
          </p>
        </article>

        <article className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Monthly Run Rate</span>
            <TrendingUp size={16} className="text-brand" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {currency(summaryMetrics.projectedAvg, true)}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Average projected monthly {measure === "sales" ? "revenue" : "profit"}
          </p>
        </article>

        <article className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Model Technique</span>
            <Layers size={16} className="text-brand" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight capitalize text-ink">
            {forecast.method.replace("_", " ")}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Trained across {forecast.historical_observation_count} monthly observations
          </p>
        </article>

        <article className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Historical Fit (MAE)</span>
            <CheckCircle2 size={16} className="text-positive" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {forecast.mae !== null ? currency(forecast.mae, true) : "N/A"}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Holdout Mean Absolute Error validation
          </p>
        </article>
      </section>

      {/* Main Forecast Chart */}
      <ChartCard
        title={`${measure === "sales" ? "Revenue" : "Profit"} Trajectory & Forward Envelope`}
        description="Historical actual performance (solid) transitioned seamlessly into forward statistical projection (dashed) with 95% confidence bounds."
      >
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--line))" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--line))" }}
                tick={{ fill: "hsl(var(--muted))", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--line))" }}
                tickFormatter={(val) => currency(val, true)}
                tick={{ fill: "hsl(var(--muted))", fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-line bg-surface p-3 shadow-lg">
                      <p className="font-semibold text-xs text-muted uppercase tracking-wider">
                        {data.period} ({data.isForecast ? "Projected" : "Actual"})
                      </p>
                      {data.actual !== null && (
                        <p className="mt-1 text-sm font-bold text-ink">
                          Actual: {currency(data.actual, false)}
                        </p>
                      )}
                      {data.projected !== null && (
                        <p className="mt-1 text-sm font-bold text-brand">
                          Projected: {currency(data.projected, false)}
                        </p>
                      )}
                      {data.isForecast && showConfidence && (
                        <p className="mt-1 text-xs text-muted">
                          95% Range: {currency(data.lower, true)} – {currency(data.upper, true)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />

              {showConfidence && (
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="hsl(var(--brand) / 0.12)"
                  isAnimationActive={false}
                />
              )}
              {showConfidence && (
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="hsl(var(--surface))"
                  isAnimationActive={false}
                />
              )}

              {/* Historical actual line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--ink))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--ink))" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />

              {/* Projected future line */}
              <Line
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--brand))"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: "hsl(var(--brand))" }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-3 text-xs text-muted">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-6 rounded bg-ink" /> Historical Actuals
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-6 border-b-2 border-dashed border-brand" /> Projected Trajectory
            </span>
            {showConfidence && (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded bg-brand/15" /> 95% Confidence Interval
              </span>
            )}
          </div>
          <span>Scope: {forecast.result_scope.toUpperCase()}</span>
        </div>
      </ChartCard>

      {/* Projection Horizon Breakdown Table */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Horizon Period Breakdown</h3>
            <p className="mt-1 text-xs text-muted">
              Granular numerical projections by future month with sensitivity intervals.
            </p>
          </div>
          <span className="text-xs font-medium text-brand">Monthly Granularity</span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Forecast Period</th>
                <th className="text-right">Conservative (-95%)</th>
                <th className="text-right">Base Projection</th>
                <th className="text-right">Optimistic (+95%)</th>
                <th className="text-right">Interval Width</th>
              </tr>
            </thead>
            <tbody>
              {forecast.forecast_values.map((item, index) => {
                const lower = forecast.lower_bound[index]?.value ?? item.value;
                const upper = forecast.upper_bound[index]?.value ?? item.value;
                const rangeWidth = upper - lower;
                return (
                  <tr key={item.period} className="hover:bg-canvas/50">
                    <td className="font-semibold text-ink">
                      {monthLabel(item.period)} ({item.period})
                    </td>
                    <td className="text-right text-muted">{currency(lower, false)}</td>
                    <td className="text-right font-bold text-brand">{currency(item.value, false)}</td>
                    <td className="text-right text-muted">{currency(upper, false)}</td>
                    <td className="text-right text-xs text-muted">{currency(rangeWidth, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Consulting Governance & Model Notes */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <Info size={16} className="text-brand" />
          <span>Strategic Modeling Context & Governance</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 text-xs leading-relaxed text-muted">
          <div className="space-y-2 rounded-lg border border-line bg-canvas/60 p-4">
            <h4 className="font-semibold text-ink">Analytical Assumptions</h4>
            <p>
              This model applies linear trend extrapolation fitted over historical monthly periods.
              Seasonal factors are regularized to avoid overfitting brief operational spikes.
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-line bg-canvas/60 p-4">
            <h4 className="font-semibold text-ink">Commercial Action Plan</h4>
            <p>
              Use the base projection for inventory ordering and resource allocation, while ensuring
              working capital reserves can accommodate the conservative interval bound.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
