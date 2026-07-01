"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DateBar from "@/components/DateBar";
import ExcelBox from "@/components/ExcelBox";
import { fmt } from "@/lib/types";
import { listChannels, listLoadingByDate, saveLoading } from "@/lib/actions";

type Channel = { id: number; group_name: string | null; name: string; sort_order: number };
const num = (v: any) => Number(v ?? 0);

export default function LoadingPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [channels, setChannels] = useState<Channel[]>([]);
  const [values, setValues] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listChannels().then((d) => setChannels(d as Channel[]));
  }, []);

  const fetchValues = useCallback(async () => {
    setLoading(true);
    const data = (await listLoadingByDate(date)) as any[];
    const map: Record<number, number> = {};
    data.forEach((r) => {
      if (r.channel_id != null) map[r.channel_id] = num(r.supply_amount);
    });
    setValues(map);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

  const save = async () => {
    setSaving(true);
    await saveLoading(
      date,
      channels.map((c) => ({
        channel_id: c.id,
        channel_name: c.name,
        supply_amount: num(values[c.id]),
      }))
    );
    setSaving(false);
    fetchValues();
  };

  const total = useMemo(
    () => channels.reduce((s, c) => s + num(values[c.id]), 0),
    [channels, values]
  );

  const grouped = useMemo(() => {
    const g: { group: string; items: Channel[] }[] = [];
    let cur = "";
    channels.forEach((c) => {
      const grp = c.group_name || cur || "기타";
      if (c.group_name) cur = c.group_name;
      let bucket = g.find((x) => x.group === grp);
      if (!bucket) {
        bucket = { group: grp, items: [] };
        g.push(bucket);
      }
      bucket.items.push(c);
    });
    return g;
  }, [channels]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">상차금액 입력</h1>
        <p className="text-sm text-slate-500">상차일 기준 · 채널별 공급가액</p>
      </div>

      <DateBar date={date} setDate={setDate}>
        <span className="text-sm text-slate-500 mr-2">
          합계 <b className="text-slate-800">{fmt(total)}</b> 원
        </span>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </DateBar>

      <div className="card">
        <ExcelBox kind="loading" onDone={fetchValues} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>구분</th>
                <th style={{ minWidth: 240 }}>채널명</th>
                <th className="text-right" style={{ minWidth: 160 }}>공급가액</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) =>
                g.items.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-slate-500">{i === 0 ? g.group : ""}</td>
                    <td>{c.name}</td>
                    <td>
                      <input
                        type="number"
                        className="input text-right"
                        value={values[c.id] ?? 0}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [c.id]: Number(e.target.value) }))
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td colSpan={2}>총 합계</td>
                <td className="text-right">{fmt(total)} 원</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
