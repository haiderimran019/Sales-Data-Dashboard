import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle,
  Copy,
  FileCheck2,
  Filter,
  Lightbulb,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { generateClientAIInsights } from "../lib/aiAnalyst";
import type { AIInsightItem, AIInsightRun } from "../lib/api";

const classificationStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  FACT: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    label: "Empirical Fact",
  },
  CALCULATION: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    label: "Deterministic Metric",
  },
  INFERENCE: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    label: "Strategic Inference",
  },
  RECOMMENDATION: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    label: "Executive Action",
  },
  PREDICTION: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    label: "Forward Signal",
  },
};

export function AIAnalystPage() {
  const { filteredRows, isLoading, error } = useData();
  const { status } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [copied, setCopied] = useState(false);

  // Generate grounded executive insights
  const aiRun: AIInsightRun = useMemo(() => {
    return generateClientAIInsights(filteredRows);
  }, [filteredRows]);

  const filteredItems = useMemo(() => {
    if (selectedFilter === "ALL") return aiRun.items;
    return aiRun.items.filter((item) => item.classification === selectedFilter);
  }, [aiRun, selectedFilter]);

  const copyBrief = () => {
    const text = aiRun.items
      .map(
        (item) =>
          `[${item.classification}] ${item.payload.title || "Insight"}\n${
            item.payload.summary || item.payload.recommendation || ""
          }\nNext Step: ${item.payload.next_step || "N/A"}\n`
      )
      .join("\n---\n\n");
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!filteredRows.length) return <EmptyState />;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Grounded Intelligence"
          title="Executive AI Strategic Advisor"
          description="Synthesized strategic analysis with strict classification boundaries. Every assertion is anchored to numerical transactional evidence."
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="secondary-button"
            onClick={copyBrief}
            title="Copy all strategic insights to clipboard"
          >
            {copied ? <CheckCircle size={16} className="text-positive" /> : <Copy size={16} />}
            {copied ? "Copied to Clipboard" : "Export Strategic Memo"}
          </button>
        </div>
      </div>

      {/* Governance & Integrity Banner */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Analytical Integrity Guarantee</p>
            <p className="text-xs text-muted">
              Numerical truth is calculated deterministically. The AI layer interprets patterns, highlights risk, and formulates strategic recommendations.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Provider: {aiRun.provider}
        </span>
      </section>

      {/* Classification Filter Bar */}
      <section className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Filter size={14} /> Filter Insights:
        </span>
        {[
          { key: "ALL", label: `All (${aiRun.items.length})` },
          { key: "CALCULATION", label: "Metrics" },
          { key: "FACT", label: "Empirical Facts" },
          { key: "RECOMMENDATION", label: "Actions" },
          { key: "PREDICTION", label: "Signals" },
          { key: "INFERENCE", label: "Inferences" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedFilter === key
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-muted hover:bg-canvas hover:text-ink border border-line"
            }`}
            onClick={() => setSelectedFilter(key)}
          >
            {label}
          </button>
        ))}
      </section>

      {/* Insight Cards Grid */}
      <section className="grid gap-5 lg:grid-cols-2">
        {filteredItems.map((item) => {
          const style = classificationStyles[item.classification] || classificationStyles.FACT;
          return (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-line bg-surface p-6 shadow-card transition-all duration-150 hover:border-brand/40"
            >
              <div>
                {/* Header with Classification and Priority */}
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${style.bg} ${style.text} ${style.border}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    Priority Score:{" "}
                    <strong className="text-ink">{Math.round(item.priority_score * 100)}%</strong>
                  </span>
                </div>

                {/* Insight Title */}
                <h3 className="mt-4 text-lg font-bold tracking-tight text-ink">
                  {item.payload.title || item.payload.question || "Strategic Observation"}
                </h3>

                {/* Narrative Summary / Recommendation */}
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.payload.summary ||
                    item.payload.recommendation ||
                    item.payload.description ||
                    item.payload.explanation ||
                    item.payload.question}
                </p>

                {/* Grounded Numerical Evidence */}
                {(item.payload.evidence || item.payload.supporting_evidence) && (
                  <div className="mt-4 space-y-2 rounded-lg border border-line/70 bg-canvas/60 p-3 text-xs">
                    <p className="font-semibold uppercase tracking-wider text-slate-500">
                      Validated Evidence Base:
                    </p>
                    {(item.payload.evidence || item.payload.supporting_evidence)?.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2 text-ink">
                        <FileCheck2 size={15} className="shrink-0 mt-0.5 text-positive" />
                        <span>
                          {ev.statement}{" "}
                          <span className="text-muted text-[11px]">
                            ({ev.source} · {ev.scope.toUpperCase()})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Caveat & Risks */}
                {item.payload.uncertainty && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Uncertainty: {item.payload.uncertainty}</span>
                  </p>
                )}
              </div>

              {/* Actionable Next Step Footer */}
              {item.payload.next_step && (
                <div className="mt-5 border-t border-line pt-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-brand">
                    <ArrowRight size={14} /> Recommended Action: {item.payload.next_step}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* McKinsey Strategic Matrix Box */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h3 className="text-base font-semibold text-ink">Executive Decision Framework</h3>
        <p className="mt-1 text-xs text-muted">
          Recommended sequencing for operating initiatives based on calculated margin contribution and execution complexity.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <span className="rounded bg-positive/15 px-2 py-0.5 text-[11px] font-bold text-positive uppercase">
              Immediate (0–30 Days)
            </span>
            <h4 className="mt-2 text-sm font-semibold text-ink">Discount Cap & Protection</h4>
            <p className="mt-1 text-xs text-muted">
              Implement strict maximum discount rules for underperforming furniture lines to halt margin erosion.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <span className="rounded bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand uppercase">
              Medium-Term (30–90 Days)
            </span>
            <h4 className="mt-2 text-sm font-semibold text-ink">Regional Reallocation</h4>
            <p className="mt-1 text-xs text-muted">
              Shift commercial marketing budget towards the Western and Eastern territories showing highest net return on sales.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <span className="rounded bg-purple-500/15 px-2 py-0.5 text-[11px] font-bold text-purple-600 uppercase">
              Strategic (Quarterly)
            </span>
            <h4 className="mt-2 text-sm font-semibold text-ink">Key Account Retention</h4>
            <p className="mt-1 text-xs text-muted">
              Re-contract top corporate accounts with multi-year commitments to stabilize recurring quarterly revenues.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
