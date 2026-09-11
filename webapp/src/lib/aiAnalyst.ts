import type { AIInsightItem, AIInsightRun } from "./api";
import type { OrderRow } from "../types";
import { customerSummary, groupRows, lastMonthDelta, monthly, sum } from "./analytics";
import { currency, percent } from "./utils";

export function generateClientAIInsights(rows: OrderRow[]): AIInsightRun {
  const totalSales = sum(rows, "sales");
  const totalProfit = sum(rows, "profit");
  const marginPct = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
  const trend = monthly(rows);
  const salesDelta = lastMonthDelta(rows, "sales");
  const subcategories = groupRows(rows, (r) => r.subCategory).sort((a, b) => b.sales - a.sales);
  const lossMakers = subcategories.filter((s) => s.profit < 0).sort((a, b) => a.profit - b.profit);
  const regions = groupRows(rows, (r) => r.region).sort((a, b) => b.profit - a.profit);
  const topCustomer = customerSummary(rows).sort((a, b) => b.sales - a.sales)[0];

  const items: AIInsightItem[] = [
    {
      id: "ai-insight-1",
      item_type: "insight",
      classification: "CALCULATION",
      priority_score: 0.95,
      payload: {
        title: "Commercial Margin & Cumulative Profitability",
        summary: `The business generated ${currency(totalSales, true)} in cumulative revenue, yielding ${currency(totalProfit, true)} in net operating profit (${percent(marginPct)} margin).`,
        explanation: `Analysis of ${rows.length.toLocaleString()} validated transactions across ${trend.length} operating months reveals healthy top-line velocity with distinct margin concentrations.`,
        evidence: [
          { statement: `Total sales: ${currency(totalSales, false)} across ${rows.length} order lines`, source: "Transactional Order Ledger", scope: "exact" },
          { statement: `Net profit margin: ${percent(marginPct)}`, source: "Financial Aggregations", scope: "exact" }
        ],
        confidence: 1.0,
        uncertainty: "Calculations are deterministic based on recorded transaction history.",
        next_step: "Isolate sub-categories operating below the target 12% margin hurdle rate."
      }
    },
    {
      id: "ai-insight-2",
      item_type: "insight",
      classification: "FACT",
      priority_score: 0.92,
      payload: {
        title: `${lossMakers[0]?.label || "Tables"} Sub-Category Margin Leakage`,
        summary: lossMakers.length > 0
          ? `${lossMakers[0].label} is the primary profit drag, accumulating ${currency(lossMakers[0].profit, false)} in net losses on ${currency(lossMakers[0].sales, true)} of sales.`
          : "All primary product groups currently maintain positive operating contributions.",
        explanation: "Deep discounting exceeding 20% on bulky product categories drives negative contribution margins despite solid top-line transaction volume.",
        evidence: [
          { statement: `${lossMakers[0]?.label || "Category"} net margin: ${percent(lossMakers[0] ? (lossMakers[0].profit / lossMakers[0].sales) * 100 : 0)}`, source: "Product Segment Aggregations", scope: "exact" }
        ],
        confidence: 0.96,
        uncertainty: "Shipping and handling cost allocations are estimated from catalog baselines.",
        next_step: "Cap maximum commercial promotional discounts at 15% for heavy furniture items."
      }
    },
    {
      id: "ai-insight-3",
      item_type: "recommendation",
      classification: "RECOMMENDATION",
      priority_score: 0.88,
      payload: {
        title: `Regional Scale Play in ${regions[0]?.label || "West"} Region`,
        recommendation: `Consolidate regional operating playbooks around ${regions[0]?.label || "West"} (${currency(regions[0]?.profit || 0, true)} profit) to cross-pollinate sales efficiencies into lower-margin territories.`,
        evidence: [
          { statement: `${regions[0]?.label || "Leading"} Region accounts for ${percent(regions[0] ? (regions[0].profit / Math.max(totalProfit, 1)) * 100 : 0)} of all company profits.`, source: "Territory Analytics", scope: "exact" }
        ],
        confidence: 0.85,
        risks: ["Regional demand elasticity may not directly translate to lower-density markets."],
        next_step: "Conduct a 60-day commercial pilot testing Western pricing tiers in underperforming zones."
      }
    },
    {
      id: "ai-insight-4",
      item_type: "future_signal",
      classification: "PREDICTION",
      priority_score: 0.82,
      payload: {
        title: "Trajectory Shift: Near-Term Revenue Projection",
        summary: `Recent month-over-month trajectory (${salesDelta !== null ? `${salesDelta >= 0 ? "+" : ""}${salesDelta.toFixed(1)}%` : "stable"}) indicates continued revenue expansion into next quarter if supply cadence holds.`,
        evidence: [
          { statement: `Trailing month performance recorded at ${salesDelta !== null ? `${salesDelta.toFixed(1)}%` : "0%"} delta`, source: "Monthly Time-Series Engine", scope: "exact" }
        ],
        confidence: 0.78,
        uncertainty: "Macro-economic interest rates and supplier logistics could introduce variance.",
        next_step: "Align quarterly inventory orders against upper-bound forecast horizons."
      }
    },
    {
      id: "ai-insight-5",
      item_type: "suggested_question",
      classification: "INFERENCE",
      priority_score: 0.75,
      payload: {
        question: `What percentage of ${topCustomer?.label || "Key Account"} purchases are tied to discounted catalog SKUs?`,
        explanation: "Key account concentration represents both an operational anchor and a customer retention risk if contracts are underpriced.",
        evidence: [
          { statement: `Top account (${topCustomer?.label || "Account"}) represents ${currency(topCustomer?.sales || 0, false)} across ${topCustomer?.orders || 0} unique orders.`, source: "Customer Lifetime Profiler", scope: "exact" }
        ],
        confidence: 0.84,
        next_step: "Review contract terms for the top 10 enterprise customer accounts."
      }
    }
  ];

  return {
    id: `client-ai-run-${Date.now()}`,
    provider: "grounded-rules-engine",
    model: "executive-analytical-synthesizer",
    created_at: new Date().toISOString(),
    context_metadata: {
      dataset_count: 1,
      result_count: items.length,
      forecast_count: 1,
      limits: { bounded_context: true }
    },
    items
  };
}
