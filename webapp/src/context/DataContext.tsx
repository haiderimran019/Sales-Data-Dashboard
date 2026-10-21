import Papa from "papaparse";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DateRange, OrderRow } from "../types";
import { dateInputValue } from "../lib/utils";

type DataContextValue = {
  rows: OrderRow[];
  filteredRows: OrderRow[];
  range: DateRange;
  setRange: (range: DateRange) => void;
  isLoading: boolean;
  error: string | null;
  dateBounds: DateRange;
  sourceName: string;
  importCsv: (file: File) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

const value = (input: unknown) => String(input ?? "").trim();
const numeric = (input: unknown) => Number(input) || 0;
const field = (record: Record<string, unknown>, ...names: string[]) => {
  const entries = Object.entries(record);
  const normalize = (input: string) => input.toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = entries.find(([key]) => names.some((name) => normalize(key) === normalize(name)));
  return match?.[1];
};

const parseDate = (input: unknown) => {
  const raw = value(input);
  if (!raw) return new Date(Number.NaN);
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 100000) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }
  const parts = raw.split(/[\/.-]/).map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [first, second, third] = parts;
    if (first > 31) return new Date(Date.UTC(first, second - 1, third));
    if (third > 31) {
      const year = third < 100 ? third + 2000 : third;
      return new Date(Date.UTC(year, first - 1, second));
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(Number.NaN) : parsed;
};

const dateField = (record: Record<string, unknown>, ...names: string[]) => {
  return parseDate(field(record, ...names));
};

const toRow = (record: Record<string, unknown>): OrderRow => ({
  rowId: numeric(field(record, "Row ID", "ID", "Record ID")),
  orderId: value(field(record, "Order ID", "Transaction ID", "Invoice", "Order")),
  orderDate: dateField(record, "Order Date", "Date", "Transaction Date", "Invoice Date"),
  shipDate: dateField(record, "Ship Date", "Delivery Date", "Due Date"),
  shipMode: value(field(record, "Ship Mode", "Shipping Method", "Delivery Method")),
  customerId: value(field(record, "Customer ID", "Client ID", "Account ID", "Customer")),
  customerName: value(field(record, "Customer Name", "Client", "Account Name", "Customer")),
  segment: value(field(record, "Segment", "Customer Type", "Market Segment")),
  country: value(field(record, "Country", "Nation")),
  city: value(field(record, "City", "Town")),
  state: value(field(record, "State", "Province")),
  postalCode: value(field(record, "Postal Code", "ZIP", "Zip Code")),
  region: value(field(record, "Region", "Territory", "Area", "Location")),
  productId: value(field(record, "Product ID", "Item ID", "SKU", "SKU ID")),
  category: value(field(record, "Category", "Department", "Product Category", "Type")),
  subCategory: value(field(record, "Sub-Category", "Subcategory", "Product Group")),
  productName: value(field(record, "Product Name", "Item", "Item Name", "Service", "Description")),
  sales: numeric(field(record, "Sales", "Revenue", "Amount", "Total", "Value")),
  quantity: numeric(field(record, "Quantity", "Units", "Count", "Volume")),
  discount: numeric(field(record, "Discount", "Discount Rate", "Promotion")),
  profit: numeric(field(record, "Profit", "Gross Profit", "Net Profit", "Margin")),
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("superstore_clean.csv");

  const useRecords = (data: Record<string, unknown>[], errors: Papa.ParseError[], name: string) => {
    if (errors.length) setError("Some rows could not be parsed, so only valid rows were loaded.");
    const parsed = data.map(toRow).filter((row) => !Number.isNaN(row.orderDate.getTime()));
    if (!parsed.length) {
      setError("This CSV needs a recognizable date column and at least one valid data row.");
      setIsLoading(false);
      return;
    }
    const dates = parsed.map((row) => row.orderDate.getTime());
    setRows(parsed);
    setRange({ startDate: dateInputValue(new Date(Math.min(...dates))), endDate: dateInputValue(new Date(Math.max(...dates))) });
    setSourceName(name);
    setError(null);
    setIsLoading(false);
  };

  useEffect(() => {
    Papa.parse<Record<string, unknown>>(`${import.meta.env.BASE_URL}data/superstore_clean.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => useRecords(data, errors, "superstore_clean.csv"),
      error: () => {
        setError("The cleaned CSV could not be loaded. Run `npm run copy-data` and refresh.");
        setIsLoading(false);
      },
    });
  }, []);

  const importCsv = (file: File) => new Promise<void>((resolve) => {
    setIsLoading(true);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        useRecords(data, errors, file.name);
        resolve();
      },
      error: () => {
        setError("The selected CSV could not be loaded.");
        setIsLoading(false);
        resolve();
      },
    });
  });

  const dateBounds = useMemo(() => {
    if (!rows.length) return { startDate: "", endDate: "" };
    const dates = rows.map((row) => row.orderDate.getTime());
    return { startDate: dateInputValue(new Date(Math.min(...dates))), endDate: dateInputValue(new Date(Math.max(...dates))) };
  }, [rows]);

  const filteredRows = useMemo(
    () => rows.filter((row) => {
      const date = dateInputValue(row.orderDate);
      return (!range.startDate || date >= range.startDate) && (!range.endDate || date <= range.endDate);
    }),
    [range, rows],
  );

  return <DataContext.Provider value={{ rows, filteredRows, range, setRange, isLoading, error, dateBounds, sourceName, importCsv }}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider");
  return context;
}
