import { Database, LoaderCircle } from "lucide-react";

export function LoadingState({ message = "Loading analytical data…" }: { message?: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted">
      <LoaderCircle className="animate-spin text-brand" size={20} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  message = "No rows match the current selection.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface/60 p-8 text-center text-sm text-muted shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
        <Database size={20} />
      </div>
      {title && <h3 className="mt-2 text-base font-bold text-ink">{title}</h3>}
      <p className="max-w-md text-xs leading-relaxed text-muted">{message}</p>
    </div>
  );
}
