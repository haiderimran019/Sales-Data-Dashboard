import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Lightbulb,
  ListChecks,
  Ruler,
  Sigma,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, LoadingState } from "../components/EmptyState";
import { useData } from "../context/DataContext";
import { generateInsightReport, type Finding, type FindingKind } from "../lib/aiAnalyst";
import { number } from "../lib/utils";

const KIND_META: Record<
  FindingKind,
  { label: string; blurb: string; chip: string; icon: typeof Ruler }
> = {
  measured: {
    label: "Measured",
    blurb: "Computed directly from the loaded rows. Reproducible.",
    chip: "border-brand/30 bg-brand/10 text-brand",
    icon: Sigma,
  },
  inferred: {
    label: "Inferred",
    blurb: "A reading of the measurements. Reasonable people could disagree.",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: Lightbulb,
  },
  action: {
    label: "Suggested action",
    blurb: "A proposed next step. Carries the most assumption.",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: ListChecks,
  },
};

function FindingCard({ finding }: { finding: Finding }) {
  const meta = KIND_META[finding.kind];
  const Icon = meta.icon;
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <article className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">{finding.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">{finding.detail}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.chip}`}
          title={meta.blurb}
        >
          {meta.label}
        </span>
      </div>

      {finding.caveat && (
        <p className="mt-4 flex gap-2.5 rounded-lg border border-line bg-canvas/60 p-3 text-xs leading-relaxed text-muted">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold text-ink">Limitation: </span>
            {finding.caveat}
          </span>
        </p>
      )}

      {finding.nextStep && (
        <p className="mt-3 flex gap-2.5 text-xs leading-relaxed text-muted">
          <ListChecks size={14} className="mt-0.5 shrink-0 text-brand" />
          <span>
            <span className="font-semibold text-ink">Next step: </span>
            {finding.nextStep}
          </span>
        </p>
      )}

      {finding.evidence.length > 0 && (
        <div className="mt-4 border-t border-line/60 pt-3">
          <button
            type="button"
            className="text-xs font-semibold text-brand hover:underline"
            onClick={() => setShowEvidence((current) => !current)}
            aria-expanded={showEvidence}
          >
            {showEvidence ? "Hide" : "Show"} the {finding.evidence.length} figure
            {finding.evidence.length === 1 ? "" : "s"} behind this
          </button>
          {showEvidence && (
            <ul className="mt-3 space-y-2">
              {finding.evidence.map((item) => (
                <li key={item.statement} className="text-xs leading-relaxed">
                  <p className="font-medium text-ink">{item.statement}</p>
                  <p className="text-muted">{item.basis}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

export function AIAnalystPage() {
  const { filteredRows, isLoading, error } = useData();
  const [filter, setFilter] = useState<FindingKind | "all">("all");
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => generateInsightReport(filteredRows), [filteredRows]);

  const visible = useMemo(
    () => (filter === "all" ? report.findings : report.findings.filter((f) => f.kind === filter)),
    [report, filter],
  );

  const copyBrief = () => {
    const text = report.findings
      .map((finding) => {
        const lines = [
          `[${KIND_META[finding.kind].label.toUpperCase()}] ${finding.title}`,
          finding.detail,
        ];
        if (finding.caveat) lines.push(`Limitation: ${finding.caveat}`);
        if (finding.nextStep) lines.push(`Next step: ${finding.nextStep}`);
        lines.push(...finding.evidence.map((e) => `  - ${e.statement} (${e.basis})`));
        return lines.join("\n");
      })
      .join("\n\n---\n\n");
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <LoadingState message="Computing findings…" />;
  if (error) return <EmptyState message={error} />;
  if (!filteredRows.length) {
    return (
      <EmptyState
        title="No rows in range"
        message="Widen the date filter to include transaction history and the findings will recompute."
      />
    );
  }

  const counts = {
    measured: report.findings.filter((f) => f.kind === "measured").length,
    inferred: report.findings.filter((f) => f.kind === "inferred").length,
    action: report.findings.filter((f) => f.kind === "action").length,
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Automated analysis"
          title="Findings, separated by how much they assume"
          description="A deterministic rule engine, not a language model. Every figure quoted below is recomputed from the rows in range, and each finding is labelled by whether it is arithmetic or judgement."
        />
        <button type="button" className="secondary-button" onClick={copyBrief}>
          {copied ? <CheckCircle size={16} className="text-positive" /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy brief"}
        </button>
      </div>

      {/* What this is, stated plainly. */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Sigma size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {report.method}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Analysed {number(report.rowsAnalysed)} order lines across {number(report.monthsCovered)}{" "}
              months. No model is called and no text is generated: the wording is fixed, the numbers
              are not. Findings that do not apply to the loaded data are left out rather than filled
              in with a plausible default.
            </p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-line/60 pt-4 sm:grid-cols-3">
          {(Object.keys(KIND_META) as FindingKind[]).map((kind) => (
            <div key={kind} className="text-xs">
              <dt className="flex items-center gap-2">
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${KIND_META[kind].chip}`}
                >
                  {KIND_META[kind].label}
                </span>
                <span className="font-bold text-ink">{counts[kind]}</span>
              </dt>
              <dd className="mt-1.5 leading-relaxed text-muted">{KIND_META[kind].blurb}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Show</span>
        <div className="segmented">
          <button
            type="button"
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            All ({report.findings.length})
          </button>
          {(Object.keys(KIND_META) as FindingKind[])
            .filter((kind) => counts[kind] > 0)
            .map((kind) => (
              <button
                key={kind}
                type="button"
                className={filter === kind ? "selected" : ""}
                onClick={() => setFilter(kind)}
              >
                {KIND_META[kind].label} ({counts[kind]})
              </button>
            ))}
        </div>
      </div>

      <div className="grid gap-5">
        {visible.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>

      {!visible.length && <EmptyState title="Nothing in this category" message="Try another filter." />}
    </div>
  );
}
