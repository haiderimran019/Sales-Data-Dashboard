export type OrderRow = {
  rowId: number;
  orderId: string;
  orderDate: Date;
  shipDate: Date;
  shipMode: string;
  customerId: string;
  customerName: string;
  segment: string;
  country: string;
  city: string;
  state: string;
  postalCode: string;
  region: string;
  productId: string;
  category: string;
  subCategory: string;
  productName: string;
  sales: number;
  quantity: number;
  discount: number;
  profit: number;
};

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type MonthlyPoint = {
  key: string;
  label: string;
  sales: number;
  profit: number;
};

export type MetricKey = "sales" | "profit";
