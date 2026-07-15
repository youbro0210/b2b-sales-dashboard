"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listB2bRange } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);

// B2C 오프라인 현황 (조회 전용 + 엑셀 다운로드)
export default function B2bReport() {
  const today = todayKST();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    setRows((await listB2bRange(from, to)) as any[]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const t = rows.reduce(
    (a, r) => ({
      mfg: a.mfg + num(r.mfg_cost),
      sales: a.sales + num(r.sales_amount),
      profit: a.profit + num(r.profit_amount),
    }),
    { mfg: 0, sales: 0, profit: 0 }
  );
  const rate = t.sales ? ((t.profit / t.sales) * 100).toFixed(1) : "0.0";

  const download = () => {
    const aoa = [
      ["일자", "고객사명", "제조원가", "매출액", "매출이익액", "이익율(%)", "비고"],
      ...rows.map((r) => {
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "현황");
    XLSX.writeFile(wb, `B2C오프라인현황_${from}_${to}.xlsx`);
  };

  return (
    <ReportShell
      title="B2C 오프라인"
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      onSearch={fetchRows}
      onDownload={download}
      loading={loading}
      count={rows.length}
    >
      <div className="card overflow-x-auto">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">매출 내역</h2>
          <span className="text-sm text-slate-500">
            매출 합계 <b className="text-slate-800">{fmt(t.sales)}</b> 원 · 이익율 {rate}%
          </span>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>일자</th>
                <th style={{ minWidth: 160 }}>고객사명</th>
                <th className="text-right">제조원가</th>
                <th className="text-right">매출액</th>
                <th className="text-right">매출이익액</th>
                <th className="text-right">이익율</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-6">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const sales = num(r.sales_amount);
                const rr = sales
                  ? ((num(r.profit_amount) / sales) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{ymd(r.sale_date)}</td>
                    <td>{r.customer_name}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.mfg_cost))}</td>
                    <td className="text-right tabular-nums">{fmt(sales)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.profit_amount))}</td>
                    <td className="text-right text-slate-500">{rr}%</td>
                    <td className="text-slate-500">{r.note}</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-slate-50">
                  <td colSpan={2}>합계</td>
                  <td className="text-right">{fmt(t.mfg)}</td>
                  <td className="text-right">{fmt(t.sales)}</td>
                  <td className="text-right">{fmt(t.profit)}</td>
                  <td className="text-right">{rate}%</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </ReportShell>
  );
}
