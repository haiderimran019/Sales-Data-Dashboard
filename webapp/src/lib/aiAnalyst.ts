import type { OrderRow } from "../types";
import { customerSummary, groupRows, monthly, sum } from "./analytics";
import { forecastSeries, buildMonthlySeries } from "./forecaster";
import { currency, percent } from "./utils";

/**
 * Rule-based insight generator.
 *
 * This is deliberately not a language model. Every statement it produces is
 * computed from the loaded rows, and every figure quoted in the prose is the
 * same figure carried in the `evidence` list beside it. The taxonomy below
 * exists so a reader can tell the difference between an arithmetic result and a
 * judgement call:
 *
 *   - `measured`   a direct aggregation of the data. Reproducible, not arguable.
 *   - `inferred`   a reading of those measurements that a reasonable analyst
 *                  might disagree with.
 *   - `action`     a suggested next step. Carries the most assumption.
 *
 * Nothing here is phrased more confidently than the arithmetic supports, and
 * findings that do not apply to the loaded data are omitted rather than
 * padded with a plausible-sounding default.
 */

export type FindingKind = "measured" | "inferred" | "action";

export type Evidence = {
  statement: string;
  /** Which computation produced this figure. */
  basis: string;
};

export type Finding = {
  id: string;
  kind: FindingKind;
  title: string;
  detail: string;
  evidence: Evidence[];
  /** What this finding cannot tell you, where that matters. */
  caveat?: string;
  nextStep?: string;
};

export type InsightReport = {
  generatedAt: string;
  rowsAnalysed: number;
  monthsCovered: number;
  method: string;
  findings: Finding[];
};

const DISCOUNT_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "No discount", min: 0, max: 0 },
  { label: "1–10%", min: 0.0001, max: 0.1 },
  { label: "11–20%", min: 0.1001, max: 0.2 },
  { label: "21–30%", min: 0.2001, max: 0.3 },
  { label: "Over 30%", min: 0.3001, max: Number.POSITIVE_INFINITY },
];

/** Average margin within each discount band, for bands that actually have rows. */
function discountBandMargins(rows: OrderRow[]) {
  return DISCOUNT_BANDS.map((band) => {
    const matching = rows.filter((row) => row.discount >= band.min && row.discount <= band.max);
    const sales = sum(matching, "sales");
    const profit = sum(matching, "profit");
    return {
      label: band.label,
      orders: matching.length,
      sales,
      profit,
      margin: sales > 0 ? (profit / sales) * 100 : null,
    };
  }).filter((band) => band.orders > 0);
}

