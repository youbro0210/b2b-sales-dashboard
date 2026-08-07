"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listB2bRange, listCustomers } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);
const GPAGE = 15; // 페이지당 거래처 수

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
  const [detail, setDetail] = useState<Group | null>(null); // 세부 내역 팝업 대상
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    listCustomers(["b2b", "both"]).then((d) => setCustomers(d as any[]));
  }, []);

  // 조회 버튼을 눌러야만 조회된다 (자동 조회 없음)
  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listB2bRange(from, to)) as any[];
    // 고객사 검색: 직접 입력한 글자가 포함된 거래처만 (부분 일치)
    const q = cust.trim().toLowerCase();
    if (q) data = data.filter((r) => (r.customer_name || "").toLowerCase().includes(q));
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

  // 컬럼 정렬 (거래처 그룹 단위)
  const sortedGroups = useMemo<Group[]>(() => {
    if (!sortKey) return groups;
    const val = (g: Group): string | number => {
      switch (sortKey) {
        case "name": return g.name;
        case "mfg": return g.mfg;
        case "sales": return g.sales;
        case "profit": return g.profit;
        case "rate": return g.sales ? g.profit / g.sales : 0;
        default: return 0;
      }
    };
    return [...groups].sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? c : -c;
    });
  }, [groups, sortKey, sortDir]);

  const t = rows.reduce(
    (a, r) => ({
      mfg: a.mfg + num(r.mfg_cost),
      sales: a.sales + num(r.sales_amount),
      profit: a.profit + num(r.profit_amount),
    }),
    { mfg: 0, sales: 0, profit: 0 }
  );
  const rate = t.sales ? ((t.profit / t.sales) * 100).toFixed(1) : "0.0";

  // 표시 순서대로 누계(러닝 합계) 매출액 계산
  const groupsCum = useMemo(() => {
    let run = 0;
    return sortedGroups.map((g) => {
      run += g.sales;
      return { g, cumSales: run };
    });
  }, [sortedGroups]);

  const pageCount = Math.max(1, Math.ceil(groups.length / GPAGE));
  const pageGroups = groupsCum.slice(page * GPAGE, (page + 1) * GPAGE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  };
  const arrow = (key: string) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

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
    <>
      <input
        list="b2b-cust-options"
        className="input max-w-[200px]"
        placeholder="고객사명 입력 (비우면 전체)"
        value={cust}
        onChange={(e) => setCust(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchRows()}
      />
      <datalist id="b2b-cust-options">
        {customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
    </>
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
      count={groups.length}
      extraFilter={filter}
    >
      <div className="card overflow-x-auto">
        <div className="mb-3">
          <h2 className="font-semibold">거래처별 매출</h2>
          <p className="text-xs text-slate-500">
            거래처명을 클릭하면 일자별 세부 내역이 팝업으로 열립니다.
          </p>
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
                  <th className="cursor-pointer select-none" style={{ minWidth: 160 }} onClick={() => toggleSort("name")}>고객사명{arrow("name")}</th>
                  <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("mfg")}>제조원가{arrow("mfg")}</th>
                  <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("sales")}>매출액{arrow("sales")}</th>
                  <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("profit")}>매출이익액{arrow("profit")}</th>
                  <th className="text-right cursor-pointer select-none" onClick={() => toggleSort("rate")}>이익율{arrow("rate")}</th>
                  <th className="text-right">누계매출액</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {pageGroups.map(({ g, cumSales }) => {
                  const rr = g.sales
                    ? ((g.profit / g.sales) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <tr key={g.name} className="hover:bg-sky-50">
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetail(g)}
                          className="font-medium text-sky-700 hover:underline text-left"
                          title="일자별 세부 내역 보기"
                        >
                          {g.name} 🔍
                        </button>
                      </td>
                      <td className="text-right tabular-nums">{fmt(g.mfg)}</td>
                      <td className="text-right tabular-nums">{fmt(g.sales)}</td>
                      <td className="text-right tabular-nums">{fmt(g.profit)}</td>
                      <td className="text-right text-slate-500">{rr}%</td>
                      <td className="text-right tabular-nums text-slate-500">
                        {fmt(cumSales)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {groups.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td>합계</td>
                    <td className="text-right">{fmt(t.mfg)}</td>
                    <td className="text-right">{fmt(t.sales)}</td>
                    <td className="text-right">{fmt(t.profit)}</td>
                    <td className="text-right">{rate}%</td>
                    <td className="text-right tabular-nums">{fmt(t.sales)}</td>
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

      {detail && <DetailModal group={detail} onClose={() => setDetail(null)} />}
    </ReportShell>
  );
}

// 고객사 세부 내역 팝업 (일자별 전체 내역 + 소계)
function DetailModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const rate = group.sales ? ((group.profit / group.sales) * 100).toFixed(1) : "0.0";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-lg">{group.name}</h3>
            <p className="text-xs text-slate-500">세부 내역 · {group.rows.length}건</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-auto">
          <table className="data celled text-sm">
            <thead>
              <tr>
                <th className="whitespace-nowrap">일자</th>
                <th className="text-right">제조원가</th>
                <th className="text-right">매출액</th>
                <th className="text-right">매출이익액</th>
                <th className="text-right">이익율</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => {
                const sales = num(r.sales_amount);
                const rr = sales
                  ? ((num(r.profit_amount) / sales) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{ymd(r.sale_date)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.mfg_cost))}</td>
                    <td className="text-right tabular-nums">{fmt(sales)}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.profit_amount))}</td>
                    <td className="text-right text-slate-500">{rr}%</td>
                    <td className="text-slate-500">{r.note}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td>소계</td>
                <td className="text-right tabular-nums">{fmt(group.mfg)}</td>
                <td className="text-right tabular-nums">{fmt(group.sales)}</td>
                <td className="text-right tabular-nums">{fmt(group.profit)}</td>
                <td className="text-right">{rate}%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
