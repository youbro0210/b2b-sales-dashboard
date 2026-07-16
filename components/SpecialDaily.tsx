"use client";

import { useCallback, useEffect, useState } from "react";
import NumberInput from "@/components/NumberInput";
import ExcelBox from "@/components/ExcelBox";
import { fmtInt, todayKST } from "@/lib/types";
import { listChannels, listLoadingRange, bulkSaveLoading } from "@/lib/actions";

type Channel = { id: number; group_name: string | null; name: string; sort_order: number };
const num = (v: any) => Number(v ?? 0);
const isSum = (n: string) => /합계\s*$/.test((n || "").trim());

// 특정 입력: 일별 등록 (날짜 선택 → 채널별 금액 입력)
export default function SpecialDaily() {
  const [date, setDate] = useState(() => todayKST());
  const [channels, setChannels] = useState<Channel[]>([]);
  const [vals, setVals] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    if (!channels.length) return;
    setLoading(true);
    const rows = (await listLoadingRange(date, date)) as any[];
    const m: Record<number, number> = {};
    rows.forEach((r) => {
      m[r.channel_id] = (m[r.channel_id] || 0) + num(r.supply_amount);
    });
    setVals(m);
    setLoading(false);
  }, [date, channels.length]);

  useEffect(() => {
    load();
  }, [load]);

  const setVal = (cid: number, v: number) =>
    setVals((prev) => ({ ...prev, [cid]: v }));

  const total = channels.reduce((s, c) => s + num(vals[c.id]), 0);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const rows = channels.map((c) => ({
      load_date: date,
      channel_name: c.name,
      supply_amount: num(vals[c.id]),
    }));
    const res = await bulkSaveLoading(rows);
    setSaving(false);
    setMsg(res.ok ? `${date} 저장 완료` : "저장 실패: " + (res.error ?? ""));
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">특정 입력</h1>
        <p className="text-sm text-slate-500">일자를 선택하고 채널별 매출을 입력하세요.</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            className="input max-w-[170px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="btn-primary whitespace-nowrap"
            onClick={save}
            disabled={saving || loading}
          >
            {saving ? "저장 중..." : "💾 저장"}
          </button>
          <span className="ml-auto text-sm text-slate-500">
            합계 <b className="text-slate-800">{fmtInt(total)}</b> 원
          </span>
        </div>
        {msg && <p className="text-xs text-slate-600 mt-2">{msg}</p>}
      </div>

      <div className="card">
        <p className="text-sm text-slate-500 mb-2">
          엑셀 업로드 시 <b>채널명</b>·일자 기준으로 해당 데이터를 덮어씁니다.
          (양식: 일자 / 구분 / 채널명 / 공급가액)
        </p>
        <ExcelBox kind="loading" templateFile="특정_업로드양식.xlsx" onDone={load} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : channels.length === 0 ? (
          <p className="text-center text-slate-400 py-6">
            등록된 특정 채널이 없습니다. 기준정보 관리 → 상차 채널에서 그룹명 “특정”으로 추가하세요.
          </p>
        ) : (
          <table className="data celled">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>채널명</th>
                <th className="text-right">공급가액</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium whitespace-nowrap">{c.name}</td>
                  <td className="p-0">
                    <NumberInput
                      value={vals[c.id] || 0}
                      onChange={(v) => setVal(c.id, v)}
                      decimals={0}
                      className="w-full text-right px-2 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-brand-light"
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td>합계</td>
                <td className="text-right tabular-nums">{fmtInt(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
