import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { classNames } from "../lib/utils";

type Props = {
  label: string;
  value: string;
  detail: string;
  delta?: number | null;
  emphasis?: "positive" | "default";
};

export function KpiCard({ label, value, detail, delta, emphasis = "default" }: Props) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isUp = (delta ?? 0) >= 0;

  return (
    <motion.article
      className="rounded-xl border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={classNames("mt-3 text-3xl font-semibold tracking-tight", emphasis === "positive" && "text-positive")}>{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {hasDelta && (
          <span className={classNames("inline-flex items-center gap-0.5 font-medium", isUp ? "text-positive" : "text-negative")}>
            {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(delta as number).toFixed(1)}%
          </span>
        )}
        <span className="text-muted">{detail}</span>
      </div>
    </motion.article>
  );
}
