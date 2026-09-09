import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, FilePlus2, LoaderCircle, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Project = { id: string; name: string };
type Version = { id: string; version_number: number };
type ExtractionMetadata = { tables?: { name: string; columns: string[]; rows: Record<string, unknown>[]; row_count?: number }[]; text_blocks?: { location: string; text: string }[]; warnings?: string[]; metadata?: Record<string, unknown> };
type UploadedFile = { detected_type: string | null; extraction_status: string; extraction_metadata: ExtractionMetadata | null };
type UploadItem = { filename: string; accepted: boolean; error?: string; file?: UploadedFile };

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
  </div>;
}

function Preview({ metadata }: { metadata: ExtractionMetadata | null }) {
  if (!metadata) return null;
  const table = metadata.tables?.[0];
  return <div className="mt-4 border-t border-line pt-4 text-xs text-muted">{table ? <><p>{table.name}: {table.row_count ?? table.rows.length} rows, {table.columns.length} columns</p><div className="mt-2 overflow-x-auto"><table className="min-w-full text-left"><thead><tr>{table.columns.map((column) => <th className="px-2 py-1 font-medium" key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map((row, index) => <tr key={index}>{table.columns.map((column) => <td className="px-2 py-1" key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div></> : <p>{metadata.text_blocks?.[0]?.text || String(metadata.metadata?.ocr_status || "Metadata extracted; no tabular preview available.")}</p>}{metadata.warnings?.map((warning) => <p className="mt-2 text-amber-700" key={warning}>{warning}</p>)}</div>;
}
