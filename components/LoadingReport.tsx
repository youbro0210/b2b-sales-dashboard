"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listChannels, listLoadingRange } from "@/lib/actions";

type Channel = { id: number; group_name: string | null; name: string; sort_order: number };
const num = (v: any) => Number(v ?? 0);
const isSum = (n: string) => /합계\s*$/.test((n || "").trim());
const PAGE = 20;

// B2C 오프라인 / B2C 온라인 / 특정 현황 (조회 전용 + 채널 필터 + 페이징 + 엑셀 다운로드)
export default function LoadingReport({
  title,
  groups,
}: {
  title: string;
  groups: string[];
}) {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [chan, setChan] = useState(""); // 선택 채널명 ("" = 전체)
  const [rows, setRows] = useState<any[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    listChannels().then((d) => {
      const all = d as Channel[];
      let cur = "";
      const wg = all.map((c) => {
        if (c.group_name) cur = c.group_name;
        return { ...c, group_name: c.group_name || cur };
      });
      setChannels(wg);
    });
  }, []);

  // 이 화면이 다루는 채널 (합계 행 제외)
  const menuChannels = useMemo(
    () => channels.filter((c) => groups.includes(c.group_name || "") && !isSum(c.name)),
    [channels, groups]
  );
  const allowIds = useMemo(() => new Set(menuChannels.map((c) => c.id)), [menuChannels]);
  const nameOf = useMemo(() => {
    const m = new Map<number, string>();
    channels.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [channels]);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    let data = (await listLoadingRange(from, to)) as any[];
    data = data.filter((r) => allowIds.has(r.channel_id));
    if (chan) data = data.filter((r) => (nameOf.get(r.channel_id) || r.channel_name) === chan);
    data.sort(
      (a, b) =>
        ymd(a.load_date).localeCompare(ymd(b.load_date)) ||
        (nameOf.get(a.channel_id) || "").localeCompare(nameOf.get(b.channel_id) || "")
    );
    setRows(data);
    setPage(0);
    setSearched(true);
    setLoading(false);
  }, [from, to, chan, allowIds, nameOf]);

  const total = rows.reduce((s, r) => s + num(r.supply_amount), 0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);

  // 채널별 합계 (엑셀 두 번째 시트용)
  const byChannel = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r) => m.set(r.channel_id, (m.get(r.channel_id) || 0) + num(r.supply_amount)));
    return menuChannels
      .map((c) => ({ name: c.name, sum: m.get(c.id) || 0 }))
      .filter((x) => x.sum !== 0);
  }, [rows, menuChannels]);

  const download = () => {
    const detail = rows.map((r) => [
      ymd(r.load_date),
      nameOf.get(r.channel_id) || r.channel_name,
      num(r.supply_amount),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["일자", "채널명", "공급가액"], ...detail, ["합계", "", total]]),
      "상세"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["채널명", "기간 합계"],
        ...byChannel.map((x) => [x.name, x.sum]),
        ["합계", total],
      ]),
      "채널별합계"
    );
    XLSX.writeFile(wb, `${title}현황_${from}_${to}.xlsx`);
  };

  const filter = (
    <select
      className="input max-w-[170px]"
      value={chan}
      onChange={(e) => setChan(e.target.value)}
    >
      <option value="">전체 채널</option>
      {menuChannels.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
    </select>
  );

  return (
    <ReportShell
      title={title}
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
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">상차 내역</h2>
          <span className="text-sm text-slate-500">
            합계 <b className="text-slate-800">{fmt(total)}</b> 원
          </span>
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
                  <th style={{ minWidth: 200 }}>채널명</th>
                  <th className="text-right">공급가액</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {pageRows.map((r, i) => (
                  <tr key={r.channel_id + "-" + ymd(r.load_date) + "-" + i}>
                    <td className="whitespace-nowrap">{ymd(r.load_date)}</td>
                    <td>{nameOf.get(r.channel_id) || r.channel_name}</td>
                    <td className="text-right tabular-nums">{fmt(num(r.supply_amount))}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td colSpan={2}>합계</td>
                    <td className="text-right">{fmt(total)}</td>
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