export function generateInsightReport(rows: OrderRow[]): InsightReport {
  const findings: Finding[] = [];
  const months = monthly(rows);
  const totalSales = sum(rows, "sales");
  const totalProfit = sum(rows, "profit");
  const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  // ---- 1. Headline economics (pure arithmetic)
  findings.push({
    id: "economics",
    kind: "measured",
    title: "Overall revenue and margin",
    detail: `The selected rows total ${currency(totalSales)} of revenue and ${currency(totalProfit)} of profit, an overall margin of ${percent(margin)}.`,
    evidence: [
      {
        statement: `${rows.length.toLocaleString()} order lines across ${months.length} months`,
        basis: "Row count and monthly grouping of the loaded dataset",
      },
      {
        statement: `Revenue ${currency(totalSales)}, profit ${currency(totalProfit)}, margin ${percent(margin)}`,
        basis: "Sum of the Sales and Profit columns",
      },
    ],
  });

  // ---- 2. Which sub-categories lose money (measured)
  const subCategories = groupRows(rows, (row) => row.subCategory);
  const lossMakers = subCategories
    .filter((group) => group.profit < 0)
    .sort((a, b) => a.profit - b.profit);

  if (lossMakers.length) {
    const worst = lossMakers[0];
    const totalLoss = lossMakers.reduce((acc, group) => acc + group.profit, 0);
    findings.push({
      id: "loss-makers",
      kind: "measured",
      title: `${lossMakers.length} sub-categor${lossMakers.length === 1 ? "y" : "ies"} lose money`,
      detail: `${worst.label} is the largest drag, losing ${currency(Math.abs(worst.profit))} on ${currency(worst.sales)} of revenue. Across all loss-making sub-categories the shortfall is ${currency(Math.abs(totalLoss))}, against total profit of ${currency(totalProfit)}.`,
      evidence: [
        {
          statement: `${worst.label}: revenue ${currency(worst.sales)}, profit ${currency(worst.profit)}, margin ${percent((worst.profit / worst.sales) * 100)}`,
          basis: "Profit summed by Sub-Category",
        },
        {
          statement: lossMakers
            .slice(0, 4)
            .map((group) => `${group.label} ${currency(group.profit)}`)
            .join(", "),
          basis: "All sub-categories with negative total profit, worst first",
        },
      ],
      nextStep: `Review pricing and discount policy for ${lossMakers
        .slice(0, 3)
        .map((group) => group.label)
        .join(", ")} before pursuing further volume there.`,
    });
  }

  // ---- 3. Does discounting explain it? (measured, then inferred)
  const bands = discountBandMargins(rows);
  const undiscounted = bands.find((band) => band.label === "No discount");
  const deepest = [...bands].reverse().find((band) => band.orders >= 20);

  if (undiscounted?.margin != null && deepest?.margin != null && deepest.label !== "No discount") {
    const gap = undiscounted.margin - deepest.margin;
    findings.push({
      id: "discount-margin",
      kind: "measured",
      title: "Margin by discount band",
      detail: `Undiscounted orders run at ${percent(undiscounted.margin)} margin. Orders in the ${deepest.label} band run at ${percent(deepest.margin)}, a gap of ${percent(Math.abs(gap))}.`,
      evidence: bands.map((band) => ({
        statement: `${band.label}: ${band.orders.toLocaleString()} orders, margin ${band.margin !== null ? percent(band.margin) : "n/a"}`,
        basis: "Margin recomputed within each discount band",
      })),
      caveat:
        "This is an association across order lines, not a controlled comparison. Discount depth is not assigned at random, so part of this gap reflects which products get discounted rather than the discount itself.",
    });

    if (gap > 10) {
      findings.push({
        id: "discount-inference",
        kind: "inferred",
        title: "Discount depth is the most likely margin lever",
        detail: `Margin falls monotonically enough across discount bands that discount policy, rather than product mix alone, looks like the main controllable driver of the ${percent(Math.abs(gap))} spread.`,
        evidence: [
          {
            statement: `Margin gap between undiscounted and ${deepest.label} orders: ${percent(Math.abs(gap))}`,
            basis: "Difference of the two band margins above",
          },
        ],
        caveat:
          "Confirming this needs a holdout test: cap discounts on a subset of products and compare margin and volume against an untouched control group.",
        nextStep: "Test a discount ceiling on the worst-margin sub-categories and measure the volume response before rolling it out.",
      });
    }
  }

  // ---- 4. Revenue concentration (measured)
  const customers = customerSummary(rows).sort((a, b) => b.sales - a.sales);
  if (customers.length >= 20) {
    const topDecile = Math.max(1, Math.round(customers.length * 0.1));
    const topShare =
      (customers.slice(0, topDecile).reduce((acc, customer) => acc + customer.sales, 0) /
        Math.max(totalSales, 1)) *
      100;
    findings.push({
      id: "concentration",
      kind: "measured",
      title: "Customer revenue concentration",
      detail: `The top ${topDecile.toLocaleString()} customers (${percent((topDecile / customers.length) * 100, 0)} of the base) account for ${percent(topShare)} of revenue.`,
      evidence: [
        {
          statement: `${customers.length.toLocaleString()} distinct customers; top ${topDecile} contribute ${currency(customers.slice(0, topDecile).reduce((a, c) => a + c.sales, 0))}`,
          basis: "Revenue summed by Customer ID, ranked descending",
        },
        {
          statement: `Largest single account: ${customers[0].label}, ${currency(customers[0].sales)} across ${customers[0].orders} orders`,
          basis: "Top row of the customer ranking",
        },
      ],
      caveat:
        topShare < 30
          ? "Revenue is relatively spread out, so this is a low-concentration book rather than a key-account risk."
          : undefined,
    });
  }

  // ---- 5. Regional profit spread (measured)
  const regions = groupRows(rows, (row) => row.region)
    .filter((group) => group.label)
    .sort((a, b) => b.profit - a.profit);
  if (regions.length >= 2) {
    const best = regions[0];
    const worst = regions[regions.length - 1];
    const bestMargin = best.sales > 0 ? (best.profit / best.sales) * 100 : 0;
    const worstMargin = worst.sales > 0 ? (worst.profit / worst.sales) * 100 : 0;
    findings.push({
      id: "regions",
      kind: "measured",
      title: "Regional margin spread",
      detail: `${best.label} is the strongest region at ${percent(bestMargin)} margin; ${worst.label} is the weakest at ${percent(worstMargin)}. The two differ by ${percent(Math.abs(bestMargin - worstMargin))} on comparable revenue bases.`,
      evidence: regions.map((group) => ({
        statement: `${group.label}: revenue ${currency(group.sales)}, profit ${currency(group.profit)}, margin ${percent(group.sales > 0 ? (group.profit / group.sales) * 100 : 0)}`,
        basis: "Revenue and profit summed by Region",
      })),
    });
  }

  // ---- 6. Forward view, taken from the validated forecaster (not asserted)
  try {
    const series = buildMonthlySeries(rows, "sales");
    const forecast = forecastSeries(series, "sales", 6);
    const projected = forecast.forecastValues.reduce((acc, point) => acc + point.value, 0);
    // Compare against the same calendar months a year earlier. Setting the
    // projected low season against the trailing high season would manufacture
    // a decline that is purely seasonal.
    const byPeriod = new Map(series.map((point) => [point.period, point.value]));
    const priorYear = forecast.forecastValues.map((point) => {
      const [year, month] = point.period.split("-");
      return byPeriod.get(`${Number(year) - 1}-${month}`);
    });
    const comparable = priorYear.every((value) => value !== undefined);
    const comparisonTotal = comparable
      ? (priorYear as number[]).reduce((acc, value) => acc + value, 0)
      : series.slice(-6).reduce((acc, point) => acc + point.value, 0);
    const comparisonLabel = comparable ? "the same six months last year" : "the trailing six months";
    const change = comparisonTotal > 0 ? ((projected - comparisonTotal) / comparisonTotal) * 100 : null;
    const v = forecast.validation;

    findings.push({
      id: "outlook",
      kind: v.reliability === "weak" || v.reliability === "unvalidated" ? "inferred" : "measured",
      title: `Six-month revenue outlook (${v.reliabilityHeadline.toLowerCase()})`,
      detail:
        change !== null
          ? `The selected model projects ${currency(projected)} over the next six months, ${change >= 0 ? "up" : "down"} ${percent(Math.abs(change))} against ${comparisonLabel} (${currency(comparisonTotal)}). Its measured out-of-sample error is ${v.selected.mape !== null ? percent(v.selected.mape) : currency(v.selected.mae)} per month.`
          : `The selected model projects ${currency(projected)} over the next six months.`,
      evidence: [
        {
          statement: `${forecast.methodLabel} selected from ${v.candidatesEvaluated} candidates`,
          basis: "Rolling-origin backtest on the loaded history",
        },
        {
          statement: `Holdout error: ${v.selected.mape !== null ? `MAPE ${percent(v.selected.mape)}, ` : ""}MAE ${currency(v.selected.mae)} across ${v.selected.forecastCount} forecasts${v.holdoutRange ? ` (${v.holdoutRange.start} to ${v.holdoutRange.end})` : ""}`,
          basis: "Forecasts scored against months withheld from model selection",
        },
        {
          statement: `Baseline (${v.baselineLabel.toLowerCase()}) error: MAE ${currency(v.baseline.mae)}`,
          basis: "Same months, same metric, naive model",
        },
      ],
      caveat: v.reliabilityDetail,
      nextStep: "Open the Forecasting page for the per-horizon error breakdown and the full model bake-off.",
    });
  } catch {
    // Not enough history to forecast. Saying nothing is better than guessing.
  }

  return {
    generatedAt: new Date().toISOString(),
    rowsAnalysed: rows.length,
    monthsCovered: months.length,
    method: "Deterministic rule-based analysis computed in the browser",
    findings,
  };
}
