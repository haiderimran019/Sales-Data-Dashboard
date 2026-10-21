/**
 * Reproduces the forecasting accuracy figures quoted in the README.
 *
 * This script runs the exact engine the dashboard ships (src/lib/forecaster.ts),
 * not a separate copy of the maths, so the published numbers cannot drift away
 * from the code. Run it with `npm run validate:forecast`.
 */
import { build } from "esbuild";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const csvPath = resolve(repoRoot, "data", "processed", "superstore_clean.csv");

/** Bundles the TypeScript engine so Node can import it directly. */
async function loadEngine() {
  const outfile = join(tmpdir(), `forecaster-${process.pid}.mjs`);
  await build({
    entryPoints: [resolve(here, "..", "src", "lib", "forecaster.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  const engine = await import(`file://${outfile}`);
  rmSync(outfile, { force: true });
  return engine;
}

/** Minimal CSV reader: the cleaned dataset has no quoted newlines. */
function readCsv(path) {
  const text = readFileSync(path, "utf8").trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = splitRow(headerLine);
  return lines.map((line) => {
    const cells = splitRow(line);
    return Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
  });
}

function splitRow(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function monthlySeries(records, column) {
  const totals = new Map();
  for (const record of records) {
    const period = String(record["Order Date"]).slice(0, 7);
    totals.set(period, (totals.get(period) ?? 0) + Number(record[column] ?? 0));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, value: Math.round(value * 100) / 100 }));
}

const money = (value) =>
  value === null || !Number.isFinite(value)
    ? "n/a"
    : `$${Math.round(value).toLocaleString("en-US")}`;
const pct = (value) =>
  value === null || !Number.isFinite(value) ? "n/a" : `${value.toFixed(1)}%`;
const num = (value) =>
  value === null || !Number.isFinite(value) ? "n/a" : value.toFixed(3);

const { forecastSeries } = await loadEngine();
const records = readCsv(csvPath);

console.log(`dataset: ${csvPath.replace(`${repoRoot}/`, "")}`);
console.log(`rows:    ${records.length.toLocaleString("en-US")}\n`);

let failures = 0;

for (const [measure, column] of [
  ["sales", "Sales"],
  ["profit", "Profit"],
]) {
  const series = monthlySeries(records, column);
  const result = forecastSeries(series, measure, 6);
  const { validation: v } = result;

  console.log("=".repeat(74));
  console.log(`${measure.toUpperCase()} — ${series.length} months (${series[0].period} to ${series.at(-1).period})`);
  console.log("=".repeat(74));
  console.log(`validation design : ${v.design}`);
  console.log(`candidates scored : ${v.candidatesEvaluated}`);
  console.log(`selection origins : ${v.selectionOrigins}`);
  console.log(`holdout origins   : ${v.holdoutOrigins}${v.holdoutRange ? ` (${v.holdoutRange.start} to ${v.holdoutRange.end})` : ""}`);
  console.log(`selected model    : ${v.reliability === "unvalidated" ? result.methodLabel : result.methodLabel} [${result.method}]`);
  console.log("");
  console.log(`  holdout MAPE    : ${pct(v.selected.mape)}`);
  console.log(`  holdout MAE     : ${money(v.selected.mae)}`);
  console.log(`  holdout MASE    : ${num(v.selected.mase)}`);
  console.log(`  forecasts scored: ${v.selected.forecastCount}`);
  console.log("");
  console.log(`  baseline (${v.baselineLabel})`);
  console.log(`  baseline MAPE   : ${pct(v.baseline.mape)}`);
  console.log(`  baseline MAE    : ${money(v.baseline.mae)}`);
  console.log(`  MAE improvement : ${pct(v.skillVsBaseline)}`);
  console.log("");
  console.log(`  verdict         : ${v.reliability} — ${v.reliabilityHeadline}`);
  console.log("");
  console.log("  same holdout, reference models:");
  for (const reference of v.references) {
    const mark = reference.selected ? " <- selected" : "";
    console.log(
      `    ${reference.label.padEnd(38)} MAPE ${pct(reference.score.mape).padStart(7)}  MAE ${money(reference.score.mae).padStart(10)}  MASE ${num(reference.score.mase).padStart(6)}${mark}`,
    );
  }
  console.log("");
  console.log("  error by horizon (holdout):");
  for (const h of v.perHorizon) {
    console.log(`    ${h.horizon} month ahead : MAE ${money(h.mae).padStart(10)}  MAPE ${pct(h.mape).padStart(7)}  (n=${h.count})`);
  }
  if (result.warnings.length) {
    console.log("\n  warnings:");
    for (const warning of result.warnings) console.log(`    - ${warning}`);
  }
  console.log("");

  // Guard rails: the published story must keep holding.
  if (!Number.isFinite(v.selected.mae)) {
    console.error(`FAIL: ${measure} produced no out-of-sample error measurement.`);
    failures += 1;
  }
  if (measure === "sales" && !(v.skillVsBaseline > 0)) {
    console.error("FAIL: the selected sales model no longer beats the seasonal-naive baseline.");
    failures += 1;
  }
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All checks passed.");
