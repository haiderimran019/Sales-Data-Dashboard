import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, FilePlus2, LoaderCircle, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Project = { id: string; name: string };
type Version = { id: string; version_number: number };
type ExtractionMetadata = { tables?: { name: string; columns: string[]; rows: Record<string, unknown>[]; row_count?: number }[]; text_blocks?: { location: string; text: string }[]; warnings?: string[]; metadata?: Record<string, unknown> };
type UploadedFile = { detected_type: string | null; extraction_status: string; extraction_metadata: ExtractionMetadata | null };
type UploadItem = { filename: string; accepted: boolean; error?: string; file?: UploadedFile };
type Profile = { datasets: { id: string; name: string; row_count: number | null; column_count: number; quality_score: number | null; domain: string; domain_confidence: number; profile_scope: string; quality_details?: { warnings?: string[] } }[]; columns: { id: string; dataset_id: string; original_name: string; normalized_name: string; inferred_type: string; semantic_type: string; confidence: number; null_percentage: number; uniqueness_percentage: number; statistics?: { minimum?: number | string; maximum?: number | string; mean?: number; median?: number; } | null }[]; relationships: { left_dataset_id: string; left_column_id: string; right_dataset_id: string; right_column_id: string; relationship_type: string; confidence: number }[]; opportunities: { kind: string; title: string; description: string; confidence: number }[] };
type AnalysisRun = { id: string; status: string; plan: { analyses: { analysis_type: string }[] }; results: { id: string; analysis_type: string; title: string; description: string; status: string; result_data: { groups?: { key: string; value: number; contribution_percentage: number }[]; points?: { period: string; value: number; period_over_period_percentage: number | null }[]; bins?: { start: number; end: number; count: number }[]; coefficient?: number | null; potential_anomalies?: { row_index: number; value: number; severity: string }[]; [key: string]: unknown } | null; result_scope: string; warnings: string[] | null }[] };
type AIInsightRun = { id: string; provider: string; model: string; context_metadata: { dataset_count: number; result_count: number; limits: Record<string, boolean> }; items: { id: string; item_type: string; classification: string; priority_score: number; payload: { title?: string; summary?: string; recommendation?: string; question?: string; description?: string; explanation?: string; evidence?: { statement: string; source: string; scope: string }[]; supporting_evidence?: { statement: string; source: string; scope: string }[]; confidence?: number; uncertainty?: string; risks?: string[]; next_step?: string } }[] };
type Forecast = { id: string; date_column: string; measure_column: string; frequency: string; historical_observation_count: number; forecast_horizon: number; historical_values: { period: string; value: number }[]; forecast_values: { period: string; value: number }[]; lower_bound: { period: string; value: number }[]; upper_bound: { period: string; value: number }[]; method: string; mae: number | null; warnings: string[] | null; result_scope: string };

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const supported = ".csv,.xlsx,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp";

