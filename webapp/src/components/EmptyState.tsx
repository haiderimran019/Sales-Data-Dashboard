import { Database, LoaderCircle } from "lucide-react";

export function LoadingState() {
  return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle className="animate-spin" size={18} /> Loading cleaned Superstore data…</div>;
}

export function EmptyState({ message = "No rows match the current selection." }: { message?: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted"><Database size={20} /><span>{message}</span></div>;
}
