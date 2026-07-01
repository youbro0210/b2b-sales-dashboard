export type Customer = {
  id: number;
  name: string;
  kind: "b2b" | "export" | "both";
  erp_code: string | null;
  note: string | null;
};

export type Country = { id: number; name: string };

export type Product = {
  id: number;
  erp_code: string | null;
  name: string;
  unit: string | null;
  category: string | null;
};

export type Channel = {
  id: number;
  group_name: string | null;
  name: string;
  sort_order: number;
};

export type B2bSale = {
  id: number;
  sale_date: string;
  customer_id: number | null;
  customer_name: string | null;
  mfg_cost: number;
  sales_amount: number;
  profit_amount: number;
  note: string | null;
};

export type LoadingAmount = {
  id: number;
  load_date: string;
  channel_id: number | null;
  channel_name: string | null;
  supply_amount: number;
};

export type ExportSale = {
  id: number;
  supply_type: string | null;
  customer_id: number | null;
  customer_name: string | null;
  country_id: number | null;
  country_name: string | null;
  delivery_date: string | null;
  erp_code: string | null;
  product_name: string | null;
  unit: string | null;
  sales_per_unit: number;
  sales_per_box: number;
  qty_unit: number;
  qty_box: number;
  sales_total: number;
  mfg_cost_total: number;
  logistics_cost: number;
  exchange_rate: number;
  category: string | null;
  gov_support: string | null;
  factory_self: string | null;
};

export const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("ko-KR");

// 날짜(Date 객체/문자열 무엇이든)를 숫자 형식 "YYYY-MM-DD" 로 변환
// (Date 객체를 그냥 문자열화하면 "Wed Jul 01 2026" 같은 영문 표기가 나오는 문제 방지)
export const ymd = (d: unknown): string => {
  if (!d) return "";
  if (d instanceof Date) return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
