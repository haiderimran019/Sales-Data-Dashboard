import type { MonthlyPoint, OrderRow } from "../types";
import { monthLabel } from "./utils";

export type Aggregate = { label: string; sales: number; profit: number; quantity: number };

export const sum = (rows: OrderRow[], key: "sales" | "profit" | "quantity") =>
  rows.reduce((total, row) => total + row[key], 0);

export const unique = (rows: OrderRow[], key: keyof OrderRow) => new Set(rows.map((row) => row[key])).size;

export const groupRows = (rows: OrderRow[], getKey: (row: OrderRow) => string): Aggregate[] => {
  const groups = new Map<string, Aggregate>();
  rows.forEach((row) => {
    const label = getKey(row);
    const current = groups.get(label) ?? { label, sales: 0, profit: 0, quantity: 0 };
    current.sales += row.sales;
    current.profit += row.profit;
    current.quantity += row.quantity;
    groups.set(label, current);
  });
  return [...groups.values()];
};

export const monthly = (rows: OrderRow[]): MonthlyPoint[] => {
  const groups = new Map<string, MonthlyPoint>();
  rows.forEach((row) => {
    const key = `${row.orderDate.getFullYear()}-${String(row.orderDate.getMonth() + 1).padStart(2, "0")}`;
    const current = groups.get(key) ?? { key, label: monthLabel(key), sales: 0, profit: 0 };
    current.sales += row.sales;
    current.profit += row.profit;
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
};

export const lastMonthDelta = (rows: OrderRow[], key: "sales" | "profit") => {
  const values = monthly(rows);
  if (values.length < 2) return null;
  const latest = values[values.length - 1]?.[key] ?? 0;
  const previous = values[values.length - 2]?.[key] ?? 0;
  if (!previous) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
};

export const productSummary = (rows: OrderRow[]) =>
  groupRows(rows, (row) => row.productName).sort((a, b) => b.profit - a.profit);

export const orderFrequency = (rows: OrderRow[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.customerId, (counts.get(row.customerId) ?? 0) + 1));
  const buckets = [
    { label: "1 order", count: 0 },
    { label: "2–3 orders", count: 0 },
    { label: "4–6 orders", count: 0 },
    { label: "7+ orders", count: 0 },
  ];
  counts.forEach((count) => {
    if (count === 1) buckets[0].count += 1;
    else if (count <= 3) buckets[1].count += 1;
    else if (count <= 6) buckets[2].count += 1;
    else buckets[3].count += 1;
  });
  return buckets;
};

export const customerSummary = (rows: OrderRow[]) => {
  const grouped = new Map<string, { label: string; sales: number; profit: number; orders: Set<string> }>();
  rows.forEach((row) => {
    const current = grouped.get(row.customerId) ?? { label: row.customerName, sales: 0, profit: 0, orders: new Set<string>() };
    current.sales += row.sales;
    current.profit += row.profit;
    current.orders.add(row.orderId);
    grouped.set(row.customerId, current);
  });
  return [...grouped.values()].map(({ label, sales, profit, orders }) => ({ label, sales, profit, orders: orders.size }));
};
