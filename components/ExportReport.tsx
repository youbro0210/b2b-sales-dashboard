"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, fmtInt, ymd, todayKST } from "@/lib/types";
import { listExportRange, listCustomers } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);
const PAGE = 20;

// 수출대장 현황 (조회 전용 + 고객사 필터 + 페이징 + 엑셀 다운로드)
export default function ExportReport() {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [cust, setCust] = useState("");
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    listCustomers(["export", "both"]).then((d) => setCustomers(d as any[]));
  }, []);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listExportRange(from, to)) as any[];
    if (cust) data = data.filter((r) => (r.customer_name || "") === cust);
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, cust]);

  const total = rows.reduce((s, r) => s + num(r.sales_total), 0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);

  const download = () => {
    const aoa = [
      [
        "납기일", "공급구분", "고객사명", "수출국가", "품명", "단위",
        "매출액/단위", "수량(단위)", "수량(박스)", "매출 계", "제조원가 계", "물류비",
        "환율", "대분류", "정부지원사업",
      ],
      ...rows.map((r) => [
        ymd(r.delivery_date),
        r.supply_type,
        r.customer_name,
        r.country_name,
        r.product_name,
        r.unit,
        num(r.sales_per_unit),
        num(r.qty_unit),
        num(r.qty_box),
        num(r.sales_total),
        num(r.mfg_cost_total),
        num(r.logistics_cost),
        num(r.exchange_rate),
        r.category,
        r.gov_support,
      ]),
      ["합계", "", "", "", "", "", "", "", "", total, "", "", "", "", ""],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "현황");
    XLSX.writeFile(wb, `수출대장현황_${from}_${to}.xlsx`);
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
      title="수출대장"
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
          <h2 className="font-semibold">수출 내역</h2>
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
                  <th>납기일</th>
                  <th>구분</th>
                  <th>고객사</th>
                  <th>국가</th>
                  <th>품명</th>
                  <th className="text-right">수량(단위)</th>
                  <th className="text-right">매출 계</th>
                  <th className="text-right">원가 계</th>
                  <th className="text-right">환율</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{ymd(r.delivery_date)}</td>
                    <td>{r.supply_type}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.country_name}</td>
                    <td>{r.product_name}</td>
                    <td className="text-right tabular-nums">{fmtInt(num(r.qty_unit))}</td>
                    <td className="text-right tabular-nums">
                      {fmt(num(r.sales_total), r.country_name === "일본" ? 4 : 2)}
                    </td>
                    <td className="text-right tabular-nums">
                      {fmt(num(r.mfg_cost_total), r.country_name === "일본" ? 4 : 2)}
                    </td>
                    <td className="text-right tabular-nums">{r.exchange_rate}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td colSpan={6}>합계</td>
                    <td className="text-right">{fmt(total)}</td>
                    <td colSpan={2}></td>
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
