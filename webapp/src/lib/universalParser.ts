import Papa from "papaparse";

export type CellValue = string | number | boolean | null;
export type DataRecord = Record<string, CellValue>;

export type ColumnProfile = {
  name: string;
  kind: "number" | "date" | "category" | "text";
  filled: number;
  unique: number;
  sample: string;
};

export type DocumentProfile = {
  pages?: number;
  paragraphs: number;
  words: number;
  characters: number;
  numbers: number;
  currencies: number;
  percentages: number;
  topTerms: { term: string; count: number }[];
};

export type ParsedDataset = {
  name: string;
  type: "table" | "document";
  format: string;
  size: number;
  rows: DataRecord[];
  columns: ColumnProfile[];
  sheets?: string[];
  text?: string;
  document?: DocumentProfile;
  warning?: string;
};

const emptyValues = new Set(["", "null", "undefined", "n/a", "na", "-"]);
const stopWords = new Set([
  "about", "after", "again", "also", "and", "are", "been", "before", "being", "between",
  "but", "can", "could", "data", "does", "each", "from", "have", "into", "more", "most",
  "not", "only", "other", "our", "over", "such", "than", "that", "the", "their", "then",
  "there", "these", "they", "this", "through", "was", "were", "what", "when", "where", "which",
  "will", "with", "would", "you", "your",
]);

const cleanCell = (value: unknown): CellValue => {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text || null;
};

export const numericValue = (value: CellValue): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || emptyValues.has(value.trim().toLowerCase())) return null;
  const negative = /^\(.*\)$/.test(value.trim());
  const normalized = value.replace(/[,$£€¥%()\s]/g, "");
  if (!normalized || !/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? (negative ? -result : result) : null;
};

export const dateValue = (value: CellValue): Date | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text || /^\d+(\.\d+)?$/.test(text)) return null;
  const datePattern = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;
  const namedMonthPattern = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i;
  if (!datePattern.test(text) && !namedMonthPattern.test(text)) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeRows = (input: Record<string, unknown>[]) => input
  .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim() || "Untitled", cleanCell(value)])))
  .filter((row) => Object.values(row).some((value) => value !== null));

const xmlDocument = (source: string) => new DOMParser().parseFromString(source, "application/xml");
const cellIndex = (reference: string) => {
  const letters = reference.match(/[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
};

async function parseXlsx(file: File): Promise<ParsedDataset> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const workbookFile = zip.file("xl/workbook.xml");
  const relationshipsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relationshipsFile) throw new Error("This XLSX workbook is missing required spreadsheet data.");
  const workbook = xmlDocument(await workbookFile.async("text"));
  const relationships = xmlDocument(await relationshipsFile.async("text"));
  const relationshipMap = new Map([...relationships.getElementsByTagName("Relationship")].map((node) => [node.getAttribute("Id"), node.getAttribute("Target")]));
  const sheets = [...workbook.getElementsByTagName("sheet")];
  const sheetNames = sheets.map((sheet) => sheet.getAttribute("name") || "Sheet");
  const firstSheet = sheets[0];
  const relationshipId = firstSheet?.getAttribute("r:id");
  const target = relationshipId ? relationshipMap.get(relationshipId) : null;
  const sheetPath = target ? `xl/${target.replace(/^\//, "").replace(/^xl\//, "")}` : "xl/worksheets/sheet1.xml";
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error("No readable worksheet was found in this Excel file.");

  const sharedFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedFile
    ? [...xmlDocument(await sharedFile.async("text")).getElementsByTagName("si")].map((node) => [...node.getElementsByTagName("t")].map((part) => part.textContent || "").join(""))
    : [];
  const sheet = xmlDocument(await sheetFile.async("text"));
  const matrix = [...sheet.getElementsByTagName("row")].map((row) => {
    const values: CellValue[] = [];
    [...row.getElementsByTagName("c")].forEach((cell) => {
      const index = cellIndex(cell.getAttribute("r") || "A1");
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? cell.getElementsByTagName("t")[0]?.textContent ?? "";
      if (type === "s") values[index] = sharedStrings[Number(raw)] ?? "";
      else if (type === "b") values[index] = raw === "1";
      else if (type === "inlineStr" || type === "str") values[index] = raw;
      else values[index] = raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    });
    return values;
  }).filter((row) => row.some((value) => value != null && value !== ""));
  if (matrix.length < 2) throw new Error("No tabular rows were found in this Excel file.");
  const headers = matrix[0].map((value, index) => String(value || `Column ${index + 1}`).trim());
  const records = matrix.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => {
    const value = row[index] ?? null;
    if (/date|time/i.test(header) && typeof value === "number" && value > 20_000 && value < 100_000) {
      return [header, new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10)];
    }
    return [header, value];
  })));
  const rows = normalizeRows(records);
  return { name: file.name, type: "table", format: "Excel", size: file.size, rows, columns: profileColumns(rows), sheets: sheetNames };
}

