import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownUp } from "lucide-react";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { customerSummary, groupRows, orderFrequency } from "../lib/analytics";
import { currency, number } from "../lib/utils";

type SortKey = "sales" | "profit";
const colors = ["hsl(var(--brand))", "hsl(var(--positive))", "hsl(var(--brand) / .48)"];

export function CustomersPage() {
  const { filteredRows, isLoading, error } = useData();
  const [sort, setSort] = useState<SortKey>("sales");
  const segments = useMemo(() => groupRows(filteredRows, (row) => row.segment).sort((a, b) => b.sales - a.sales), [filteredRows]);
  const customers = useMemo(() => customerSummary(filteredRows).sort((a, b) => b[sort] - a[sort]).slice(0, 10), [filteredRows, sort]);
  const frequency = useMemo(() => orderFrequency(filteredRows), [filteredRows]);
  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  return <>
    <PageHeader eyebrow="Customer intelligence" title="The customer mix behind the numbers." description="Compare segment contribution, identify the accounts driving value, and look at repeat purchasing behavior to understand commercial quality." />
    {!filteredRows.length ? <EmptyState /> : <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Customer segment mix" description="Share of sales across each customer segment."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={segments} dataKey="sales" nameKey="label" outerRadius="80%" innerRadius="54%" paddingAngle={4}>{segments.map((row, index) => <Cell key={row.label} fill={colors[index]} />)}</Pie><Tooltip formatter={(value) => currency(Number(value))} /></PieChart></ResponsiveContainer></div><div className="mt-1 grid grid-cols-3 gap-2">{segments.map((row) => <div key={row.label} className="text-center"><p className="text-xs text-muted">{row.label}</p><p className="mt-1 text-sm font-semibold">{currency(row.sales, true)}</p></div>)}</div></ChartCard>
      <ChartCard title="Order frequency distribution" description="Number of customers by their count of purchased line items."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={frequency}><CartesianGrid stroke="hsl(var(--line))" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(value) => number(Number(value))} /><Bar dataKey="count" name="Customers" fill="hsl(var(--brand))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartCard>
      <div className="xl:col-span-2"><ChartCard title="Top 10 customers" description={`Sorted by total ${sort}.`} action={<button type="button" className="secondary-button" onClick={() => setSort((current) => current === "sales" ? "profit" : "sales")}><ArrowDownUp size={15} /> Sort by {sort === "sales" ? "profit" : "sales"}</button>}><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Customer</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead><tbody>{customers.map((row) => <tr key={row.label}><td className="font-medium">{row.label}</td><td className="text-right">{number(row.orders)}</td><td className="text-right">{currency(row.sales)}</td><td className="text-right">{currency(row.profit)}</td><td className="text-right">{row.sales ? (row.profit / row.sales * 100).toFixed(1) : 0}%</td></tr>)}</tbody></table></div></ChartCard></div>
    </div>}
  </>;
}
