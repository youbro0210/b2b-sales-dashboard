"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listChannels, listLoadingRange } from "@/lib/actions";

type Channel = { id: number; group_name: string | null; name: string; sort_order: number };
const num = (v: any) => Number(v ?? 0);
const isSum = (n: string) => /합계\s*$/.test((n || "").trim());

// 마트 / 온라인 / 특정 현황 (조회 전용 + 엑셀 다운로드)
export default function LoadingReport({
  title,
  groups,
}: {
  title: string;
  groups: string[];
}) {
  const today = todayKST();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

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
  const allowIds = useMemo(
    () =>
      new Set(
        channels
          .filter((c) => groups.includes(c.group_name || "") && !isSum(c.name))
          .map((c) => c.id)
      ),
    [channels, groups]
  );
  const nameOf = useMemo(() => {
    const m = new Map<number, string>();
    channels.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [channels]);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    const data = (await listLoadingRange(from, to)) as any[];
    setRows(data.filter((r) => allowIds.has(r.channel_id)));
    setLoading(false);
  }, [from, to, allowIds]);

  useEffect(() => {
    if (allowIds.size) fetchRows();
  }, [fetchRows, allowIds.size]);

  // 채널별 기간 합계
  const byChannel = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r) =>
      m.set(r.channel_id, (m.get(r.channel_id) || 0) + num(r.supply_amount))
    );
    return channels
      .filter((c) => allowIds.has(c.id))
      .map((c) => ({ name: c.name, sum: m.get(c.id) || 0 }))
      .filter((x) => x.sum !== 0);
  }, [rows, channels, allowIds]);
  const total = byChannel.reduce((s, x) => s + x.sum, 0);

  const download = () => {
    const detail = rows
      .slice()
      .sort(
        (a, b) =>
          ymd(a.load_date).localeCompare(ymd(b.load_date)) ||
          (nameOf.get(a.channel_id) || "").localeCompare(nameOf.get(b.channel_id) || "")
      )
      .map((r) => [ymd(r.load_date), nameOf.get(r.channel_id) || r.channel_name, num(r.supply_amount)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["일자", "채널명", "공급가액"], ...detail]),
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
    >
      <div className="card overflow-x-auto">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">채널별 합계</h2>
          <span className="text-sm text-slate-500">
            합계 <b className="text-slate-800">{fmt(total)}</b> 원
          </span>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>채널명</th>
                <th className="text-right">기간 합계</th>
              </tr>
            </thead>
            <tbody>
              {byChannel.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-400 py-6">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              )}
              {byChannel.map((x) => (
                <tr key={x.name}>
                  <td>{x.name}</td>
                  <td className="text-right tabular-nums">{fmt(x.sum)}</td>
                </tr>
              ))}
            </tbody>
            {byChannel.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-slate-50">
                  <td>합계</td>
                  <td className="text-right">{fmt(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </ReportShell>
  );
}
