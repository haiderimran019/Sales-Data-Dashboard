import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, FilePlus2, LoaderCircle, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Project = { id: string; name: string };
type Version = { id: string; version_number: number };
type ExtractionMetadata = { tables?: { name: string; columns: string[]; rows: Record<string, unknown>[]; row_count?: number }[]; text_blocks?: { location: string; text: string }[]; warnings?: string[]; metadata?: Record<string, unknown> };
type UploadedFile = { detected_type: string | null; extraction_status: string; extraction_metadata: ExtractionMetadata | null };
type UploadItem = { filename: string; accepted: boolean; error?: string; file?: UploadedFile };
type Profile = { datasets: { id: string; name: string; row_count: number | null; column_count: number; quality_score: number | null; domain: string; domain_confidence: number; profile_scope: string; quality_details?: { warnings?: string[] } }[]; columns: { id: string; dataset_id: string; original_name: string; normalized_name: string; inferred_type: string; semantic_type: string; confidence: number; null_percentage: number; uniqueness_percentage: number; statistics?: { minimum?: number | string; maximum?: number | string; mean?: number; median?: number; } | null }[]; relationships: { left_dataset_id: string; left_column_id: string; right_dataset_id: string; right_column_id: string; relationship_type: string; confidence: number }[]; opportunities: { kind: string; title: string; description: string; confidence: number }[] };

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
    </section>
    {results.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">Processing results</h2>{results.map((item) => <article className="rounded-xl border border-line bg-white p-5 dark:bg-[#111827]" key={item.filename}><div className="flex items-center gap-2 text-sm font-medium">{item.accepted ? <CheckCircle2 className="text-emerald-600" size={17} /> : <AlertCircle className="text-amber-600" size={17} />}{item.filename}<span className="ml-auto text-xs text-muted">{item.file?.detected_type || "rejected"}</span></div>{item.error && <p className="mt-2 text-sm text-amber-800">{item.error}</p>}{item.file && <Preview metadata={item.file.extraction_metadata} />}</article>)}</section>}
    {understanding && <UnderstandingPanel profile={understanding} />}
  </div>;
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
