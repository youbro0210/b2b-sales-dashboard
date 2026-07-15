"use client";

import { useCallback, useEffect, useState } from "react";
import DateBar from "@/components/DateBar";
import ExcelBox from "@/components/ExcelBox";
import NumberInput from "@/components/NumberInput";
import { fmt, ymd, todayKST } from "@/lib/types";
import {
  listCustomers,
  listB2bByDate,
  listB2bRange,
  saveB2b,
  deleteB2b,
  serverToday,
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
  const [date, setDate] = useState(() => todayKST());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCustomers(["b2b", "both"]).then((d) => setCustomers(d as Customer[]));
  }, []);

  // 대시보드에서 넘어온 일자(?date=YYYY-MM-DD)로 열기.
  // 없으면 서버 시각(한국시간) 기준 오늘로 맞춘다.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("date");
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) setDate(q);
    else serverToday().then((d) => d && setDate(d)).catch(() => {});
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
        <h1 className="text-2xl font-bold">B2C 오프라인 입력</h1>
        <p className="text-sm text-slate-500">일자별 거래처별 매출·이익 현황</p>
      </div>

      <DateBar date={date} setDate={setDate}>
        <button className="btn-ghost" onClick={fetchRows} disabled={loading}>
          {loading ? "조회 중..." : "🔍 조회"}
        </button>
        <button className="btn-ghost" onClick={addRow}>+ 행 추가</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </DateBar>

      <div className="card">
        <ExcelBox
          kind="b2b"
          onDone={fetchRows}
          exportName={`B2C오프라인_${date}.xlsx`}
          getExport={() => [
            ["일자", "고객사명", "제조원가", "매출액", "매출이익액", "이익율(%)", "비고"],
            ...rows.map((r) => [
              date,
              r.customer_name,
              num(r.mfg_cost),
              num(r.sales_amount),
              num(r.profit_amount),
              num(r.sales_amount) ? Number(((num(r.profit_amount) / num(r.sales_amount)) * 100).toFixed(1)) : 0,
              r.note,
            ]),
          ]}
          rangeExportName={(f, t) => `B2C오프라인_${f}_${t}.xlsx`}
          getRangeExport={async (f, t) => {
            const data = (await listB2bRange(f, t)) as any[];
            return [
              ["일자", "고객사명", "제조원가", "매출액", "매출이익액", "이익율(%)", "비고"],
              ...data.map((r) => {
                const sales = num(r.sales_amount);
                const profit = num(r.profit_amount);
                return [
                  ymd(r.sale_date),
                  r.customer_name ?? "",
                  num(r.mfg_cost),
                  sales,
                  profit,
                  sales ? Number(((profit / sales) * 100).toFixed(1)) : 0,
                  r.note ?? "",
                ];
              }),
            ];
          }}
        />
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
                          const c = customers.find((x) => String(x.id) === e.target.value);
                          update(r._key, { customer_id: c ? Number(c.id) : null, customer_name: c?.name ?? "" });
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
