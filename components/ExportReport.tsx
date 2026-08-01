"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listExportRange, listCustomers } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);
const PAGE = 20; // 페이지당 고객사 수

type Group = { name: string; rows: any[]; sales: number; cost: number };

// 수출대장 현황: 고객사별 합계 + 누계를 먼저 보여주고, 고객사명 클릭 시 세부 내역 팝업
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
  const [detail, setDetail] = useState<Group | null>(null);

  useEffect(() => {
    listCustomers(["export", "both"]).then((d) => setCustomers(d as any[]));
  }, []);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listExportRange(from, to)) as any[];
    const q = cust.trim().toLowerCase();
    if (q) data = data.filter((r) => (r.customer_name || "").toLowerCase().includes(q));
    data.sort(
      (a, b) =>
        (a.customer_name || "").localeCompare(b.customer_name || "") ||
        ymd(a.delivery_date).localeCompare(ymd(b.delivery_date))
    );
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, cust]);

  // 고객사별 그룹
  const gps = useMemo<Group[]>(() => {
    const g: Group[] = [];
    let cur: Group | null = null;
    for (const r of rows) {
      const nm = r.customer_name || "(미지정)";
      if (!cur || nm !== cur.name) {
        cur = { name: nm, rows: [], sales: 0, cost: 0 };
        g.push(cur);
      }
      cur.rows.push(r);
      cur.sales += num(r.sales_total);
      cur.cost += num(r.mfg_cost_total);
    }
    return g;
  }, [rows]);

  const t = rows.reduce(
    (a, r) => ({
      sales: a.sales + num(r.sales_total),
      cost: a.cost + num(r.mfg_cost_total),
    }),
    { sales: 0, cost: 0 }
  );

  const gpsCum = useMemo(() => {
    let run = 0;
    return gps.map((g) => {
      run += g.sales;
      return { g, cum: run };
    });
  }, [gps]);

  const pageCount = Math.max(1, Math.ceil(gps.length / PAGE));
  const pageGps = gpsCum.slice(page * PAGE, (page + 1) * PAGE);

  const download = () => {
    const aoa: any[] = [
      ["고객사", "납기일", "구분", "국가", "품명", "수량(단위)", "매출 계", "원가 계", "환율"],
    ];
    gps.forEach((g) => {
      g.rows.forEach((r) =>
        aoa.push([
          g.name,
          ymd(r.delivery_date),
          r.supply_type ?? "",
          r.country_name ?? "",
          r.product_name ?? "",
          num(r.qty_unit),
          num(r.sales_total),
          num(r.mfg_cost_total),
          num(r.exchange_rate),
        ])
      );
      aoa.push([`${g.name} 소계`, "", "", "", "", "", g.sales, g.cost, ""]);
    });
    aoa.push(["합계", "", "", "", "", "", t.sales, t.cost, ""]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "수출대장현황");
    XLSX.writeFile(wb, `수출대장현황_${from}_${to}.xlsx`);
  };

  const filter = (
    <>
      <input
        list="export-cust-options"
        className="input max-w-[200px]"
        placeholder="고객사명 입력 (비우면 전체)"
        value={cust}
        onChange={(e) => setCust(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fetchRows()}
      />
      <datalist id="export-cust-options">
        {customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
    </>
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
      count={gps.length}
      extraFilter={filter}
    >
      <div className="card overflow-x-auto">
        <div className="mb-3">
          <h2 className="font-semibold">수출대장 · 고객사별 매출</h2>
          <p className="text-xs text-slate-500">
            고객사명을 클릭하면 세부 내역이 팝업으로 열립니다.
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
                  <th style={{ minWidth: 160 }}>고객사</th>
                  <th className="text-right">매출 계</th>
                  <th className="text-right">원가 계</th>
                  <th className="text-right">누계매출계</th>
                </tr>
              </thead>
              <tbody>
                {gps.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {pageGps.map(({ g, cum }) => (
                  <tr key={g.name} className="hover:bg-sky-50">
                    <td className="whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetail(g)}
                        className="font-medium text-sky-700 hover:underline text-left"
                        title="세부 내역 보기"
                      >
                        {g.name} 🔍
                      </button>
                    </td>
                    <td className="text-right tabular-nums">{fmt(g.sales)}</td>
                    <td className="text-right tabular-nums">{fmt(g.cost)}</td>
                    <td className="text-right tabular-nums text-slate-500">{fmt(cum)}</td>
                  </tr>
                ))}
              </tbody>
              {gps.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td>합계</td>
                    <td className="text-right">{fmt(t.sales)}</td>
                    <td className="text-right">{fmt(t.cost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
            {gps.length > PAGE && (
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

// 고객사 세부 내역 팝업 (수출대장 라인 항목)
function DetailModal({ group, onClose }: { group: Group; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
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
                <th className="whitespace-nowrap">납기일</th>
                <th>구분</th>
                <th>국가</th>
                <th>품명</th>
                <th className="text-right">수량(단위)</th>
                <th className="text-right">매출 계</th>
                <th className="text-right">원가 계</th>
                <th className="text-right">환율</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{ymd(r.delivery_date)}</td>
                  <td className="text-slate-500">{r.supply_type}</td>
                  <td>{r.country_name}</td>
                  <td>{r.product_name}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.qty_unit), 0)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.sales_total))}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.mfg_cost_total))}</td>
                  <td className="text-right tabular-nums text-slate-500">
                    {fmt(num(r.exchange_rate), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td colSpan={5}>소계</td>
                <td className="text-right tabular-nums">{fmt(group.sales)}</td>
                <td className="text-right tabular-nums">{fmt(group.cost)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
