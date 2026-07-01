"use client";

import { useCallback, useEffect, useState } from "react";
import DateBar from "@/components/DateBar";
import ExcelBox from "@/components/ExcelBox";
import NumberInput from "@/components/NumberInput";
import { fmt } from "@/lib/types";
import {
  listCustomers,
  listB2bByDate,
  saveB2b,
  deleteB2b,
} from "@/lib/actions";

type Customer = { id: number; name: string };
type Row = {
  _key: string;
  id?: number;
  customer_id: number | null;
  customer_name: string;
  mfg_cost: number;
  sales_amount: number;
  profit_amount: number;
  note: string;
};

const num = (v: any) => Number(v ?? 0);

export default function B2bPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCustomers(["b2b", "both"]).then((d) => setCustomers(d as Customer[]));
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const data = (await listB2bByDate(date)) as any[];
    setRows(
      data.map((r) => ({
        _key: String(r.id),
        id: r.id,
        customer_id: r.customer_id,
        customer_name: r.customer_name ?? "",
        mfg_cost: num(r.mfg_cost),
        sales_amount: num(r.sales_amount),
        profit_amount: num(r.profit_amount),
        note: r.note ?? "",
      }))
    );
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const addRow = () =>
    setRows((r) => [
      ...r,
      {
        _key: "new-" + Date.now() + Math.random(),
        customer_id: null,
        customer_name: "",
        mfg_cost: 0,
        sales_amount: 0,
        profit_amount: 0,
        note: "",
      },
    ]);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const removeRow = async (row: Row) => {
    if (row.id) {
      if (!confirm("이 행을 삭제할까요?")) return;
      await deleteB2b(row.id);
    }
    setRows((rs) => rs.filter((r) => r._key !== row._key));
  };

  const save = async () => {
    setSaving(true);
    await saveB2b(
      date,
      rows.map((r) => ({
        id: r.id,
        customer_id: r.customer_id || null,
        customer_name: r.customer_name || null,
        mfg_cost: num(r.mfg_cost),
        sales_amount: num(r.sales_amount),
        profit_amount: num(r.profit_amount),
        note: r.note || null,
      }))
    );
    setSaving(false);
    fetchRows();
  };

  const totals = rows.reduce(
    (t, r) => ({
      mfg: t.mfg + num(r.mfg_cost),
      sales: t.sales + num(r.sales_amount),
      profit: t.profit + num(r.profit_amount),
    }),
    { mfg: 0, sales: 0, profit: 0 }
  );
  const rate = totals.sales ? ((totals.profit / totals.sales) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">B2B 매출 입력</h1>
        <p className="text-sm text-slate-500">일자별 업체별 매출·이익 현황</p>
      </div>

      <DateBar date={date} setDate={setDate}>
        <button className="btn-ghost" onClick={addRow}>+ 행 추가</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </DateBar>

      <div className="card">
        <ExcelBox kind="b2b" onDone={fetchRows} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>고객사명</th>
                <th className="text-right">제조원가</th>
                <th className="text-right">매출액</th>
                <th className="text-right">매출이익액</th>
                <th className="text-right">이익율</th>
                <th>비고</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-6">
                    데이터가 없습니다. “행 추가”로 입력하세요.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const rr = num(r.sales_amount)
                  ? ((num(r.profit_amount) / num(r.sales_amount)) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={r._key}>
                    <td>
                      <select
                        className="input"
                        value={r.customer_id ?? ""}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : null;
                          const c = customers.find((x) => x.id === id);
                          update(r._key, { customer_id: id, customer_name: c?.name ?? "" });
                        }}
                      >
                        <option value="">— 선택 —</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td><NumberInput value={r.mfg_cost} onChange={(v) => update(r._key, { mfg_cost: v })} /></td>
                    <td><NumberInput value={r.sales_amount} onChange={(v) => update(r._key, { sales_amount: v })} /></td>
                    <td><NumberInput value={r.profit_amount} onChange={(v) => update(r._key, { profit_amount: v })} /></td>
                    <td className="text-right text-slate-500">{rr}%</td>
                    <td>
                      <input
                        className="input"
                        value={r.note}
                        onChange={(e) => update(r._key, { note: e.target.value })}
                      />
                    </td>
                    <td>
                      <button className="text-red-500 text-sm" onClick={() => removeRow(r)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-slate-50">
                  <td>합계</td>
                  <td className="text-right">{fmt(totals.mfg)}</td>
                  <td className="text-right">{fmt(totals.sales)}</td>
                  <td className="text-right">{fmt(totals.profit)}</td>
                  <td className="text-right">{rate}%</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
