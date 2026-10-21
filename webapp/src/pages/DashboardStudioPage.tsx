import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { API_URL } from "../lib/api";
import {
  dateValue,
  numericValue,
  parseCsvText,
  parseUniversalFile,
  type CellValue,
  type ParsedDataset,
} from "../lib/universalParser";

const numberFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const exactNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const moneyPattern = /sales|revenue|profit|cost|price|amount|income|expense|budget|value/i;
const percentagePattern = /percent|percentage|rate|margin|ratio|share/i;

const formatMeasure = (value: number, measure: string) => {
  if (moneyPattern.test(measure)) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (percentagePattern.test(measure)) return `${exactNumber.format(value)}%`;
  return numberFormat.format(value);
};

const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const chooseColumn = (names: string[], priority: RegExp) => names.find((name) => priority.test(name)) ?? names[0] ?? "";

export function DashboardStudioPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [measure, setMeasure] = useState("");
  const [dimension, setDimension] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);

  const loadDataset = useCallback((next: ParsedDataset) => {
    setDataset(next);
    const measures = next.columns.filter((column) => column.kind === "number").map((column) => column.name);
    const dimensions = next.columns.filter((column) => column.kind === "category").map((column) => column.name);
    const dates = next.columns.filter((column) => column.kind === "date").map((column) => column.name);
    setMeasure(chooseColumn(measures, /sales|revenue|amount|profit|total|value|quantity/i));
    setDimension(chooseColumn(dimensions, /category|region|segment|department|type|status/i));
    setDateColumn(chooseColumn(dates, /date|month|year|time/i));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/superstore_clean.csv`)
      .then((response) => {
        if (!response.ok) throw new Error("Sample dataset unavailable");
        return response.text();
      })
      .then((text) => loadDataset(parseCsvText(text, "Superstore sample.csv", text.length)))
      .catch(() => {
        setLoading(false);
        setDataset(null);
      });
  }, [loadDataset]);

  const processFile = useCallback(async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      loadDataset(await parseUniversalFile(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This file could not be analyzed.");
      setLoading(false);
    }
  }, [loadDataset]);

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    void processFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void processFile(event.dataTransfer.files?.[0]);
  };

  const numericColumns = dataset?.columns.filter((column) => column.kind === "number") ?? [];
  const dimensionColumns = dataset?.columns.filter((column) => column.kind === "category" || column.kind === "text") ?? [];
  const dateColumns = dataset?.columns.filter((column) => column.kind === "date") ?? [];

  const analytics = useMemo(() => {
    if (!dataset || dataset.type !== "table" || !measure) return null;
    const values = dataset.rows.map((row) => numericValue(row[measure] ?? null)).filter((value): value is number => value !== null);
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = values.length ? total / values.length : 0;
    const maximum = values.length ? Math.max(...values) : 0;
    const minimum = values.length ? Math.min(...values) : 0;

    const categoryMap = new Map<string, number>();
    if (dimension) dataset.rows.forEach((row) => {
      const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
      const value = numericValue(row[measure] ?? null) ?? 0;
      categoryMap.set(label, (categoryMap.get(label) ?? 0) + value);
    });
    const breakdown = [...categoryMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const periodMap = new Map<string, number>();
    if (dateColumn) dataset.rows.forEach((row) => {
      const date = dateValue(row[dateColumn] ?? null);
      if (!date) return;
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      periodMap.set(period, (periodMap.get(period) ?? 0) + (numericValue(row[measure] ?? null) ?? 0));
    });
    const trend = [...periodMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, value }));
    return { values, total, average, maximum, minimum, breakdown, trend };
  }, [dataset, measure, dimension, dateColumn]);

  const resetSample = () => {
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}data/superstore_clean.csv`)
      .then((response) => response.text())
      .then((text) => loadDataset(parseCsvText(text, "Superstore sample.csv", text.length)))
      .catch(() => setLoading(false));
  };

  return (
    <div className="studio-page -mx-4 -mt-7 md:-mx-7">
      <section className="studio-hero px-5 pb-8 pt-8 md:px-9 md:pb-10 md:pt-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand">
              <WandSparkles size={14} /> Business intelligence, without the setup
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-ink sm:text-5xl xl:text-[3.5rem] xl:leading-[1.02]">
              Turn business data into <span className="text-brand">clear decisions.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">
              Upload sales, finance, customer, inventory, or operations data. Autoboard finds the useful metrics and builds a simple dashboard in seconds.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {["Automatic business KPIs", "Customizable in one click", "Private browser processing"].map((item) => (
                <span key={item} className="flex items-center gap-2"><Check size={15} className="text-positive" />{item}</span>
              ))}
            </div>
          </div>

          <div
            className={`upload-dropzone w-full max-w-xl ${dragging ? "upload-dropzone-active" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" className="sr-only" accept=".csv,.tsv,.xlsx,.xls,.pdf,.docx,.doc" onChange={onInput} />
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-brand/20"><UploadCloud size={23} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Add your business data</p>
                <p className="mt-1 text-sm text-muted">CSV, Excel, PDF, or Word · up to 50 MB</p>
                <button type="button" className="primary-button mt-4" onClick={() => inputRef.current?.click()}>
                  Choose a file <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-7 md:px-7">
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><X size={17} /></button>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-[420px] place-items-center rounded-2xl border border-line bg-surface">
            <div className="text-center"><LoaderCircle className="mx-auto animate-spin text-brand" size={32} /><p className="mt-3 font-semibold text-ink">Understanding your data…</p><p className="mt-1 text-sm text-muted">Detecting fields, formats, and useful metrics</p></div>
          </div>
        ) : dataset ? (
          <>
            <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-positive/10 text-positive">{dataset.type === "table" ? <FileSpreadsheet size={21} /> : <FileText size={21} />}</span>
                <div className="min-w-0"><p className="truncate font-semibold text-ink">{dataset.name}</p><p className="mt-0.5 text-xs text-muted">{dataset.format} · {fileSize(dataset.size)} · {dataset.type === "table" ? `${dataset.rows.length.toLocaleString()} rows · ${dataset.columns.length} fields` : `${dataset.document?.words.toLocaleString()} words`}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="status-chip"><Sparkles size={13} /> Ready to explore</span>
                <button type="button" className="secondary-button" onClick={() => setCustomizing((value) => !value)}><Settings2 size={15} /> Customize <ChevronDown className={`transition-transform ${customizing ? "rotate-180" : ""}`} size={14} /></button>
                <button type="button" className="icon-button" onClick={resetSample} title="Restore sample dashboard" aria-label="Restore sample dashboard"><RefreshCw size={16} /></button>
              </div>
            </div>

            {customizing && dataset.type === "table" && (
              <section className="mb-5 grid gap-4 rounded-2xl border border-brand/20 bg-brand/[0.035] p-5 md:grid-cols-3">
                <Selector label="Primary measure" value={measure} options={numericColumns.map((column) => column.name)} onChange={setMeasure} />
                <Selector label="Break down by" value={dimension} options={dimensionColumns.map((column) => column.name)} onChange={setDimension} allowNone />
                <Selector label="Trend over time" value={dateColumn} options={dateColumns.map((column) => column.name)} onChange={setDateColumn} allowNone />
              </section>
            )}

            {dataset.type === "table" && analytics ? (
              <TableDashboard dataset={dataset} measure={measure} dimension={dimension} dateColumn={dateColumn} analytics={analytics} />
            ) : dataset.document ? (
              <DocumentDashboard dataset={dataset} />
            ) : null}
          </>
        ) : (
          <button className="mx-auto flex min-h-[360px] w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface p-10 text-center" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={34} className="text-brand" /><span className="mt-4 text-lg font-semibold text-ink">Upload your first dataset</span><span className="mt-2 text-sm text-muted">We’ll build the dashboard automatically.</span>
          </button>
        )}
      </section>
    </div>
  );
}

function Selector({ label, value, options, onChange, allowNone = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; allowNone?: boolean }) {
  return <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}<select className="select-input mt-2 w-full normal-case tracking-normal text-ink" value={value} onChange={(event) => onChange(event.target.value)}>{allowNone && <option value="">None</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

type TableAnalytics = { values: number[]; total: number; average: number; maximum: number; minimum: number; breakdown: { label: string; value: number }[]; trend: { period: string; value: number }[] };

function TableDashboard({ dataset, measure, dimension, dateColumn, analytics }: { dataset: ParsedDataset; measure: string; dimension: string; dateColumn: string; analytics: TableAnalytics }) {
  const [aiInsight, setAiInsight] = useState<{ headline: string; summary: string; actions: string[] } | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const findColumn = (pattern: RegExp) => dataset.columns.find((column) => pattern.test(column.name))?.name;
  const sumColumn = (column?: string) => column ? dataset.rows.reduce((total, row) => total + (numericValue(row[column] ?? null) ?? 0), 0) : 0;
  const uniqueColumn = (column?: string) => column ? new Set(dataset.rows.map((row) => String(row[column] ?? "")).filter(Boolean)).size : 0;
  const salesColumn = findColumn(/sales|revenue|income|turnover/i);
  const profitColumn = findColumn(/profit|net income|gross income/i);
  const customerColumn = findColumn(/customer.*id|client.*id|customer name|client name/i);
  const orderColumn = findColumn(/order.*id|invoice.*id|transaction.*id/i);
  const salesTotal = sumColumn(salesColumn);
  const profitTotal = sumColumn(profitColumn);
  const growth = analytics.trend.length > 1
    ? (analytics.trend.at(-2)?.value ? ((analytics.trend.at(-1)!.value - analytics.trend.at(-2)!.value) / Math.abs(analytics.trend.at(-2)!.value)) * 100 : null)
    : null;
  const kpis = [
    { label: `Total ${measure}`, value: formatMeasure(analytics.total, measure), detail: `${dataset.rows.length.toLocaleString()} business records`, tone: "brand" },
    ...(salesColumn && profitColumn && salesTotal ? [{ label: "Profit margin", value: `${(profitTotal / salesTotal * 100).toFixed(1)}%`, detail: `${formatMeasure(profitTotal, profitColumn)} total profit`, tone: profitTotal >= 0 ? "positive" : "ink" }] : []),
    ...(customerColumn ? [{ label: "Customers", value: uniqueColumn(customerColumn).toLocaleString(), detail: `Unique ${customerColumn.toLowerCase()}`, tone: "ink" }] : []),
    ...(orderColumn ? [{ label: "Orders", value: uniqueColumn(orderColumn).toLocaleString(), detail: `Unique ${orderColumn.toLowerCase()}`, tone: "ink" }] : []),
    ...(growth !== null ? [{ label: "Latest growth", value: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`, detail: "Latest period vs previous", tone: growth >= 0 ? "positive" : "ink" }] : []),
    { label: `Average ${measure}`, value: formatMeasure(analytics.average, measure), detail: "Average per record", tone: "ink" },
  ].slice(0, 4);
  const leadingShare = analytics.breakdown[0] && analytics.total ? Math.round(analytics.breakdown[0].value / analytics.total * 100) : null;
  const insight = analytics.breakdown[0]
    ? `${analytics.breakdown[0].label} leads ${dimension || "this breakdown"}, contributing ${leadingShare}% of total ${measure.toLowerCase()}.`
    : `The selected measure averages ${formatMeasure(analytics.average, measure)} across ${analytics.values.length.toLocaleString()} valid records.`;

  const generateGeminiInsight = async () => {
    setAiStatus("loading");
    setAiError("");
    try {
      const response = await fetch(`${API_URL}/api/dashboard/insights`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_name: dataset.name,
          row_count: dataset.rows.length,
          primary_measure: measure,
          total: analytics.total,
          average: analytics.average,
          growth_percentage: growth,
          primary_dimension: dimension || null,
          leading_group: analytics.breakdown[0]?.label ?? null,
          leading_group_share: leadingShare,
          available_fields: dataset.columns.slice(0, 40).map((column) => column.name),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Gemini is not available.");
      setAiInsight(payload);
      setAiStatus("idle");
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "Gemini is not available.");
      setAiStatus("error");
    }
  };

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((kpi) => <article key={kpi.label} className="metric-card"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{kpi.label}</p><span className={`metric-dot metric-dot-${kpi.tone}`} /></div><p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink">{kpi.value}</p><p className="mt-2 text-xs text-muted">{kpi.detail}</p></article>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <DashboardPanel title={dateColumn ? `${measure} trend` : `${measure} overview`} description={dateColumn ? `Monthly performance using ${dateColumn}` : "Performance across the selected dataset"}>
        <div className="h-[310px]">
          {analytics.trend.length > 1 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.trend} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="hsl(var(--brand-soft))" stopOpacity={0.28} /><stop offset="100%" stopColor="hsl(var(--brand-soft))" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="hsl(var(--line))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} minTickGap={26} /><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => numberFormat.format(value)} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} width={54} /><Tooltip formatter={(value) => formatMeasure(Number(value), measure)} /><Area type="monotone" dataKey="value" stroke="hsl(var(--brand-soft))" strokeWidth={2.5} fill="url(#trendFill)" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-xl bg-canvas/70 text-center"><div><BarChart3 className="mx-auto text-brand" size={26} /><p className="mt-3 text-sm font-semibold text-ink">No date field detected</p><p className="mt-1 text-xs text-muted">Choose a date field in Customize to add a trend.</p></div></div>}
        </div>
      </DashboardPanel>

      <DashboardPanel title={dimension ? `Performance by ${dimension}` : "Business breakdown"} description={dimension ? `Top ${dimension.toLowerCase()} groups by ${measure.toLowerCase()}` : "Choose a field to compare business groups"}>
        <div className="h-[310px]">{analytics.breakdown.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.breakdown} layout="vertical" margin={{ top: 4, right: 10, left: 4, bottom: 0 }}><CartesianGrid stroke="hsl(var(--line))" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => numberFormat.format(value)} tick={{ fill: "hsl(var(--muted))", fontSize: 10 }} /><YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={84} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} /><Tooltip formatter={(value) => formatMeasure(Number(value), measure)} /><Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 5, 5, 0]} barSize={14} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-muted">No categorical breakdown available.</div>}</div>
      </DashboardPanel>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
      <article className="insight-card">
        <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand"><Sparkles size={15} /> Business takeaway</span><span className="rounded-full bg-positive/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-positive">Verified metrics</span></div>
        <p className="mt-5 text-xl font-semibold leading-8 tracking-[-0.02em] text-ink">{aiInsight?.headline || insight}</p>
        <p className="mt-3 text-sm leading-6 text-muted">{aiInsight?.summary || "Built instantly from the selected metric. Ask Gemini for a short interpretation and practical next checks."}</p>
        {aiInsight?.actions?.length ? <ul className="mt-4 space-y-2 text-sm text-ink">{aiInsight.actions.map((action) => <li key={action} className="flex gap-2"><Check className="mt-0.5 shrink-0 text-positive" size={15} /><span>{action}</span></li>)}</ul> : null}
        {aiError ? <p className="mt-3 text-xs leading-5 text-negative">{aiError} Sign in and add GEMINI_API_KEY to the backend environment.</p> : null}
        <button type="button" className="primary-button mt-5" disabled={aiStatus === "loading"} onClick={() => void generateGeminiInsight()}>{aiStatus === "loading" ? <LoaderCircle className="animate-spin" size={15} /> : <WandSparkles size={15} />}{aiInsight ? "Refresh Gemini insight" : "Analyze with Gemini"}</button>
      </article>
      <DashboardPanel title="Data preview" description={`First ${Math.min(6, dataset.rows.length)} rows from ${dataset.name}`}>
        <div className="overflow-x-auto"><table className="data-table min-w-[620px]"><thead><tr>{dataset.columns.slice(0, 6).map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead><tbody>{dataset.rows.slice(0, 6).map((row, index) => <tr key={index}>{dataset.columns.slice(0, 6).map((column) => <td key={column.name} className="max-w-40 truncate pr-5" title={String(row[column.name] ?? "")}>{displayCell(row[column.name])}</td>)}</tr>)}</tbody></table></div>
      </DashboardPanel>
    </div>
  </div>;
}

