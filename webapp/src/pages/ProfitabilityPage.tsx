import { useMemo } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { groupRows, productSummary } from "../lib/analytics";
import { classNames, currency, percent } from "../lib/utils";

export function ProfitabilityPage() {
  const { filteredRows, isLoading, error } = useData();
  const products = useMemo(() => productSummary(filteredRows), [filteredRows]);
  const heatmap = useMemo(() => {
    const regions = [...new Set(filteredRows.map((row) => row.region))];
    const categories = [...new Set(filteredRows.map((row) => row.category))];
    const cells = new Map<string, { sales: number; profit: number }>();
    filteredRows.forEach((row) => {
      const key = `${row.region}|${row.category}`;
      const current = cells.get(key) ?? { sales: 0, profit: 0 };
      current.sales += row.sales;
      current.profit += row.profit;
      cells.set(key, current);
    });
    return { regions, categories, cells };
  }, [filteredRows]);
  const scatterData = useMemo(() => filteredRows.map((row) => ({ discount: row.discount * 100, profit: row.profit, sales: row.sales, product: row.productName })), [filteredRows]);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  return <>
    <PageHeader eyebrow="Margin management" title="Where margin is being created and lost." description="Review the impact of discounting, identify products that are eroding profitability, and compare margin performance across regions and categories." />
    {!filteredRows.length ? <EmptyState /> : <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <ChartCard title="Profit vs. discount" description="Each point is an order line. Values below zero are loss-making."><div className="h-[410px]"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ left: 8, right: 12, top: 8, bottom: 12 }}><CartesianGrid stroke="hsl(var(--line))" /><XAxis type="number" dataKey="discount" name="Discount" unit="%" domain={[0, 100]} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} label={{ value: "Discount (%)", position: "insideBottom", offset: -4, fill: "hsl(var(--muted))" }} /><YAxis type="number" dataKey="profit" name="Profit" tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} width={66} label={{ value: "Profit ($)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted))" }} /><ZAxis type="number" dataKey="sales" range={[18, 120]} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => name === "Profit" ? currency(Number(value)) : name === "Discount" ? `${value}%` : currency(Number(value))} labelFormatter={(_, payload) => payload[0]?.payload?.product ?? "Order line"} /><Scatter name="Order line" data={scatterData} fill="hsl(var(--brand))" fillOpacity={0.5} /></ScatterChart></ResponsiveContainer></div></ChartCard>
        <ChartCard title="Profit margin heatmap" description="Profit as a percentage of sales by region and category."><div className="overflow-x-auto"><table className="heatmap"><thead><tr><th>Region</th>{heatmap.categories.map((category) => <th key={category}>{category}</th>)}</tr></thead><tbody>{heatmap.regions.map((region) => <tr key={region}><th>{region}</th>{heatmap.categories.map((category) => { const cell = heatmap.cells.get(`${region}|${category}`) ?? { sales: 0, profit: 0 }; const margin = cell.sales ? cell.profit / cell.sales * 100 : 0; const intensity = Math.min(Math.abs(margin) / 35, 1); return <td key={category}><span className={classNames("heat-cell", margin < 0 ? "heat-negative" : "heat-positive")} style={{ opacity: 0.24 + intensity * 0.76 }}>{percent(margin)}</span></td>; })}</tr>)}</tbody></table></div></ChartCard>
      </div>
      <ChartCard title="Most & least profitable products" description="Ranked by total profit, with sales volume available for context."><div className="grid gap-6 lg:grid-cols-2"><ProductTable title="Top 10" rows={products.slice(0, 10)} /><ProductTable title="Bottom 10" rows={[...products].sort((a, b) => a.profit - b.profit).slice(0, 10)} negative /></div></ChartCard>
    </div>}
  </>;
}

function ProductTable({ title, rows, negative = false }: { title: string; rows: ReturnType<typeof productSummary>; negative?: boolean }) {
  return <div><h3 className="mb-3 text-sm font-medium text-muted">{title}</h3><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Product</th><th className="text-right">Sales</th><th className="text-right">Profit</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td className="max-w-60 truncate font-medium" title={row.label}>{row.label}</td><td className="text-right">{currency(row.sales)}</td><td className={classNames("text-right font-medium", (negative || row.profit < 0) && "text-negative")}>{currency(row.profit)}</td></tr>)}</tbody></table></div></div>;
}
