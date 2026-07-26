"use client";

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listCrabRange } from "@/lib/actions";

const CRAB_CHANNELS = ["롯데마트", "롯데슈퍼", "에브리데이", "서원유통"];
const num = (v: any) => Number(v ?? 0);
const PAGE = 20;
const rate = (profit: number, sales: number) =>
  sales ? ((profit / sales) * 100).toFixed(1) : "0.0";

// 꽃게 현황 (조회 전용 + 채널 필터 + 페이징 + 엑셀 다운로드)
export default function CrabReport() {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [chan, setChan] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searched, setSearched] = useState(false);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listCrabRange(from, to)) as any[];
    if (chan) data = data.filter((r) => String(r.channel_name) === chan);
    data.sort(
      (a, b) =>
        ymd(a.sale_date).localeCompare(ymd(b.sale_date)) ||
        String(a.channel_name).localeCompare(String(b.channel_name))
    );
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, chan]);

  const t = rows.reduce(
    (a, r) => ({
      box: a.box + num(r.box_qty),
      sales: a.sales + num(r.sales_amount),
      profit: a.profit + num(r.profit_amount),
    }),
    { box: 0, sales: 0, profit: 0 }
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);

  const download = () => {
    const aoa = [
      ["일자", "채널명", "BOX수", "매입가", "납품가", "매출액", "이익액", "이익률(%)"],
      ...rows.map((r) => [
        ymd(r.sale_date),
        r.channel_name,
        num(r.box_qty),
        num(r.buy_price),
        num(r.supply_price),
        num(r.sales_amount),
        num(r.profit_amount),
        Number(rate(num(r.profit_amount), num(r.sales_amount))),
      ]),
      ["합계", "", t.box, "", "", t.sales, t.profit, Number(rate(t.profit, t.sales))],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "꽃게현황");
    XLSX.writeFile(wb, `꽃게현황_${from}_${to}.xlsx`);
  };

  const filter = (
    <select
      className="input max-w-[160px]"
      value={chan}
      onChange={(e) => setChan(e.target.value)}
    >
      <option value="">전체 채널</option>
      {CRAB_CHANNELS.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );

  return (
    <ReportShell
      title="꽃게"
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
          <h2 className="font-semibold">꽃게 내역</h2>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : !searched ? (
          <p className="text-center text-slate-400 py-6">🔍 조회 버튼을 눌러 조회하세요.</p>
        ) : (
          <>
            <table className="data celled text-sm">
              <thead>
                <tr>
                  <th>일자</th>
                  <th style={{ minWidth: 100 }}>채널명</th>
                  <th className="text-right">BOX수</th>
                  <th className="text-right">매입가</th>
                  <th className="text-right">납품가</th>
                  <th className="text-right">매출액</th>
                  <th className="text-right">이익액</th>
                  <th className="text-right">이익률</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{ymd(r.sale_date)}</td>
                    <td>{r.channel_name}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.box_qty), 0)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.buy_price), 0)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.supply_price), 0)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.sales_amount), 0)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.profit_amount), 0)}</td>
                    <td className="text-right text-slate-500 tabular-nums">
                      {rate(num(r.profit_amount), num(r.sales_amount))}%
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td colSpan={2}>합계</td>
                    <td className="text-right">{fmt(t.box, 0)}</td>
                    <td></td>
                    <td></td>
                    <td className="text-right">{fmt(t.sales, 0)}</td>
                    <td className="text-right">{fmt(t.profit, 0)}</td>
                    <td className="text-right">{rate(t.profit, t.sales)}%</td>
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
