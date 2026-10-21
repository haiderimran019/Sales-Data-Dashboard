import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { groupRows } from "../lib/analytics";
import { currency } from "../lib/utils";

export function SalesPage() {
  const { filteredRows, isLoading, error } = useData();
  const [category, setCategory] = useState("All categories");
  const categoryData = useMemo(() => groupRows(filteredRows, (row) => row.category).sort((a, b) => b.sales - a.sales), [filteredRows]);
  const detailRows = category === "All categories" ? filteredRows : filteredRows.filter((row) => row.category === category);
  const subcategoryData = useMemo(() => groupRows(detailRows, (row) => row.subCategory).sort((a, b) => b.sales - a.sales), [detailRows]);
  const stateData = useMemo(() => groupRows(filteredRows, (row) => row.state).sort((a, b) => b.sales - a.sales).slice(0, 12), [filteredRows]);
  const groupedData = useMemo(() => {
    const segments = ["Consumer", "Corporate", "Home Office"];
    return [...new Set(filteredRows.map((row) => row.shipMode))].map((shipMode) => ({ shipMode, ...Object.fromEntries(segments.map((segment) => [segment, filteredRows.filter((row) => row.shipMode === shipMode && row.segment === segment).reduce((total, row) => total + row.sales, 0)])) }));
  }, [filteredRows]);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  return <>
    <PageHeader eyebrow="Revenue performance" title="Where the sales are coming from." description="Use the date range above to isolate the periods that matter, then drill into category, state, segment, and shipping patterns to understand the underlying revenue mix." />
    {!filteredRows.length ? <EmptyState /> : <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Category drill-down" description="Select a category to update its sub-category view." action={<select className="control" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Select category"><option>All categories</option>{categoryData.map((item) => <option key={item.label}>{item.label}</option>)}</select>}><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} margin={{ left: 8 }}><CartesianGrid stroke="hsl(var(--line))" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} width={64} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="sales" name="Sales" fill="hsl(var(--brand))" radius={[5, 5, 0, 0]} cursor="pointer" onClick={(item) => setCategory(item.label)} /></BarChart></ResponsiveContainer></div></ChartCard>
      <ChartCard title={category === "All categories" ? "Sub-category sales" : `${category} sub-categories`} description="Ranked by selected-period revenue."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={subcategoryData} layout="vertical"><CartesianGrid stroke="hsl(var(--line))" horizontal={false} /><XAxis type="number" tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={100} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="sales" name="Sales" fill="hsl(var(--brand) / .72)" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></ChartCard>
      <ChartCard title="Top states by sales" description="A ranked alternative to a choropleth for direct comparison."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={stateData} layout="vertical"><CartesianGrid stroke="hsl(var(--line))" horizontal={false} /><XAxis type="number" tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={92} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="sales" fill="hsl(var(--brand))" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></ChartCard>
      <ChartCard title="Sales by ship mode & segment" description="Segment mix within each fulfilment option."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={groupedData}><CartesianGrid stroke="hsl(var(--line))" vertical={false} /><XAxis dataKey="shipMode" tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} width={64} /><Tooltip formatter={(value) => currency(Number(value))} /><Legend /><Bar dataKey="Consumer" stackId="sales" fill="hsl(var(--brand))" /><Bar dataKey="Corporate" stackId="sales" fill="hsl(var(--positive))" /><Bar dataKey="Home Office" stackId="sales" fill="hsl(var(--brand) / .45)" /></BarChart></ResponsiveContainer></div></ChartCard>
    </div>}
  </>;
}