function displayCell(value: CellValue | undefined) { if (value == null) return "—"; if (typeof value === "number") return exactNumber.format(value); return String(value); }

function DocumentDashboard({ dataset }: { dataset: ParsedDataset }) {
  const document = dataset.document!;
  const metrics = [
    { label: document.pages ? "Pages" : "Paragraphs", value: numberFormat.format(document.pages ?? document.paragraphs), detail: document.pages ? `${document.paragraphs.toLocaleString()} text blocks detected` : "Readable content blocks" },
    { label: "Words", value: numberFormat.format(document.words), detail: `${document.characters.toLocaleString()} characters` },
    { label: "Numeric signals", value: numberFormat.format(document.numbers), detail: "Numbers found in the document" },
    { label: "Business signals", value: numberFormat.format(document.currencies + document.percentages), detail: `${document.currencies} currency · ${document.percentages} percentage` },
  ];
  const termData = document.topTerms.map((item) => ({ label: item.term, value: item.count }));
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="metric-card"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{metric.label}</p><p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink">{metric.value}</p><p className="mt-2 text-xs text-muted">{metric.detail}</p></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
      <DashboardPanel title="Dominant themes" description="Most frequently occurring meaningful terms"><div className="h-[320px]">{termData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={termData} layout="vertical" margin={{ left: 4, right: 12 }}><XAxis type="number" hide /><YAxis dataKey="label" type="category" width={86} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--brand-soft))" radius={[0, 5, 5, 0]} barSize={15} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-muted">Not enough readable text to identify themes.</div>}</div></DashboardPanel>
      <DashboardPanel title="Document preview" description="Extracted locally from your file"><div className="max-h-[320px] overflow-y-auto rounded-xl bg-canvas/70 p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{dataset.text?.slice(0, 5000) || "No selectable text was found. This may be a scanned document that requires OCR."}</p></div></DashboardPanel>
    </div>
    <article className="insight-card flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand"><ShieldCheck size={15} /> Private by design</p><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">The preview and document metrics were created in your browser. For AI interpretation, the existing authenticated backend sends bounded analytical context—not the raw file—to Gemini.</p></div><Link to="/add-data" className="primary-button shrink-0">Continue to AI workspace <ArrowRight size={15} /></Link></article>
  </div>;
}

function DashboardPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="dashboard-panel"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-ink">{title}</h2><p className="mt-1 text-xs text-muted">{description}</p></div><LayoutDashboard size={17} className="text-muted" /></div>{children}</section>;
}
