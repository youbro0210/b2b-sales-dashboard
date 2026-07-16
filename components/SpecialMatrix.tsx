"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import NumberInput from "@/components/NumberInput";
import ExcelBox from "@/components/ExcelBox";
import { fmtInt, monthKST } from "@/lib/types";
import { listChannels, listLoadingRange, bulkSaveLoading } from "@/lib/actions";

type Channel = { id: number; group_name: string | null; name: string; sort_order: number };
const num = (v: any) => Number(v ?? 0);
const isSum = (n: string) => /합계\s*$/.test((n || "").trim());
const WD = ["일", "월", "화", "수", "목", "금", "토"];

// 특정: 월 매트릭스 (행=고객사(특정 채널), 열=일자). readOnly=true 면 현황(조회 전용).
export default function SpecialMatrix({ readOnly = false }: { readOnly?: boolean }) {
  const [month, setMonth] = useState(() => monthKST()); // YYYY-MM
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cells, setCells] = useState<Record<number, Record<number, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);

  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );
  const wdOf = (d: number) => WD[new Date(y, m - 1, d).getDay()];
  const wdColor = (d: number) => {
    const g = new Date(y, m - 1, d).getDay();
    return g === 0 ? "text-red-500" : g === 6 ? "text-blue-500" : "text-slate-500";
  };

  useEffect(() => {
    listChannels().then((d) => {
      const all = d as Channel[];
      let cur = "";
      const wg = all.map((c) => {
        if (c.group_name) cur = c.group_name;
        return { ...c, group_name: c.group_name || cur };
      });
      setChannels(wg.filter((c) => (c.group_name || "") === "특정" && !isSum(c.name)));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;
    const rows = (await listLoadingRange(from, to)) as any[];
    const map: Record<number, Record<number, number>> = {};
    rows.forEach((r) => {
      const day = Number(String(r.load_date).slice(8, 10));
      if (!map[r.channel_id]) map[r.channel_id] = {};
      map[r.channel_id][day] = (map[r.channel_id][day] || 0) + num(r.supply_amount);
    });
    setCells(map);
    setSearched(true);
    setLoading(false);
  }, [month, daysInMonth]);

  // 입력 모드: 달 바뀌면 자동 조회 / 현황 모드: 조회 버튼으로만
  useEffect(() => {
    if (!readOnly && channels.length) load();
  }, [readOnly, load, channels.length]);

  const setCell = (cid: number, day: number, v: number) =>
    setCells((prev) => ({ ...prev, [cid]: { ...(prev[cid] || {}), [day]: v } }));

  const rowTotal = (cid: number) => days.reduce((s, d) => s + num(cells[cid]?.[d]), 0);
  const dayTotal = (day: number) => channels.reduce((s, c) => s + num(cells[c.id]?.[day]), 0);
  const grand = channels.reduce((s, c) => s + rowTotal(c.id), 0);

  const save = async () => {
    setSaving(true);
    const rows: any[] = [];
    channels.forEach((c) =>
      days.forEach((d) => {
        rows.push({
          load_date: `${month}-${String(d).padStart(2, "0")}`,
          channel_name: c.name,
          supply_amount: num(cells[c.id]?.[d]),
        });
      })
    );
    await bulkSaveLoading(rows);
    setSaving(false);
    load();
  };

  const download = () => {
    const head = ["고객사명", "합계", ...days.map((d) => `${d}일`)];
    const wdRow = ["", "", ...days.map((d) => wdOf(d))];
    const body = channels.map((c) => [
      c.name,
      rowTotal(c.id),
      ...days.map((d) => num(cells[c.id]?.[d])),
    ]);
    const foot = ["합계", grand, ...days.map((d) => dayTotal(d))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([head, wdRow, ...body, foot]),
      "특정"
    );
    XLSX.writeFile(wb, `특정${readOnly ? "현황" : ""}_${month}.xlsx`);
  };

  const show = !readOnly || searched;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">특정 {readOnly ? "현황" : "입력"}</h1>
        <p className="text-sm text-slate-500">
          월별 고객사·일자별 매출 {readOnly ? "· 조회 전용(수정 불가)" : "입력"}
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            className="input max-w-[160px]"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              if (readOnly) setSearched(false);
            }}
          />
          {readOnly && (
            <button className="btn-primary whitespace-nowrap" onClick={load} disabled={loading}>
              {loading ? "조회 중..." : "🔍 조회"}
            </button>
          )}
          {!readOnly && (
            <button className="btn-primary whitespace-nowrap" onClick={save} disabled={saving || loading}>
              {saving ? "저장 중..." : "💾 저장"}
            </button>
          )}
          <button className="btn-ghost whitespace-nowrap" onClick={download}>
            ⬇ 엑셀 다운로드
          </button>
          <span className="ml-auto text-sm text-slate-500">
            합계 <b className="text-slate-800">{fmtInt(grand)}</b> 원
          </span>
        </div>
      </div>

      {!readOnly && (
        <div className="card">
          <p className="text-sm text-slate-500 mb-2">
            엑셀 업로드 시 <b>채널명(고객사)</b>·일자 기준으로 해당 월 데이터를 덮어씁니다.
            (양식: 일자 / 구분 / 채널명 / 공급가액)
          </p>
          <ExcelBox kind="loading" onDone={load} />
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : !show ? (
          <p className="text-center text-slate-400 py-6">🔍 조회 버튼을 눌러 조회하세요.</p>
        ) : channels.length === 0 ? (
          <p className="text-center text-slate-400 py-6">
            등록된 특정 채널이 없습니다. 기준정보 관리 → 상차 채널에서 그룹명 “특정”으로 추가하세요.
          </p>
        ) : (
          <table className="data celled text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-100 z-10" style={{ minWidth: 140 }}>고객사명</th>
                <th className="text-right" style={{ minWidth: 90 }}>합계</th>
                {days.map((d) => (
                  <th key={d} className="text-right" style={{ minWidth: 70 }}>{d}일</th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 bg-slate-100 z-10"></th>
                <th></th>
                {days.map((d) => (
                  <th key={d} className={"text-right font-normal " + wdColor(d)}>{wdOf(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td className="sticky left-0 bg-white z-10 font-medium whitespace-nowrap">{c.name}</td>
                  <td className="text-right tabular-nums font-semibold bg-slate-50">{fmtInt(rowTotal(c.id))}</td>
                  {days.map((d) => (
                    <td key={d} className="p-0">
                      {readOnly ? (
                        <div className="text-right tabular-nums px-2 py-1">
                          {cells[c.id]?.[d] ? fmtInt(cells[c.id][d]) : ""}
                        </div>
                      ) : (
                        <NumberInput
                          value={cells[c.id]?.[d] || 0}
                          onChange={(v) => setCell(c.id, d, v)}
                          decimals={0}
                          className="w-full text-right text-xs px-1 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-brand-light"
                          placeholder=""
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-100">
                <td className="sticky left-0 bg-slate-100 z-10">합계</td>
                <td className="text-right tabular-nums">{fmtInt(grand)}</td>
                {days.map((d) => (
                  <td key={d} className="text-right tabular-nums">{fmtInt(dayTotal(d))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
