import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileCheck,
  FilePlus2,
  FileSpreadsheet,
  FolderPlus,
  Layers,
  LineChart,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TableProperties,
  Upload,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import {
  API_URL,
  fetchJson,
  type AIInsightRun,
  type AnalysisRun,
  type ExtractionMetadata,
  type Forecast,
  type ProfileResponse,
  type Project,
  type ProjectVersion,
  type UploadItem,
} from "../lib/api";
import { currency, percent } from "../lib/utils";

const supportedExtensions = [
  { ext: ".csv", label: "CSV" },
  { ext: ".xlsx", label: "Excel" },
  { ext: ".pdf", label: "PDF" },
  { ext: ".docx", label: "Word" },
  { ext: ".pptx", label: "PowerPoint" },
  { ext: ".png/.jpg", label: "Images" },
];

export function AddDataPage() {
  const { status } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [version, setVersion] = useState<ProjectVersion | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  // New project creation state
  const [projectName, setProjectName] = useState<string>("");
  const [creatingProject, setCreatingProject] = useState<boolean>(false);

  // Pipeline result artifacts
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsightRun | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"profile" | "columns" | "analytics" | "ai" | "forecast">("profile");

  // Load project list
  const loadProjects = () => {
    if (status !== "authenticated") return;
    fetchJson<Project[]>("/api/projects")
      .then((loaded) => {
        setProjects(loaded);
        if (loaded.length > 0 && !projectId) {
          setProjectId(loaded[0].id);
        }
      })
      .catch(() => {
        // Silently handled in standalone mode
      });
  };

  useEffect(() => {
    loadProjects();
  }, [status]);

  // Load version when project changes
  useEffect(() => {
    if (!projectId) return;
    fetchJson<ProjectVersion[]>(`/api/projects/${projectId}/versions`)
      .then((versions) => {
        setVersion(versions[0] || null);
      })
      .catch(() => {
        setVersion(null);
      });
  }, [projectId]);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files || []));
    setUploadResults([]);
    setMessage(null);
    event.target.value = "";
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setCreatingProject(true);
    setMessage(null);
    try {
      const created = await fetchJson<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectName.trim() }),
      });
      setProjects((prev) => [created, ...prev]);
      setProjectId(created.id);
      setProjectName("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Project could not be created.");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleUploadAndProfile = async () => {
    if (!version || !files.length) return;
    setBusyStep("Uploading and profiling files...");
    setMessage(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("uploads", f));

    try {
      const response = await fetch(
        `${API_URL}/api/projects/${projectId}/versions/${version.id}/files`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Upload failed");
      setUploadResults(payload.files || []);

      // Fetch profile
      const prof = await fetchJson<ProfileResponse>(
        `/api/projects/${projectId}/versions/${version.id}/profile`
      );
      setProfile(prof);
      setActiveTab("profile");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload processing failed.");
    } finally {
      setBusyStep(null);
    }
  };

  const handleRunAnalytics = async () => {
    if (!version) return;
    setBusyStep("Computing statistical analytics...");
    setMessage(null);
    try {
      const result = await fetchJson<AnalysisRun>(
        `/api/projects/${projectId}/versions/${version.id}/analyze`,
        { method: "POST" }
      );
      setAnalysis(result);
      setActiveTab("analytics");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Analysis calculation failed.");
    } finally {
      setBusyStep(null);
    }
  };

  const handleRunAI = async () => {
    if (!version) return;
    setBusyStep("Synthesizing grounded AI insights...");
    setMessage(null);
    try {
      const run = await fetchJson<AIInsightRun>(
        `/api/projects/${projectId}/versions/${version.id}/ai-insights`,
        { method: "POST" }
      );
      setAiInsights(run);
      setActiveTab("ai");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "AI generation failed.");
    } finally {
      setBusyStep(null);
    }
  };

  const handleRunForecast = async () => {
    if (!version || !profile) return;
    const dataset = profile.datasets[0];
    const dateCol = profile.columns.find(
      (col) => col.dataset_id === dataset?.id && ["date", "datetime"].includes(col.semantic_type)
    );
    const measureCol = profile.columns.find(
      (col) => col.dataset_id === dataset?.id && col.semantic_type === "numeric_measure"
    );

    if (!dataset || !dateCol || !measureCol) {
      setMessage("A date column and numeric measure are required for time-series forecasting.");
      return;
    }

    setBusyStep("Calculating deterministic forecast...");
    setMessage(null);
    try {
      const query = new URLSearchParams({
        dataset_id: dataset.id,
        date_column: dateCol.original_name,
        measure_column: measureCol.original_name,
        horizon: "6",
      });
      const res = await fetchJson<Forecast>(
        `/api/projects/${projectId}/versions/${version.id}/forecasts?${query}`,
        { method: "POST" }
      );
      setForecast(res);
      setActiveTab("forecast");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Forecast generation failed.");
    } finally {
      setBusyStep(null);
    }
  };

  const handleRunFullPipeline = async () => {
    await handleUploadAndProfile();
    await handleRunAnalytics();
    await handleRunAI();
    await handleRunForecast();
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Universal Ingestion"
        title="Data Intake, Profiling & Processing Hub"
        description="Ingest business data across multiple formats. Every file is bounded, profiled for data quality, deterministically analyzed, and synthesized by the AI analyst."
      />

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertCircle size={17} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Ingestion & Intake Control Card */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <label className="min-w-64 flex-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Active Workspace / Project
              <select
                className="select-input mt-2 w-full font-medium normal-case text-ink"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Choose or create a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="secondary-button mt-6 shrink-0"
              onClick={() => inputRef.current?.click()}
            >
              <FilePlus2 size={16} /> Choose Files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={selectFiles}
            />
          </div>

          {files.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="primary-button"
                disabled={!version || Boolean(busyStep)}
                onClick={handleUploadAndProfile}
              >
                {busyStep ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
                {busyStep || "Upload & Profile"}
              </button>
            </div>
          )}
        </div>

        {/* Quick project creator if none exists */}
        {projects.length === 0 && (
          <div className="mt-5 flex flex-wrap items-end gap-3 border-b border-line pb-5">
            <label className="flex-1 min-w-56 text-xs font-semibold uppercase tracking-wider text-muted">
              Create New Project
              <input
                type="text"
                className="text-input mt-2 w-full text-sm font-normal"
                placeholder="e.g. Q3 Commercial Performance"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={!projectName.trim() || creatingProject}
              onClick={handleCreateProject}
            >
              <FolderPlus size={16} /> Create Workspace
            </button>
          </div>
        )}

        {/* File Format Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Supported formats:</span>
          {supportedExtensions.map((item) => (
            <span
              key={item.ext}
              className="rounded-md border border-line bg-canvas/60 px-2 py-0.5 text-[11px] font-medium text-muted"
            >
              {item.label}
            </span>
          ))}
        </div>

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="mt-5 divide-y divide-line rounded-lg border border-line bg-canvas/40">
            {files.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center justify-between p-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium text-ink">
                  <FileSpreadsheet size={16} className="text-brand" />
                  {file.name}
                </span>
                <span className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        )}

        {/* Multi-Step Pipeline Actions */}
        {profile && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-2">
              Pipeline Steps:
            </span>
            <button
              type="button"
              className={`secondary-button text-xs ${analysis ? "border-brand text-brand" : ""}`}
              disabled={Boolean(busyStep)}
              onClick={handleRunAnalytics}
            >
              <Layers size={15} /> Analyze Data
            </button>
            <button
              type="button"
              className={`secondary-button text-xs ${aiInsights ? "border-brand text-brand" : ""}`}
              disabled={Boolean(busyStep)}
              onClick={handleRunAI}
            >
              <BrainCircuit size={15} /> Generate AI Insights
            </button>
            <button
              type="button"
              className={`secondary-button text-xs ${forecast ? "border-brand text-brand" : ""}`}
              disabled={Boolean(busyStep)}
              onClick={handleRunForecast}
            >
              <LineChart size={15} /> Generate Forecast
            </button>
          </div>
        )}
      </section>

      {/* Pipeline Results Section */}
      {(profile || analysis || aiInsights || forecast) && (
        <section className="space-y-5">
          {/* Navigation tabs for results */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "profile"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-surface text-muted hover:text-ink border border-line"
              }`}
              onClick={() => setActiveTab("profile")}
            >
              Data Quality & Datasets
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "columns"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-surface text-muted hover:text-ink border border-line"
              }`}
              onClick={() => setActiveTab("columns")}
            >
              Column Schema ({profile?.columns.length || 0})
            </button>
            {analysis && (
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === "analytics"
                    ? "bg-brand text-white shadow-sm"
                    : "bg-surface text-muted hover:text-ink border border-line"
                }`}
                onClick={() => setActiveTab("analytics")}
              >
                Calculations & Trends
              </button>
            )}
            {aiInsights && (
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === "ai"
                    ? "bg-brand text-white shadow-sm"
                    : "bg-surface text-muted hover:text-ink border border-line"
                }`}
                onClick={() => setActiveTab("ai")}
              >
                AI Insights ({aiInsights.items.length})
              </button>
            )}
            {forecast && (
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === "forecast"
                    ? "bg-brand text-white shadow-sm"
                    : "bg-surface text-muted hover:text-ink border border-line"
                }`}
                onClick={() => setActiveTab("forecast")}
              >
                Forecast Result
              </button>
            )}
          </div>

          {/* Active Tab View */}
          {activeTab === "profile" && profile && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {profile.datasets.map((d) => (
                  <article key={d.id} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          {d.domain.toUpperCase()} · {Math.round(d.domain_confidence * 100)}% Confidence
                        </span>
                        <h3 className="mt-1 text-lg font-bold text-ink">{d.name}</h3>
                        <p className="mt-1 text-xs text-muted">
                          {d.row_count ?? "Unknown"} rows · {d.column_count} columns · Scope: {d.profile_scope}
                        </p>
                      </div>
                      {d.quality_score !== null && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            Quality Score
                          </p>
                          <p className="text-2xl font-black text-brand">{d.quality_score}/100</p>
                        </div>
                      )}
                    </div>

                    {d.quality_details?.warnings && d.quality_details.warnings.length > 0 && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                        <p className="font-semibold">Quality Alerts:</p>
                        <ul className="mt-1 list-disc pl-4 space-y-1">
                          {d.quality_details.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {profile.opportunities.length > 0 && (
                <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-ink">Detected Analysis Opportunities</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {profile.opportunities.map((opp, i) => (
                      <div key={i} className="rounded-lg border border-line bg-canvas/60 p-3 text-xs">
                        <p className="font-semibold text-ink">{opp.title}</p>
                        <p className="mt-1 text-muted">{opp.description}</p>
                        <p className="mt-2 text-[10px] font-semibold text-brand">
                          {Math.round(opp.confidence * 100)}% Confidence
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "columns" && profile && (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Inferred Type</th>
                    <th>Semantic Meaning</th>
                    <th>Missing</th>
                    <th>Uniqueness</th>
                    <th>Summary Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.map((c) => (
                    <tr key={c.id} className="hover:bg-canvas/50">
                      <td className="font-semibold text-ink">
                        {c.original_name}
                        <span className="ml-2 text-[11px] font-normal text-muted">
                          ({c.normalized_name})
                        </span>
                      </td>
                      <td className="text-xs">{c.inferred_type}</td>
                      <td className="text-xs font-medium text-brand">
                        {c.semantic_type} ({Math.round(c.confidence * 100)}%)
                      </td>
                      <td className="text-xs">{c.null_percentage}%</td>
                      <td className="text-xs">{c.uniqueness_percentage}%</td>
                      <td className="text-xs text-muted">
                        {c.statistics?.mean !== undefined
                          ? `mean: ${c.statistics.mean.toFixed(1)}`
                          : c.statistics?.minimum !== undefined
                          ? `min: ${c.statistics.minimum}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "analytics" && analysis && (
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.results.map((res) => (
                <article key={res.id} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {res.analysis_type.replace("_", " ")} · {res.result_scope}
                      </span>
                      <h4 className="mt-1 font-bold text-ink">{res.title}</h4>
                      <p className="mt-1 text-xs text-muted">{res.description}</p>
                    </div>
                  </div>

                  {res.result_data?.groups && (
                    <div className="mt-4 space-y-1.5 border-t border-line/60 pt-3 text-xs">
                      {res.result_data.groups.slice(0, 4).map((g) => (
                        <div key={g.key} className="flex justify-between">
                          <span className="text-ink">{g.key}</span>
                          <span className="font-semibold text-brand">
                            {currency(g.value, false)} ({g.contribution_percentage.toFixed(1)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {res.result_data?.points && (
                    <div className="mt-4 space-y-1.5 border-t border-line/60 pt-3 text-xs">
                      {res.result_data.points.slice(-4).map((p) => (
                        <div key={p.period} className="flex justify-between">
                          <span className="text-ink">{p.period}</span>
                          <span className="font-semibold text-brand">{currency(p.value, false)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {res.warnings && res.warnings.length > 0 && (
                    <div className="mt-3 text-[11px] text-amber-700">
                      {res.warnings.map((w, i) => (
                        <p key={i}>{w}</p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {activeTab === "ai" && aiInsights && (
            <div className="grid gap-4 md:grid-cols-2">
              {aiInsights.items.map((item) => (
                <article key={item.id} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                      {item.classification}
                    </span>
                    <span className="text-xs text-muted">
                      Priority: {Math.round(item.priority_score * 100)}%
                    </span>
                  </div>
                  <h4 className="mt-3 font-bold text-ink">
                    {item.payload.title || item.payload.question || "Strategic Point"}
                  </h4>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {item.payload.summary || item.payload.recommendation}
                  </p>
                  {item.payload.next_step && (
                    <p className="mt-3 text-xs font-semibold text-brand">
                      Next Step: {item.payload.next_step}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}

          {activeTab === "forecast" && forecast && (
            <article className="rounded-xl border border-line bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-ink">
                    {forecast.measure_column} Forecast ({forecast.frequency})
                  </h4>
                  <p className="mt-1 text-xs text-muted">
                    Fitted with {forecast.method.replace("_", " ")} over{" "}
                    {forecast.historical_observation_count} historical periods.
                  </p>
                </div>
                <span className="rounded bg-positive/15 px-2.5 py-1 text-xs font-bold text-positive">
                  MAE: {forecast.mae !== null ? forecast.mae.toFixed(2) : "N/A"}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {forecast.forecast_values.map((f, i) => (
                  <div key={f.period} className="rounded-lg border border-line bg-canvas/60 p-3 text-xs">
                    <span className="font-semibold text-ink">{f.period}</span>
                    <p className="mt-1 text-sm font-bold text-brand">{currency(f.value, false)}</p>
                    <p className="text-[10px] text-muted">
                      Range: {currency(forecast.lower_bound[i]?.value || 0, true)} –{" "}
                      {currency(forecast.upper_bound[i]?.value || 0, true)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>
      )}
    </div>
  );
}
