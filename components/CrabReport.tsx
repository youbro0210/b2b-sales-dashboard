"use client";

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listCrabRange } from "@/lib/actions";

const CRAB_CHANNELS = ["롯데마트", "롯데슈퍼", "에브리데이", "서원유통"];
const num = (v: any) => Number(v ?? 0);
const PAGE = 20; // 페이지당 채널 수
const pct = (profit: number, sales: number) =>
  sales ? ((profit / sales) * 100).toFixed(1) : "0.0";

type Group = { name: string; rows: any[]; box: number; sales: number; profit: number };

// 꽃게 현황: 채널별 합계 + 누계를 먼저 보여주고, 채널명 클릭 시 일자별 세부 내역 팝업
export default function CrabReport() {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [chan, setChan] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Group | null>(null);

  const orderOf = (n: string) => {
    const i = CRAB_CHANNELS.indexOf(n);
    return i === -1 ? 9999 : i;
  };

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listCrabRange(from, to)) as any[];
    if (chan) data = data.filter((r) => String(r.channel_name) === chan);
    data.sort(
      (a, b) =>
        orderOf(String(a.channel_name)) - orderOf(String(b.channel_name)) ||
        ymd(a.sale_date).localeCompare(ymd(b.sale_date))
    );
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, chan]);

  // 채널별 그룹
  const gps = useMemo<Group[]>(() => {
    const g: Group[] = [];
    let cur: Group | null = null;
    for (const r of rows) {
      const nm = r.channel_name || "(미지정)";
      if (!cur || nm !== cur.name) {
        cur = { name: nm, rows: [], box: 0, sales: 0, profit: 0 };
        g.push(cur);
      }
      cur.rows.push(r);
      cur.box += num(r.box_qty);
      cur.sales += num(r.sales_amount);
      cur.profit += num(r.profit_amount);
    }
    return g;
  }, [rows]);

  const t = rows.reduce(
    (a, r) => ({
      box: a.box + num(r.box_qty),
      sales: a.sales + num(r.sales_amount),
      profit: a.profit + num(r.profit_amount),
    }),
    { box: 0, sales: 0, profit: 0 }
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
      ["채널명", "일자", "BOX수", "매입가", "납품가", "매출액", "이익액", "이익률(%)"],
    ];
    gps.forEach((g) => {
      g.rows.forEach((r) =>
        aoa.push([
          g.name,
          ymd(r.sale_date),
          num(r.box_qty),
          num(r.buy_price),
          num(r.supply_price),
          num(r.sales_amount),
          num(r.profit_amount),
          Number(pct(num(r.profit_amount), num(r.sales_amount))),
        ])
      );
      aoa.push([
        `${g.name} 소계`,
        "",
        g.box,
        "",
        "",
        g.sales,
        g.profit,
        Number(pct(g.profit, g.sales)),
      ]);
    });
    aoa.push(["합계", "", t.box, "", "", t.sales, t.profit, Number(pct(t.profit, t.sales))]);
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
      count={gps.length}
      extraFilter={filter}
    >
      <div className="card overflow-x-auto">
        <div className="mb-3">
          <h2 className="font-semibold">꽃게 · 채널별 매출</h2>
          <p className="text-xs text-slate-500">
            채널명을 클릭하면 일자별 세부 내역이 팝업으로 열립니다.
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
                  <th style={{ minWidth: 120 }}>채널명</th>
                  <th className="text-right">BOX수</th>
                  <th className="text-right">매출액</th>
                  <th className="text-right">이익액</th>
                  <th className="text-right">이익률</th>
                  <th className="text-right">누계매출액</th>
                </tr>
              </thead>
              <tbody>
                {gps.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-6">
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
                        title="일자별 세부 내역 보기"
                      >
                        {g.name} 🔍
                      </button>
                    </td>
                    <td className="text-right tabular-nums">{fmt(g.box, 0)}</td>
                    <td className="text-right tabular-nums">{fmt(g.sales, 0)}</td>
                    <td className="text-right tabular-nums">{fmt(g.profit, 0)}</td>
                    <td className="text-right text-slate-500">{pct(g.profit, g.sales)}%</td>
                    <td className="text-right tabular-nums text-slate-500">{fmt(cum, 0)}</td>
                  </tr>
                ))}
              </tbody>
              {gps.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td>합계</td>
                    <td className="text-right">{fmt(t.box, 0)}</td>
                    <td className="text-right">{fmt(t.sales, 0)}</td>
                    <td className="text-right">{fmt(t.profit, 0)}</td>
                    <td className="text-right">{pct(t.profit, t.sales)}%</td>
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

// 꽃게 채널 일자별 세부 내역 팝업
function DetailModal({ group, onClose }: { group: Group; onClose: () => void }) {
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
                <th className="text-right">BOX수</th>
                <th className="text-right">매입가</th>
                <th className="text-right">납품가</th>
                <th className="text-right">매출액</th>
                <th className="text-right">이익액</th>
                <th className="text-right">이익률</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{ymd(r.sale_date)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.box_qty), 0)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.buy_price), 0)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.supply_price), 0)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.sales_amount), 0)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.profit_amount), 0)}</td>
                  <td className="text-right text-slate-500">
                    {pct(num(r.profit_amount), num(r.sales_amount))}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td>소계</td>
                <td className="text-right tabular-nums">{fmt(group.box, 0)}</td>
                <td></td>
                <td></td>
                <td className="text-right tabular-nums">{fmt(group.sales, 0)}</td>
                <td className="text-right tabular-nums">{fmt(group.profit, 0)}</td>
                <td className="text-right">{pct(group.profit, group.sales)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
