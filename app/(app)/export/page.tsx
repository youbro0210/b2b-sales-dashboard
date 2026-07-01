"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fmt, ymd } from "@/lib/types";
import ExcelBox from "@/components/ExcelBox";
import NumberInput from "@/components/NumberInput";
import {
  listCustomers,
  listCountries,
  listProducts,
  listExportByMonth,
  upsertExport,
  deleteExport,
} from "@/lib/actions";

type Customer = { id: number; name: string };
type Country = { id: number; name: string };
type Product = { id: number; erp_code: string | null; name: string; unit: string | null };
const num = (v: any) => Number(v ?? 0);

const blank = {
  id: undefined as number | undefined,
  supply_type: "직접",
  customer_id: null as number | null,
  customer_name: "",
  country_id: null as number | null,
  country_name: "",
  delivery_date: new Date().toISOString().slice(0, 10),
  erp_code: "",
  product_name: "",
  unit: "",
  sales_per_unit: 0,
  qty_unit: 0,
  qty_box: 0,
  sales_total: 0,
  mfg_cost_total: 0,
  logistics_cost: 0,
  exchange_rate: 0,
  category: "",
  gov_support: "",
};
type Form = typeof blank;

export default function ExportPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listCustomers(["export", "both"]),
      listCountries(),
      listProducts(),
    ]).then(([c, co, p]) => {
      setCustomers(c as Customer[]);
      setCountries(co as Country[]);
      setProducts(p as Product[]);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const data = (await listExportByMonth(month)) as any[];
    setRows(data);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.delivery_date) return alert("납기일을 입력하세요.");
    await upsertExport({
      id: form.id,
      supply_type: form.supply_type || null,
      customer_id: form.customer_id,
      customer_name: form.customer_name || null,
      country_id: form.country_id,
      country_name: form.country_name || null,
      delivery_date: form.delivery_date,
      erp_code: form.erp_code || null,
      product_name: form.product_name || null,
      unit: form.unit || null,
      sales_per_unit: num(form.sales_per_unit),
      qty_unit: num(form.qty_unit),
      qty_box: num(form.qty_box),
      sales_total: num(form.sales_total),
      mfg_cost_total: num(form.mfg_cost_total),
      logistics_cost: num(form.logistics_cost),
      exchange_rate: num(form.exchange_rate),
      category: form.category || null,
      gov_support: form.gov_support || null,
    });
    setForm({ ...blank, delivery_date: form.delivery_date });
    fetchRows();
  };

  const edit = (r: any) =>
    setForm({
      id: r.id,
      supply_type: r.supply_type ?? "직접",
      customer_id: r.customer_id,
      customer_name: r.customer_name ?? "",
      country_id: r.country_id,
      country_name: r.country_name ?? "",
      delivery_date: ymd(r.delivery_date) || new Date().toISOString().slice(0, 10),
      erp_code: r.erp_code ?? "",
      product_name: r.product_name ?? "",
      unit: r.unit ?? "",
      sales_per_unit: num(r.sales_per_unit),
      qty_unit: num(r.qty_unit),
      qty_box: num(r.qty_box),
      sales_total: num(r.sales_total),
      mfg_cost_total: num(r.mfg_cost_total),
      logistics_cost: num(r.logistics_cost),
      exchange_rate: num(r.exchange_rate),
      category: r.category ?? "",
      gov_support: r.gov_support ?? "",
    });

  const del = async (id: number) => {
    if (!confirm("삭제할까요?")) return;
    await deleteExport(id);
    fetchRows();
  };

  const total = useMemo(
    () => rows.reduce((s, r) => s + num(r.sales_total), 0),
    [rows]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">수출대장 입력</h1>
          <p className="text-sm text-slate-500">수출매출 현황 · 납기일 기준</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            className="input max-w-[160px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button className="btn-ghost whitespace-nowrap" onClick={fetchRows} disabled={loading}>
            {loading ? "조회 중..." : "🔍 조회"}
          </button>
        </div>
      </div>

      <div className="card">
        <ExcelBox
          kind="export"
          onDone={fetchRows}
          exportName={`수출대장_${month}.xlsx`}
          getExport={() => [
            ["납기일", "공급구분", "고객사명", "수출국가", "ERP CODE", "품명", "단위",
             "매출액/단위", "수량(단위)", "수량(박스)", "매출 계", "제조원가 계", "물류비",
             "환율", "대분류", "정부지원사업"],
            ...rows.map((r) => [
              ymd(r.delivery_date),
              r.supply_type, r.customer_name, r.country_name, r.erp_code,
              r.product_name, r.unit, num(r.sales_per_unit), num(r.qty_unit),
              num(r.qty_box), num(r.sales_total), num(r.mfg_cost_total),
              num(r.logistics_cost), num(r.exchange_rate), r.category, r.gov_support,
            ]),
          ]}
        />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">{form.id ? "항목 수정" : "신규 항목 추가"}</h2>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
          <Field label="납기일">
            <input type="date" className="input" value={form.delivery_date}
              onChange={(e) => set({ delivery_date: e.target.value })} />
          </Field>
          <Field label="공급 구분">
            <select className="input" value={form.supply_type}
              onChange={(e) => set({ supply_type: e.target.value })}>
              <option value="직접">직접</option>
              <option value="간접">간접</option>
            </select>
          </Field>
          <Field label="고객사명">
            <select className="input" value={form.customer_id ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                set({ customer_id: id, customer_name: customers.find((c) => c.id === id)?.name ?? "" });
              }}>
              <option value="">— 선택 —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="수출국가">
            <select className="input" value={form.country_id ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                set({ country_id: id, country_name: countries.find((c) => c.id === id)?.name ?? "" });
              }}>
              <option value="">— 선택 —</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="품명 (ERP)">
            <select className="input" value={form.product_name}
              onChange={(e) => {
                const p = products.find((x) => x.name === e.target.value);
                set({ product_name: e.target.value, erp_code: p?.erp_code ?? form.erp_code, unit: p?.unit ?? form.unit });
              }}>
              <option value="">— 선택 —</option>
              {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="ERP CODE"><input className="input" value={form.erp_code} onChange={(e) => set({ erp_code: e.target.value })} /></Field>
          <Field label="단위"><input className="input" value={form.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
          <Field label="대분류"><input className="input" value={form.category} onChange={(e) => set({ category: e.target.value })} /></Field>
          <Field label="매출액/단위"><Num value={form.sales_per_unit} onChange={(v) => set({ sales_per_unit: v, sales_total: v * num(form.qty_unit) })} /></Field>
          <Field label="수량(단위)"><Num value={form.qty_unit} onChange={(v) => set({ qty_unit: v, sales_total: num(form.sales_per_unit) * v })} /></Field>
          <Field label="수량(박스)"><Num value={form.qty_box} onChange={(v) => set({ qty_box: v })} /></Field>
          <Field label="매출 계 (자동=매출액×수량, 수정가능)"><Num value={form.sales_total} onChange={(v) => set({ sales_total: v })} /></Field>
          <Field label="제조원가 계"><Num value={form.mfg_cost_total} onChange={(v) => set({ mfg_cost_total: v })} /></Field>
          <Field label="물류비"><Num value={form.logistics_cost} onChange={(v) => set({ logistics_cost: v })} /></Field>
          <Field label="환율"><Num value={form.exchange_rate} onChange={(v) => set({ exchange_rate: v })} /></Field>
          <Field label="정부지원사업"><input className="input" value={form.gov_support} onChange={(e) => set({ gov_support: e.target.value })} /></Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={submit}>{form.id ? "수정 저장" : "추가"}</button>
          {form.id && <button className="btn-ghost" onClick={() => setForm(blank)}>취소</button>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">{month} 수출 내역 ({rows.length}건)</h2>
          <span className="text-sm text-slate-500">매출 합계 <b>{fmt(total)}</b> 원</span>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>납기일</th><th>구분</th><th>고객사</th><th>국가</th>
                <th>ERP</th><th>품명</th><th className="text-right">수량(단위)</th>
                <th className="text-right">매출 계</th><th className="text-right">원가 계</th>
                <th className="text-right">환율</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={11} className="text-center text-slate-400 py-6">데이터가 없습니다.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => edit(r)}>
                  <td>{ymd(r.delivery_date)}</td>
                  <td>{r.supply_type}</td>
                  <td>{r.customer_name}</td>
                  <td>{r.country_name}</td>
                  <td className="text-xs text-slate-500">{r.erp_code}</td>
                  <td>{r.product_name}</td>
                  <td className="text-right">{fmt(num(r.qty_unit))}</td>
                  <td className="text-right">{fmt(num(r.sales_total))}</td>
                  <td className="text-right">{fmt(num(r.mfg_cost_total))}</td>
                  <td className="text-right">{r.exchange_rate}</td>
                  <td>
                    <button className="text-red-500 text-sm"
                      onClick={(e) => { e.stopPropagation(); del(r.id); }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-400 mt-3">행을 클릭하면 위 폼에서 수정할 수 있습니다.</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <NumberInput value={value} onChange={onChange} />;
}
