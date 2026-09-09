import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Project = {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export function HistoryPage() {
  const { status } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`${apiUrl}/api/analytics/history`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved history could not be loaded.");
        return response.json() as Promise<Project[]>;
      })
      .then(setProjects)
      .catch((reason: Error) => setError(reason.message));
  }, [status]);

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">MY ANALYTICS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Saved project history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Projects and versions will appear here as analysis work is saved. This phase stores workspace metadata only.</p>
      </div>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      {!error && projects.length === 0 && (
        <div className="rounded-xl border border-line bg-white p-8 text-center dark:bg-[#111827]">
          <History className="mx-auto text-muted" size={24} />
          <p className="mt-3 text-sm font-medium">No saved projects yet</p>
          <p className="mt-1 text-sm text-muted">Your future analyses and versions will be listed here.</p>
        </div>
      )}
      {projects.length > 0 && (
        <div className="divide-y divide-line rounded-xl border border-line bg-white dark:bg-[#111827]">
          {projects.map((project) => <article className="flex items-center justify-between gap-4 p-5" key={project.id}>
            <div><h2 className="font-medium">{project.name}</h2><p className="mt-1 text-xs text-muted">Updated {new Date(project.updated_at).toLocaleDateString()}</p></div>
            <RefreshCw className="text-muted" size={17} aria-hidden="true" />
          </article>)}
        </div>
      )}
    </div>
  );
}
