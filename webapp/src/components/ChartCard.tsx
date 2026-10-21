import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function ChartCard({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <motion.section
      className="rounded-xl border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}
