import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { groupRows, lastMonthDelta, monthly, sum, unique } from "../lib/analytics";
import { classNames, currency, dateLabel, number, percent } from "../lib/utils";

const pieColors = ["hsl(var(--brand))", "hsl(var(--brand) / 0.72)", "hsl(var(--brand) / 0.46)"];

export function OverviewPage() {
  const { filteredRows, isLoading, error } = useData();
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly");
  const summary = useMemo(() => {
    const sales = sum(filteredRows, "sales");
    const profit = sum(filteredRows, "profit");
    const orders = unique(filteredRows, "orderId");
    const trend = monthly(filteredRows);
    const periods = period === "monthly" ? trend : trend.reduce<typeof trend>((accumulator, point) => {
      const quarter = `${point.key.slice(0, 4)} Q${Math.ceil(Number(point.key.slice(5, 7)) / 3)}`;
      const current = accumulator.find((item) => item.key === quarter);
      if (current) { current.sales += point.sales; current.profit += point.profit; }
      else accumulator.push({ ...point, key: quarter, label: quarter });
      return accumulator;
    }, []);
    return { sales, profit, orders, trend: periods };
  }, [filteredRows, period]);
  const regionData = useMemo(() => groupRows(filteredRows, (row) => row.region).sort((a, b) => b.sales - a.sales), [filteredRows]);
  const categoryData = useMemo(() => groupRows(filteredRows, (row) => row.category).sort((a, b) => b.sales - a.sales), [filteredRows]);
  const recentOrders = useMemo(() => [...filteredRows].sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime()).slice(0, 10), [filteredRows]);
  const leadingCategory = categoryData[0];
  const leadingRegion = regionData[0];

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;

  return <>
    <PageHeader eyebrow="Executive overview" title="A disciplined view of retail performance." description="This dashboard turns the raw Superstore CSV into a decision-ready view of revenue, margin, customer behavior, and operational performance." />
    {!filteredRows.length ? <EmptyState /> : <>
      <section className="mb-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card md:grid-cols-[1.1fr_1fr_1fr]" aria-label="Executive readout">
        <div className="bg-brand px-5 py-4 text-white md:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70"><Compass size={15} /> Executive readout</div>
          <p className="mt-2 text-sm leading-6 text-white/90">The selected view is led by <strong>{leadingCategory?.label}</strong>, with <strong>{leadingRegion?.label}</strong> contributing the most sales.</p>
        </div>
        <div className="bg-surface px-5 py-4 md:px-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Leading category</p><p className="mt-2 text-xl font-semibold text-ink">{leadingCategory?.label}</p><p className="mt-1 text-sm text-muted">{currency(leadingCategory?.sales ?? 0, true)} in sales</p></div>
        <div className="bg-surface px-5 py-4 md:px-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Margin signal</p><p className={classNames("mt-2 text-xl font-semibold", summary.profit >= 0 ? "text-positive" : "text-negative")}>{percent(summary.sales ? summary.profit / summary.sales * 100 : 0)}</p><p className="mt-1 text-sm text-muted">profit retained from sales</p></div>
      </section>
      <ChartCard title="How the data was built" description="From raw order lines to decision-ready signals.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { step: "01", title: "Source", text: "The underlying file is the raw Superstore export, containing transactions, customers, categories, and shipping information." },
            { step: "02", title: "Clean", text: "Dates, numeric fields, and category labels are normalized so the data can be compared reliably over time." },
            { step: "03", title: "Model", text: "Each row is converted into one order-level record, then grouped by month, segment, category, and region for analysis." },
            { step: "04", title: "Filter", text: "The date selector and page-level filters allow the team to isolate a period or customer slice without changing the source file." },
          ].map(({ step, title, text }) => (
            <div key={step} className="rounded-xl border border-line bg-canvas/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand/80">{step}</p>
              <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total sales" value={currency(summary.sales, true)} delta={lastMonthDelta(filteredRows, "sales")} detail="latest month vs. prior" />
        <KpiCard label="Total profit" value={currency(summary.profit, true)} delta={lastMonthDelta(filteredRows, "profit")} detail="latest month vs. prior" emphasis="positive" />
        <KpiCard label="Profit margin" value={percent(summary.sales ? summary.profit / summary.sales * 100 : 0)} detail="profit as a share of sales" />
        <KpiCard label="Total orders" value={number(summary.orders)} detail="unique customer orders" />
        <KpiCard label="Avg. order value" value={currency(summary.orders ? summary.sales / summary.orders : 0, true)} detail="sales per unique order" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <ChartCard title="Sales & profit trend" description="How revenue and profitability move across the selected period." action={<div className="segmented"><button className={period === "monthly" ? "selected" : ""} onClick={() => setPeriod("monthly")}>Monthly</button><button className={period === "quarterly" ? "selected" : ""} onClick={() => setPeriod("quarterly")}>Quarterly</button></div>}>
          <div className="h-80" aria-label="Sales and profit trend chart">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={summary.trend} margin={{ top: 8, right: 10, left: 8, bottom: 0 }}><CartesianGrid stroke="hsl(var(--line))" vertical={false} /><XAxis dataKey="label" minTickGap={22} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} width={64} /><Tooltip formatter={(value) => currency(Number(value))} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--line))", borderRadius: 10 }} /><Legend /><Line type="monotone" dataKey="sales" name="Sales" stroke="hsl(var(--brand))" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--positive))" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Sales by category" description="Revenue contribution across product groups.">
          <div className="h-80" aria-label="Sales by category donut chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="sales" nameKey="label" innerRadius="56%" outerRadius="80%" paddingAngle={4}>{categoryData.map((entry, index) => <Cell key={entry.label} fill={pieColors[index]} />)}</Pie><Tooltip formatter={(value) => currency(Number(value))} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--line))", borderRadius: 10 }} /><Legend /></PieChart></ResponsiveContainer></div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.65fr]">
        <ChartCard title="Sales by region" description="Compare regional revenue performance."><div className="h-72" aria-label="Sales by region bar chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={regionData} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="hsl(var(--line))" horizontal={false} /><XAxis type="number" tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" tick={{ fill: "hsl(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} width={54} /><Tooltip formatter={(value) => currency(Number(value))} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--line))", borderRadius: 10 }} /><Bar dataKey="sales" name="Sales" fill="hsl(var(--brand))" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></ChartCard>
        <ChartCard title="Recent orders" description="The ten latest orders in the selected date range, reflecting the current business view." action={<Link className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline" to="/products">Explore products <ArrowRight size={15} /></Link>}>
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Region</th><th>Date</th><th className="text-right">Sales</th></tr></thead><tbody>{recentOrders.map((row) => <tr key={row.rowId}><td className="font-medium">{row.orderId}</td><td>{row.customerName}</td><td>{row.region}</td><td>{dateLabel(row.orderDate)}</td><td className="text-right font-medium">{currency(row.sales)}</td></tr>)}</tbody></table></div>
        </ChartCard>
      </div>
    </>}
  </>;
}
