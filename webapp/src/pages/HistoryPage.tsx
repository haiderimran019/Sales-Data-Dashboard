import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Clock,
  FolderGit2,
  History,
  Layers,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { fetchJson, type Project, type ProjectVersion } from "../lib/api";

type ProjectDetail = {
  project: Project;
  versions: ProjectVersion[];
};

export function HistoryPage() {
  const { status } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = () => {
    if (status !== "authenticated") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchJson<Project[]>("/api/analytics/history")
      .then((data) => {
        setProjects(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load project history.");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [status]);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    fetchJson<ProjectDetail>(`/api/analytics/history/${projectId}`)
      .then((detail) => setSelectedDetail(detail))
      .catch(() => setSelectedDetail(null));
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Audit & Versioning"
          title="Analytical Workspace History"
          description="A permanent, reproducible record of saved project workspaces, analytical versions, and diagnostic runs."
        />
        <button
          type="button"
          className="secondary-button"
          onClick={loadHistory}
          title="Refresh saved project list"
        >
          <RefreshCw size={15} /> Refresh History
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}

      {status !== "authenticated" && (
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Sign in to sync project history</h3>
              <p className="mt-1 text-sm text-muted">
                You are currently running in standalone dashboard mode. Sign in with your account to persist multi-dataset projects, save version snapshots, and track audit history in the cloud database.
              </p>
            </div>
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <EmptyState
          title="No saved workspaces yet"
          message="Saved analytical projects and version snapshots will appear here as work is created in the Ingestion hub."
        />
      )}

      {projects.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Project List */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Saved Projects ({projects.length})
            </h3>
            <div className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card overflow-hidden">
              {projects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex w-full items-center justify-between p-4 text-left transition-colors ${
                      isSelected
                        ? "bg-brand/10 dark:bg-brand/20 border-l-4 border-l-brand"
                        : "hover:bg-canvas/50"
                    }`}
                    onClick={() => handleSelectProject(p.id)}
                  >
                    <div>
                      <h4 className="font-semibold text-ink text-sm">{p.name}</h4>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <Clock size={12} />
                        Updated {new Date(p.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className={isSelected ? "text-brand" : "text-muted"}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Project Details & Versions */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Workspace Breakdown
            </h3>
            {selectedDetail ? (
              <div className="rounded-xl border border-line bg-surface p-6 shadow-card space-y-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                    Active Selection
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-ink">
                    {selectedDetail.project.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    Workspace Slug: <code className="font-mono">{selectedDetail.project.slug}</code>
                  </p>
                </div>

                <div className="border-t border-line pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                    Registered Versions ({selectedDetail.versions.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDetail.versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="flex items-center justify-between rounded-lg border border-line bg-canvas/60 p-3 text-xs"
                      >
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <Layers size={14} className="text-brand" />
                          Version {ver.version_number}
                        </span>
                        <span className="text-muted">
                          Created {new Date(ver.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line bg-surface/50 p-8 text-center text-muted text-xs">
                Select a project on the left to inspect its version records.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
