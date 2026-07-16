"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listB2bRange, listCustomers } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);
const GPAGE = 10; // 페이지당 거래처 수

type Group = {
  name: string;
  rows: any[];
  mfg: number;
  sales: number;
  profit: number;
};

// B2B 현황 (조회 전용 + 고객사 필터 + 거래처별 취합/셀 병합 + 페이징 + 엑셀 다운로드)
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
    // 거래처(고객사) 기준으로 모으고, 같은 거래처 안에서는 일자순
    data.sort(
      (a, b) =>
        (a.customer_name || "").localeCompare(b.customer_name || "") ||
        ymd(a.sale_date).localeCompare(ymd(b.sale_date))
    );
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, cust]);

  // 거래처별 그룹 만들기 (연속 정렬되어 있으므로 순서대로 묶는다)
  const groups = useMemo<Group[]>(() => {
    const g: Group[] = [];
    let cur: Group | null = null;
    for (const r of rows) {
      const nm = r.customer_name || "(미지정)";
      if (!cur || nm !== cur.name) {
        cur = { name: nm, rows: [], mfg: 0, sales: 0, profit: 0 };
        g.push(cur);
      }
      cur.rows.push(r);
      cur.mfg += num(r.mfg_cost);
      cur.sales += num(r.sales_amount);
      cur.profit += num(r.profit_amount);
    }
    return g;
  }, [rows]);

  const t = rows.reduce(
    (a, r) => ({
      mfg: a.mfg + num(r.mfg_cost),
      sales: a.sales + num(r.sales_amount),
      profit: a.profit + num(r.profit_amount),
    }),
    { mfg: 0, sales: 0, profit: 0 }
  );
  const rate = t.sales ? ((t.profit / t.sales) * 100).toFixed(1) : "0.0";
  const pageCount = Math.max(1, Math.ceil(groups.length / GPAGE));
  const pageGroups = groups.slice(page * GPAGE, (page + 1) * GPAGE);

  const download = () => {
    const aoa: any[] = [
      ["고객사명", "일자", "제조원가", "매출액", "매출이익액", "이익율(%)", "비고"],
    ];
    groups.forEach((g) => {
      g.rows.forEach((r) => {
        const sales = num(r.sales_amount);
        const profit = num(r.profit_amount);
        aoa.push([
          g.name,
          ymd(r.sale_date),
          num(r.mfg_cost),
          sales,
          profit,
          sales ? Number(((profit / sales) * 100).toFixed(1)) : 0,
          r.note ?? "",
        ]);
      });
      aoa.push([
        `${g.name} 소계`,
        "",
        g.mfg,
        g.sales,
        g.profit,
        g.sales ? Number(((g.profit / g.sales) * 100).toFixed(1)) : 0,
        "",
      ]);
    });
    aoa.push(["합계", "", t.mfg, t.sales, t.profit, Number(rate), ""]);
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
                  <th style={{ minWidth: 160 }}>고객사명</th>
                  <th>일자</th>
                  <th className="text-right">제조원가</th>
                  <th className="text-right">매출액</th>
                  <th className="text-right">매출이익액</th>
                  <th className="text-right">이익율</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {pageGroups.map((g) => (
                  <Fragment key={g.name}>
                    {g.rows.map((r, i) => {
                      const sales = num(r.sales_amount);
                      const rr = sales
                        ? ((num(r.profit_amount) / sales) * 100).toFixed(1)
                        : "0.0";
                      return (
                        <tr key={r.id}>
                          {i === 0 && (
                            <td
                              rowSpan={g.rows.length + 1}
                              className="align-top font-medium bg-slate-50 whitespace-nowrap"
                            >
                              {g.name}
                            </td>
                          )}
                          <td className="whitespace-nowrap">{ymd(r.sale_date)}</td>
                          <td className="text-right tabular-nums">{fmt(num(r.mfg_cost))}</td>
                          <td className="text-right tabular-nums">{fmt(sales)}</td>
                          <td className="text-right tabular-nums">{fmt(num(r.profit_amount))}</td>
                          <td className="text-right text-slate-500">{rr}%</td>
                          <td className="text-slate-500">{r.note}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-medium text-sm">
                      <td className="text-right text-slate-600">소계</td>
                      <td className="text-right tabular-nums">{fmt(g.mfg)}</td>
                      <td className="text-right tabular-nums">{fmt(g.sales)}</td>
                      <td className="text-right tabular-nums">{fmt(g.profit)}</td>
                      <td className="text-right text-slate-500">
                        {g.sales ? ((g.profit / g.sales) * 100).toFixed(1) : "0.0"}%
                      </td>
                      <td></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              {groups.length > 0 && (
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
            {groups.length > GPAGE && (
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