export const profileColumns = (rows: DataRecord[]): ColumnProfile[] => {
  const names = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return names.map((name) => {
    const values = rows.map((row) => row[name]).filter((value): value is Exclude<CellValue, null> => value !== null);
    const numeric = values.filter((value) => numericValue(value) !== null).length;
    const dated = values.filter((value) => dateValue(value) !== null).length;
    const unique = new Set(values.map(String)).size;
    let kind: ColumnProfile["kind"] = "text";
    if (values.length && numeric / values.length >= 0.8) kind = "number";
    else if (values.length && dated / values.length >= 0.75) kind = "date";
    else if (unique <= Math.max(24, Math.ceil(values.length * 0.25))) kind = "category";
    return { name, kind, filled: values.length, unique, sample: String(values[0] ?? "—") };
  });
};

export const parseCsvText = (text: string, name = "dataset.csv", size = text.length): ParsedDataset => {
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy", dynamicTyping: true });
  const rows = normalizeRows(parsed.data);
  if (!rows.length) throw new Error("No tabular rows were found in this CSV file.");
  return {
    name,
    type: "table",
    format: "CSV",
    size,
    rows,
    columns: profileColumns(rows),
    warning: parsed.errors.length ? `${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} could not be read cleanly.` : undefined,
  };
};

const documentProfile = (text: string, pages?: number): DocumentProfile => {
  const words = text.match(/[\p{L}\p{N}'-]+/gu) ?? [];
  const terms = new Map<string, number>();
  words.forEach((word) => {
    const term = word.toLowerCase().replace(/^[-']+|[-']+$/g, "");
    if (term.length > 3 && !stopWords.has(term) && !/^\d/.test(term)) terms.set(term, (terms.get(term) ?? 0) + 1);
  });
  return {
    pages,
    paragraphs: text.split(/\n\s*\n|\n/).filter((part) => part.trim().length > 0).length,
    words: words.length,
    characters: text.length,
    numbers: text.match(/\b\d+(?:[,.]\d+)*\b/g)?.length ?? 0,
    currencies: text.match(/[$£€¥]\s?\d+(?:[,.]\d+)*/g)?.length ?? 0,
    percentages: text.match(/\b\d+(?:\.\d+)?%/g)?.length ?? 0,
    topTerms: [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term, count]) => ({ term, count })),
  };
};

const documentDataset = (file: File, format: string, text: string, pages?: number): ParsedDataset => ({
  name: file.name,
  type: "document",
  format,
  size: file.size,
  rows: [],
  columns: [],
  text,
  document: documentProfile(text, pages),
});

export async function parseUniversalFile(file: File): Promise<ParsedDataset> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv" || extension === "tsv") {
    const text = await file.text();
    if (extension === "tsv") {
      const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy", dynamicTyping: true, delimiter: "\t" });
      const rows = normalizeRows(parsed.data);
      if (!rows.length) throw new Error("No tabular rows were found in this TSV file.");
      return { name: file.name, type: "table", format: "TSV", size: file.size, rows, columns: profileColumns(rows) };
    }
    return parseCsvText(text, file.name, file.size);
  }

  if (extension === "xlsx") {
    return parseXlsx(file);
  }

  if (extension === "docx") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const documentXml = zip.file("word/document.xml");
    if (!documentXml) throw new Error("This Word document does not contain readable document text.");
    const document = xmlDocument(await documentXml.async("text"));
    const paragraphs = [...document.getElementsByTagName("w:p")]
      .map((paragraph) => [...paragraph.getElementsByTagName("w:t")].map((node) => node.textContent || "").join(""))
      .filter(Boolean);
    return documentDataset(file, "Word", paragraphs.join("\n\n"));
  }

  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    return documentDataset(file, "PDF", pages.join("\n\n"), pdf.numPages);
  }

  if (extension === "doc") throw new Error("Legacy .doc files are not supported in the browser. Save the file as .docx and upload it again.");
  if (extension === "xls") throw new Error("Legacy .xls files are not supported. Save the workbook as .xlsx and upload it again.");
  throw new Error("Choose a CSV, TSV, Excel (.xlsx), PDF, or Word (.docx) file.");
}