export function AddDataPage() {
  const { status } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [version, setVersion] = useState<Version | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [understanding, setUnderstanding] = useState<Profile | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsightRun | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`${apiUrl}/api/projects`, { credentials: "include" })
      .then((response) => response.json() as Promise<Project[]>)
      .then((loaded) => { setProjects(loaded); setProjectId(loaded[0]?.id || ""); })
      .catch(() => setMessage("The project list could not be loaded."));
  }, [status]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`${apiUrl}/api/projects/${projectId}/versions`, { credentials: "include" })
      .then((response) => response.json() as Promise<Version[]>)
      .then((versions) => setVersion(versions[0] || null))
      .catch(() => setMessage("The project version could not be loaded."));
  }, [projectId]);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files || []));
    setResults([]);
    setMessage(null);
    event.target.value = "";
  };

  const upload = async () => {
    if (!version || !files.length) return;
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    files.forEach((file) => body.append("uploads", file));
    try {
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/versions/${version.id}/files`, { method: "POST", body, credentials: "include" });
      const payload = await response.json() as { files?: UploadItem[]; detail?: string };
      if (!response.ok) throw new Error(payload.detail || "The files could not be uploaded.");
      setResults(payload.files || []);
      const profileResponse = await fetch(`${apiUrl}/api/projects/${projectId}/versions/${version.id}/profile`, { credentials: "include" });
      if (profileResponse.ok) setUnderstanding(await profileResponse.json() as Profile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The files could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  const createProject = async () => {
    if (!projectName.trim()) return;
    setCreatingProject(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/projects`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: projectName.trim() }) });
      if (!response.ok) throw new Error("The project could not be created.");
      const project = await response.json() as Project;
      setProjects([project]);
      setProjectId(project.id);
      setProjectName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The project could not be created.");
    } finally {
      setCreatingProject(false);
    }
  };

  const analyze = async () => {
    if (!version) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/versions/${version.id}/analyze`, { method: "POST", credentials: "include" });
      const payload = await response.json() as AnalysisRun & { detail?: string };
      if (!response.ok) throw new Error(payload.detail || "Analysis could not be completed.");
      setAnalysis(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const generateInsights = async () => {
    if (!version) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/versions/${version.id}/ai-insights`, { method: "POST", credentials: "include" });
      const payload = await response.json() as AIInsightRun & { detail?: string };
      if (!response.ok) throw new Error(payload.detail || "AI insights could not be generated.");
      setAiInsights(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI insights could not be generated.");
    } finally {
      setBusy(false);
    }
  };

  const generateForecast = async () => {
    if (!version || !understanding) return;
    const dataset = understanding.datasets[0];
    const dateColumn = understanding.columns.find((column) => column.dataset_id === dataset?.id && ["date", "datetime"].includes(column.semantic_type));
    const measureColumn = understanding.columns.find((column) => column.dataset_id === dataset?.id && column.semantic_type === "numeric_measure");
    if (!dataset || !dateColumn || !measureColumn) {
      setMessage("A forecast requires a date/datetime column and a numeric measure.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({ dataset_id: dataset.id, date_column: dateColumn.original_name, measure_column: measureColumn.original_name, horizon: "6" });
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/versions/${version.id}/forecasts?${query}`, { method: "POST", credentials: "include" });
      const payload = await response.json() as Forecast & { detail?: string };
      if (!response.ok) throw new Error(payload.detail || "Forecast could not be generated.");
      setForecast(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Forecast could not be generated.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-7">
    <div><p className="eyebrow">INGESTION</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Add data</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Upload files together and review the bounded extraction preview before analytical understanding is added.</p></div>
    {status === "unavailable" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The ingestion API is not running. The existing Superstore dashboard remains available through the CSV importer.</div>}
    {message && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={16} />{message}</div>}
    <section className="rounded-xl border border-line bg-white p-6 dark:bg-[#111827]">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-56 flex-1 text-sm font-medium">Project<select className="select-input mt-2 w-full" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <button className="secondary-button" type="button" onClick={() => input.current?.click()}><FilePlus2 size={16} /> Choose files</button>
        <input ref={input} className="sr-only" type="file" multiple accept={supported} onChange={selectFiles} />
      </div>
      {projects.length === 0 && <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5"><label className="min-w-56 flex-1 text-sm font-medium">Create a project<input className="text-input mt-2 w-full" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Quarterly sales review" /></label><button className="secondary-button" type="button" disabled={!projectName.trim() || creatingProject} onClick={() => void createProject()}>Create project</button></div>}
      <p className="mt-4 text-xs text-muted">Supported: CSV, Excel, PDF, Word, PowerPoint, PNG, JPG, and WEBP.</p>
      {files.length > 0 && <div className="mt-5 divide-y divide-line rounded-lg border border-line">{files.map((file) => <div className="flex items-center justify-between gap-3 p-3 text-sm" key={`${file.name}-${file.size}`}><span className="truncate">{file.name}</span><span className="shrink-0 text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</span></div>)}</div>}
      <button className="primary-button mt-5" type="button" disabled={!version || !files.length || busy} onClick={() => void upload()}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />} {busy ? "Processing" : "Upload and process"}</button>
      {understanding && <button className="secondary-button ml-3 mt-5" type="button" disabled={busy} onClick={() => void analyze()}>Analyze data</button>}
      {analysis && <button className="secondary-button ml-3 mt-5" type="button" disabled={busy} onClick={() => void generateInsights()}>Generate AI insights</button>}
      {analysis && <button className="secondary-button ml-3 mt-5" type="button" disabled={busy} onClick={() => void generateForecast()}>Generate forecast</button>}
    </section>
    {results.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">Processing results</h2>{results.map((item) => <article className="rounded-xl border border-line bg-white p-5 dark:bg-[#111827]" key={item.filename}><div className="flex items-center gap-2 text-sm font-medium">{item.accepted ? <CheckCircle2 className="text-emerald-600" size={17} /> : <AlertCircle className="text-amber-600" size={17} />}{item.filename}<span className="ml-auto text-xs text-muted">{item.file?.detected_type || "rejected"}</span></div>{item.error && <p className="mt-2 text-sm text-amber-800">{item.error}</p>}{item.file && <Preview metadata={item.file.extraction_metadata} />}</article>)}</section>}
    {understanding && <UnderstandingPanel profile={understanding} />}
    {analysis && <AnalysisPanel analysis={analysis} />}
    {aiInsights && <AIInsightsPanel run={aiInsights} />}
    {forecast && <ForecastPanel forecast={forecast} />}
  </div>;
}

function AnalysisPanel({ analysis }: { analysis: AnalysisRun }) {
  return <section className="space-y-5"><div><p className="eyebrow">ANALYSIS</p><h2 className="mt-2 text-2xl font-semibold">Deterministic analytical results</h2><p className="mt-2 text-sm text-muted">Results are calculations with reproducibility metadata. They are not causal explanations.</p></div><div className="grid gap-4 md:grid-cols-2">{analysis.results.map((result) => <article className="rounded-xl border border-line bg-white p-5 dark:bg-[#111827]" key={result.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{result.title}</h3><p className="mt-1 text-xs uppercase tracking-[0.1em] text-muted">{result.analysis_type.replaceAll("_", " ")} · {result.result_scope}</p></div><span className="text-xs text-muted">{visualizationHint(result.analysis_type)}</span></div><p className="mt-3 text-sm text-muted">{result.description}</p><ResultPreview type={result.analysis_type} data={result.result_data} />{result.warnings?.map((warning) => <p className="mt-2 text-xs text-amber-700" key={warning}>{warning}</p>)}</article>)}</div></section>;
}

function visualizationHint(type: string): string {
  if (type === "time_series") return "line chart";
  if (type === "grouped") return "bar chart";
  if (type === "distribution") return "histogram";
  if (type === "correlation") return "correlation card";
  if (type === "anomaly") return "anomaly list";
  return "metric card";
}

function ResultPreview({ type, data }: { type: string; data: AnalysisRun["results"][number]["result_data"] }) {
  if (!data) return <p className="mt-4 text-sm text-muted">No result available because prerequisites were not met.</p>;
  if (type === "grouped" && data.groups) return <div className="mt-4 space-y-2">{data.groups.slice(0, 5).map((group) => <div className="flex justify-between text-sm" key={group.key}><span>{group.key}</span><span className="font-medium">{group.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({group.contribution_percentage.toFixed(1)}%)</span></div>)}</div>;
  if (type === "time_series" && data.points) return <div className="mt-4 space-y-2">{data.points.slice(-5).map((point) => <div className="flex justify-between text-sm" key={point.period}><span>{point.period}</span><span className="font-medium">{point.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>)}</div>;
  if (type === "anomaly" && data.potential_anomalies) return <p className="mt-4 text-sm">{data.potential_anomalies.length} potential anomalies detected.</p>;
  if (type === "correlation") return <p className="mt-4 text-2xl font-semibold">{typeof data.coefficient === "number" ? data.coefficient.toFixed(3) : "Unavailable"}</p>;
  return <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900">{JSON.stringify(data, null, 2)}</pre>;
}

function AIInsightsPanel({ run }: { run: AIInsightRun }) {
  return <section className="space-y-4"><div><p className="eyebrow">AI ANALYST</p><h2 className="mt-2 text-2xl font-semibold">Evidence-backed interpretation</h2><p className="mt-2 text-sm text-muted">The provider received bounded profile and analytical context only. Calculations remain deterministic.</p></div><div className="grid gap-4 md:grid-cols-2">{run.items.sort((left, right) => right.priority_score - left.priority_score).map((item) => <article className="rounded-xl border border-line bg-white p-5 dark:bg-[#111827]" key={item.id}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{item.item_type.replaceAll("_", " ")}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.classification}</span></div><h3 className="mt-3 font-semibold">{item.payload.title || item.payload.question || "Analyst note"}</h3><p className="mt-2 text-sm leading-6 text-muted">{item.payload.summary || item.payload.recommendation || item.payload.description || item.payload.explanation || item.payload.question}</p>{(item.payload.evidence || item.payload.supporting_evidence)?.map((evidence) => <p className="mt-3 border-l-2 border-emerald-500 pl-3 text-xs text-muted" key={`${evidence.source}-${evidence.statement}`}>{evidence.statement} <span className="text-[10px]">({evidence.source}, {evidence.scope})</span></p>)}{item.payload.uncertainty && <p className="mt-3 text-xs text-amber-700">Uncertainty: {item.payload.uncertainty}</p>}{item.payload.next_step && <p className="mt-3 text-xs font-medium text-ink">Next step: {item.payload.next_step}</p>}</article>)}</div></section>;
}

function ForecastPanel({ forecast }: { forecast: Forecast }) {
  return <section className="space-y-4"><div><p className="eyebrow">FORECAST</p><h2 className="mt-2 text-2xl font-semibold">Deterministic forecast</h2><p className="mt-2 text-sm text-muted">{forecast.measure_column} forecast at {forecast.frequency} frequency using {forecast.method.replaceAll("_", " ")}.</p></div><article className="rounded-xl border border-line bg-white p-5 dark:bg-[#111827]"><div className="grid gap-3 text-sm sm:grid-cols-4"><p><span className="block text-xs text-muted">History</span>{forecast.historical_observation_count}</p><p><span className="block text-xs text-muted">Horizon</span>{forecast.forecast_horizon} periods</p><p><span className="block text-xs text-muted">MAE</span>{forecast.mae === null ? "Unavailable" : forecast.mae.toFixed(2)}</p><p><span className="block text-xs text-muted">Scope</span>{forecast.result_scope}</p></div><div className="mt-5 space-y-2">{forecast.forecast_values.map((point, index) => <div className="grid grid-cols-4 gap-2 text-sm" key={point.period}><span>{point.period}</span><span className="font-medium">{point.value.toFixed(2)}</span><span className="text-muted">{forecast.lower_bound[index]?.value.toFixed(2)} - {forecast.upper_bound[index]?.value.toFixed(2)}</span><span className="text-xs text-muted">interval</span></div>)}</div>{forecast.warnings?.map((warning) => <p className="mt-3 text-xs text-amber-700" key={warning}>{warning}</p>)}</article></section>;
}

function Preview({ metadata }: { metadata: ExtractionMetadata | null }) {
  if (!metadata) return null;
  const table = metadata.tables?.[0];
  return <div className="mt-4 border-t border-line pt-4 text-xs text-muted">{table ? <><p>{table.name}: {table.row_count ?? table.rows.length} rows, {table.columns.length} columns</p><div className="mt-2 overflow-x-auto"><table className="min-w-full text-left"><thead><tr>{table.columns.map((column) => <th className="px-2 py-1 font-medium" key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map((row, index) => <tr key={index}>{table.columns.map((column) => <td className="px-2 py-1" key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div></> : <p>{metadata.text_blocks?.[0]?.text || String(metadata.metadata?.ocr_status || "Metadata extracted; no tabular preview available.")}</p>}{metadata.warnings?.map((warning) => <p className="mt-2 text-amber-700" key={warning}>{warning}</p>)}</div>;
}

function UnderstandingPanel({ profile }: { profile: Profile }) {
  const datasetNames = new Map(profile.datasets.map((dataset) => [dataset.id, dataset.name]));
  const columnNames = new Map(profile.columns.map((column) => [column.id, `${datasetNames.get(column.dataset_id) || "Dataset"}.${column.original_name}`]));
  return <section className="space-y-5"><div><p className="eyebrow">DATA OVERVIEW</p><h2 className="mt-2 text-2xl font-semibold">Deterministic understanding</h2><p className="mt-2 text-sm text-muted">These classifications and scores are computed from the extracted data. They are evidence for later analysis, not AI-generated conclusions.</p></div>{profile.datasets.map((dataset) => <article className="rounded-xl border border-line bg-white p-5 dark:bg-[#111827]" key={dataset.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{dataset.name}</h3><p className="mt-1 text-sm text-muted">{dataset.row_count ?? "Document"} rows · {dataset.column_count} columns · {dataset.domain} ({Math.round(dataset.domain_confidence * 100)}% confidence)</p></div>{dataset.quality_score !== null && <div className="text-right"><p className="text-xs uppercase tracking-[0.12em] text-muted">Data quality</p><p className="mt-1 text-2xl font-semibold">{dataset.quality_score}/100</p></div>}</div><p className="mt-3 text-xs text-muted">Profile scope: {dataset.profile_scope === "preview" ? "bounded preview; statistics may be estimated" : "exact extracted rows"}</p></article>)}{profile.columns.length > 0 && <div className="overflow-x-auto rounded-xl border border-line bg-white dark:bg-[#111827]"><table className="min-w-full text-left text-xs"><thead className="border-b border-line text-muted"><tr><th className="px-4 py-3">Column</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Semantic meaning</th><th className="px-4 py-3">Missing</th><th className="px-4 py-3">Unique</th></tr></thead><tbody className="divide-y divide-line">{profile.columns.map((column) => <tr key={column.id}><td className="px-4 py-3 font-medium">{column.original_name}<span className="ml-2 text-muted">{column.normalized_name}</span></td><td className="px-4 py-3">{column.inferred_type}</td><td className="px-4 py-3">{column.semantic_type} ({Math.round(column.confidence * 100)}%)</td><td className="px-4 py-3">{column.null_percentage}%</td><td className="px-4 py-3">{column.uniqueness_percentage}%</td></tr>)}</tbody></table></div>}{profile.relationships.length > 0 && <section><h3 className="text-lg font-semibold">Potential relationships</h3><div className="mt-3 space-y-2">{profile.relationships.map((relationship, index) => <p className="rounded-lg border border-line bg-white p-3 text-sm dark:bg-[#111827]" key={index}>{columnNames.get(relationship.left_column_id)} → {columnNames.get(relationship.right_column_id)} <span className="text-muted">({relationship.relationship_type}, {Math.round(relationship.confidence * 100)}% confidence)</span></p>)}</div></section>}{profile.opportunities.length > 0 && <section><h3 className="text-lg font-semibold">Potential analysis</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{profile.opportunities.map((opportunity) => <article className="rounded-lg border border-line bg-white p-4 dark:bg-[#111827]" key={opportunity.kind}><p className="font-medium">{opportunity.title}</p><p className="mt-1 text-sm text-muted">{opportunity.description}</p><p className="mt-2 text-xs text-muted">{Math.round(opportunity.confidence * 100)}% deterministic confidence</p></article>)}</div></section>}</section>;
}
