"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listB2bRange, listCustomers } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);
const PAGE = 20;

// B2B 현황 (조회 전용 + 고객사 필터 + 페이징 + 엑셀 다운로드)
export default function B2bReport() {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [cust, setCust] = useState(""); // 선택 고객사명 ("" = 전체)
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    listCustomers(["b2b", "both"]).then((d) => setCustomers(d as any[]));
  }, []);

  // 조회 버튼을 눌러야만 조회된다 (자동 조회 없음)
  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listB2bRange(from, to)) as any[];
    if (cust) data = data.filter((r) => (r.customer_name || "") === cust);
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, cust]);

  const t = rows.reduce(
    (a, r) => ({
      mfg: a.mfg + num(r.mfg_cost),
      sales: a.sales + num(r.sales_amount),
      profit: a.profit + num(r.profit_amount),
    }),
    { mfg: 0, sales: 0, profit: 0 }
  );
  const rate = t.sales ? ((t.profit / t.sales) * 100).toFixed(1) : "0.0";
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);

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
      ["합계", "", t.mfg, t.sales, t.profit, Number(rate), ""],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "현황");
    XLSX.writeFile(wb, `B2B현황_${from}_${to}.xlsx`);
  };

  const filter = (
    <select
      className="input max-w-[170px]"
      value={cust}
      onChange={(e) => setCust(e.target.value)}
    >
      <option value="">전체 고객사</option>
      {customers.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
    </select>
  );

  return (
    <ReportShell
      title="B2B"
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      onSearch={fetchRows}
      onDownload={download}
      loading={loading}
      count={rows.length}
      extraFilter={filter}
    >
      <div className="card overflow-x-auto">
        <div className="mb-3">
          <h2 className="font-semibold">매출 내역</h2>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : !searched ? (
          <p className="text-center text-slate-400 py-6">🔍 조회 버튼을 눌러 조회하세요.</p>
        ) : (
          <>
            <table className="data celled">
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
                {pageRows.map((r) => {
                  const sales = num(r.sales_amount);
                  const rr = sales ? ((num(r.profit_amount) / sales) * 100).toFixed(1) : "0.0";
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
            {rows.length > PAGE && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                <button
                  className="btn-ghost !py-1 !px-3"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  이전
                </button>
                <span className="text-slate-500">{page + 1} / {pageCount}</span>
                <button
                  className="btn-ghost !py-1 !px-3"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </ReportShell>
  );
}
