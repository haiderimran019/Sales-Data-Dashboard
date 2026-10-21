import { useMemo, useState } from "react";
import { Download, Search, SlidersHorizontal, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../components/ChartCard";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { monthly } from "../lib/analytics";
import { classNames, currency, dateLabel, number } from "../lib/utils";
import type { OrderRow } from "../types";

const pageSize = 12;

export function ProductsPage() {
  const { filteredRows, isLoading, error } = useData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const categories = useMemo(() => [...new Set(filteredRows.map((row) => row.category))].sort(), [filteredRows]);
  const subCategories = useMemo(() => [...new Set(filteredRows.filter((row) => !category || row.category === category).map((row) => row.subCategory))].sort(), [filteredRows, category]);
  const regions = useMemo(() => [...new Set(filteredRows.map((row) => row.region))].sort(), [filteredRows]);
  const matches = useMemo(() => filteredRows.filter((row) => (!search || `${row.productName} ${row.productId}`.toLowerCase().includes(search.toLowerCase())) && (!category || row.category === category) && (!subCategory || row.subCategory === subCategory) && (!region || row.region === region)), [filteredRows, search, category, subCategory, region]);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const displayedRows = matches.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  const reset = () => { setSearch(""); setCategory(""); setSubCategory(""); setRegion(""); setPage(1); };
  const exportRows = () => {
    const headers = ["Product ID", "Product Name", "Category", "Sub-Category", "Region", "Sales", "Quantity", "Discount", "Profit"];
    const body = matches.map((row) => [row.productId, row.productName, row.category, row.subCategory, row.region, row.sales, row.quantity, row.discount, row.profit].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" }));
    link.download = "superstore-products-filtered.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  return <>
    <PageHeader eyebrow="Product explorer" title="A detailed view of every product line." description="Search, filter, and inspect the underlying order lines, then export the current view for follow-up reviews or partner discussions." action={<button className="secondary-button" type="button" onClick={exportRows}><Download size={16} /> Export CSV</button>} />
    {!filteredRows.length ? <EmptyState /> : <ChartCard title="Filtered product data" description={`${number(matches.length)} matching order lines.`}>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.65fr_1fr_1fr_1fr_auto]">
        <label className="relative"><span className="sr-only">Search products</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} /><input className="control w-full pl-9" placeholder="Search product name or ID" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <SelectFilter label="Category" value={category} onChange={(value) => { setCategory(value); setSubCategory(""); setPage(1); }} options={categories} />
        <SelectFilter label="Sub-category" value={subCategory} onChange={(value) => { setSubCategory(value); setPage(1); }} options={subCategories} />
        <SelectFilter label="Region" value={region} onChange={(value) => { setRegion(value); setPage(1); }} options={regions} />
        <button className="secondary-button justify-center" type="button" onClick={reset}><SlidersHorizontal size={16} /> Reset</button>
      </div>
      <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Region</th><th className="text-right">Sales</th><th className="text-right">Qty.</th><th className="text-right">Discount</th><th className="text-right">Profit</th></tr></thead><tbody>{displayedRows.map((row) => <tr className="cursor-pointer hover:bg-brand/5" onClick={() => setSelected(row)} onKeyDown={(event) => event.key === "Enter" && setSelected(row)} tabIndex={0} key={row.rowId}><td><p className="max-w-80 truncate font-medium" title={row.productName}>{row.productName}</p><p className="mt-0.5 text-xs text-muted">{row.productId}</p></td><td>{row.category}<span className="block text-xs text-muted">{row.subCategory}</span></td><td>{row.region}</td><td className="text-right font-medium">{currency(row.sales)}</td><td className="text-right">{row.quantity}</td><td className="text-right">{(row.discount * 100).toFixed(0)}%</td><td className={classNames("text-right font-medium", row.profit < 0 && "text-negative")}>{currency(row.profit)}</td></tr>)}</tbody></table></div>
      <div className="mt-5 flex items-center justify-between gap-4 text-sm text-muted"><span>Page {Math.min(page, pages)} of {pages}</span><div className="flex gap-2"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="secondary-button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
    </ChartCard>}
    {selected && <ProductDrawer row={selected} allRows={filteredRows} close={() => setSelected(null)} />}
  </>;
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><select className="control w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ProductDrawer({ row, allRows, close }: { row: OrderRow; allRows: OrderRow[]; close: () => void }) {
  const rows = allRows.filter((item) => item.productId === row.productId);
  const trend = monthly(rows);
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-0" role="dialog" aria-modal="true" aria-labelledby="product-drawer-title"><button className="flex-1 cursor-default" aria-label="Close product profile" onClick={close} /><aside className="h-full w-full max-w-xl overflow-y-auto bg-surface p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-brand">Product profile</p><h2 id="product-drawer-title" className="mt-2 text-xl font-semibold leading-7">{row.productName}</h2><p className="mt-2 text-sm text-muted">{row.productId} · {row.category} / {row.subCategory}</p></div><button className="icon-button" type="button" onClick={close} aria-label="Close product profile"><X size={18} /></button></div><div className="mt-6 grid grid-cols-3 gap-3"><MiniMetric label="Sales" value={currency(rows.reduce((total, item) => total + item.sales, 0), true)} /><MiniMetric label="Profit" value={currency(rows.reduce((total, item) => total + item.profit, 0), true)} /><MiniMetric label="Lines" value={number(rows.length)} /></div><div className="mt-6"><h3 className="text-sm font-semibold">Sales trend</h3><p className="mt-1 text-sm text-muted">Monthly revenue for this product.</p><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><CartesianGrid stroke="hsl(var(--line))" vertical={false} /><XAxis dataKey="label" minTickGap={20} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => currency(Number(value), true)} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={54} /><Tooltip formatter={(value) => currency(Number(value))} /><Area type="monotone" dataKey="sales" name="Sales" stroke="hsl(var(--brand))" fill="hsl(var(--brand) / .2)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div><div className="mt-6 border-t border-line pt-5 text-sm text-muted"><p>Latest order: {dateLabel(row.orderDate)}</p><p className="mt-2">Current line: {currency(row.sales)} sales · {currency(row.profit)} profit</p></div></aside></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-brand/5 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>;
}
