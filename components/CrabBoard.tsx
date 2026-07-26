"use client";

import { useCallback, useEffect, useState } from "react";
import NumberInput from "@/components/NumberInput";
import ExcelBox from "@/components/ExcelBox";
import { fmtInt, todayKST } from "@/lib/types";
import { listCrabRange, bulkSaveCrab } from "@/lib/actions";

// 활꽃게 채널 (고정)
export const CRAB_CHANNELS = ["롯데마트", "롯데슈퍼", "에브리데이", "서원유통"];
const num = (v: any) => Number(v ?? 0);
type Row = {
  box_qty: number;
  buy_price: number;
  supply_price: number;
  sales_amount: number;
  profit_amount: number;
};
const empty = (): Row => ({
  box_qty: 0,
  buy_price: 0,
  supply_price: 0,
  sales_amount: 0,
  profit_amount: 0,
});
const rate = (r: Row) =>
  r.sales_amount ? ((r.profit_amount / r.sales_amount) * 100).toFixed(1) : "0.0";

// 꽃게 입력: 일자 선택 → 채널별 6지표 입력 (이익률 자동)
export default function CrabBoard() {
  const [date, setDate] = useState(() => todayKST());
  const [vals, setVals] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = (await listCrabRange(date, date)) as any[];
    const m: Record<string, Row> = {};
    CRAB_CHANNELS.forEach((c) => (m[c] = empty()));
    rows.forEach((r) => {
      const c = String(r.channel_name);
      m[c] = {
        box_qty: num(r.box_qty),
        buy_price: num(r.buy_price),
        supply_price: num(r.supply_price),
        sales_amount: num(r.sales_amount),
        profit_amount: num(r.profit_amount),
      };
    });
    setVals(m);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const setCell = (c: string, k: keyof Row, v: number) =>
    setVals((prev) => ({ ...prev, [c]: { ...(prev[c] || empty()), [k]: v } }));

  const totals = CRAB_CHANNELS.reduce(
    (a, c) => {
      const r = vals[c] || empty();
      a.box += num(r.box_qty);
      a.sales += num(r.sales_amount);
      a.profit += num(r.profit_amount);
      return a;
    },
    { box: 0, sales: 0, profit: 0 }
  );
  const totRate = totals.sales ? ((totals.profit / totals.sales) * 100).toFixed(1) : "0.0";

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const rows = CRAB_CHANNELS.map((c) => ({
      sale_date: date,
      channel_name: c,
      ...(vals[c] || empty()),
    }));
    const res = await bulkSaveCrab(rows);
    setSaving(false);
    setMsg(res.ok ? `${date} 저장 완료` : "저장 실패: " + (res.error ?? ""));
    load();
  };

  const cell = (c: string, k: keyof Row) => (
    <td className="p-0">
      <NumberInput
        value={(vals[c] || empty())[k] || 0}
        onChange={(v) => setCell(c, k, v)}
        decimals={0}
        className="w-full text-right text-xs px-1.5 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-brand-light"
        placeholder="0"
      />
    </td>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">꽃게 입력</h1>
        <p className="text-sm text-slate-500">일자를 선택하고 채널별 실적을 입력하세요. (이익률 자동)</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            className="input max-w-[170px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" onClick={save} disabled={saving || loading}>
            {saving ? "저장 중..." : "💾 저장"}
          </button>
          <span className="ml-auto text-sm text-slate-500">
            매출 <b className="text-slate-800">{fmtInt(totals.sales)}</b> · 이익{" "}
            <b className="text-slate-800">{fmtInt(totals.profit)}</b> 원
          </span>
        </div>
        {msg && <p className="text-xs text-slate-600 mt-2">{msg}</p>}
      </div>

      <div className="card">
        <p className="text-sm text-slate-500 mb-2">
          엑셀 업로드 시 <b>채널명</b>·일자 기준으로 해당 데이터를 덮어씁니다.
          (양식: 일자 / 채널명 / BOX수 / 매입가 / 납품가 / 매출액 / 이익액)
        </p>
        <ExcelBox kind="crab" templateFile="꽃게_업로드양식.xlsx" onDone={load} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data celled text-sm">
            <thead>
              <tr>
                <th style={{ minWidth: 110 }}>채널</th>
                <th className="text-right">BOX수</th>
                <th className="text-right">매입가</th>
                <th className="text-right">납품가</th>
                <th className="text-right">매출액</th>
                <th className="text-right">이익액</th>
                <th className="text-right">이익률</th>
              </tr>
            </thead>
            <tbody>
              {CRAB_CHANNELS.map((c) => (
                <tr key={c}>
                  <td className="font-medium whitespace-nowrap">{c}</td>
                  {cell(c, "box_qty")}
                  {cell(c, "buy_price")}
                  {cell(c, "supply_price")}
                  {cell(c, "sales_amount")}
                  {cell(c, "profit_amount")}
                  <td className="text-right text-slate-500 tabular-nums pr-2">
                    {rate(vals[c] || empty())}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td>합계</td>
                <td className="text-right tabular-nums">{fmtInt(totals.box)}</td>
                <td className="text-right text-slate-300">-</td>
                <td className="text-right text-slate-300">-</td>
                <td className="text-right tabular-nums">{fmtInt(totals.sales)}</td>
                <td className="text-right tabular-nums">{fmtInt(totals.profit)}</td>
                <td className="text-right tabular-nums">{totRate}%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
