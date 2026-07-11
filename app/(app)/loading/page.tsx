"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DateBar from "@/components/DateBar";
import ExcelBox from "@/components/ExcelBox";
import NumberInput from "@/components/NumberInput";
import { fmt, todayKST } from "@/lib/types";
import {
  listChannels,
  listLoadingByDate,
  saveLoading,
  countLoadingRange,
  deleteLoadingRange,
} from "@/lib/actions";

type Channel = { id: number; group_name: string | null; name: string; sort_order: number };
const num = (v: any) => Number(v ?? 0);
// 이름이 "합계"로 끝나는 채널은 하위 채널 자동합산(읽기 전용) 행으로 취급
const isSum = (name: string) => /합계\s*$/.test((name || "").trim());
const sumPrefix = (name: string) => name.replace(/합계\s*$/, "").trim();

// 그룹 안에서 마트별로 묶어 정렬한다.
// 각 "합계" 행을 기준으로, 이름이 같은 접두사로 시작하는 채널들을 그 합계 바로 위에 모은다.
// (DB sort_order가 밀려도 항상 마트별로 묶이도록 렌더 시점에 재정렬)
const orderItems = (items: Channel[]): Channel[] => {
  const sums = items.filter((c) => isSum(c.name));
  const clusterOf = (c: Channel): { anchor: number; isSum: number } => {
    if (isSum(c.name)) return { anchor: c.sort_order, isSum: 1 };
    let best: { anchor: number; plen: number } | null = null;
    for (const s of sums) {
      const p = sumPrefix(s.name);
      if (p && c.name.startsWith(p) && (!best || p.length > best.plen)) {
        best = { anchor: s.sort_order, plen: p.length };
      }
    }
    return { anchor: best ? best.anchor : c.sort_order, isSum: 0 };
  };
  return [...items].sort((a, b) => {
    const ka = clusterOf(a);
    const kb = clusterOf(b);
    if (ka.anchor !== kb.anchor) return ka.anchor - kb.anchor; // 같은 마트끼리 인접
    if (ka.isSum !== kb.isSum) return ka.isSum - kb.isSum; // 회원 채널 → 합계 순
    return a.sort_order - b.sort_order;
  });
};

export default function LoadingPage() {
  const [date, setDate] = useState(() => todayKST());
  const [channels, setChannels] = useState<Channel[]>([]);
  const [values, setValues] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 잘못 업로드한 데이터 기간 삭제
  const today = todayKST();
  const [delFrom, setDelFrom] = useState(today);
  const [delTo, setDelTo] = useState(today);
  const [deleting, setDeleting] = useState(false);
  const [delMsg, setDelMsg] = useState<string | null>(null);

  const removeRange = async () => {
    setDelMsg(null);
    if (delFrom > delTo) {
      setDelMsg("시작일이 종료일보다 늦습니다.");
      return;
    }
    setDeleting(true);
    try {
      const n = await countLoadingRange(delFrom, delTo);
      if (!n) {
        setDelMsg(`${delFrom} ~ ${delTo} 기간에 저장된 데이터가 없습니다.`);
      } else if (
        confirm(
          `${delFrom} ~ ${delTo} 기간의 상차 데이터 ${n}건을 삭제합니다.\n삭제하면 되돌릴 수 없습니다. 진행할까요?`
        )
      ) {
        await deleteLoadingRange(delFrom, delTo);
        setDelMsg(`${n}건 삭제 완료`);
        fetchValues();
      }
    } catch (e: any) {
      setDelMsg("삭제 오류: " + (e?.message ?? ""));
    }
    setDeleting(false);
  };

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
    // 합계 채널은 저장하지 않음(하위 채널로 자동 계산 → 대시보드 중복 합산 방지)
    await saveLoading(
      date,
      channels.map((c) => ({
        channel_id: c.id,
        channel_name: c.name,
        supply_amount: isSum(c.name) ? 0 : num(values[c.id]),
      }))
    );
    setSaving(false);
    fetchValues();
  };

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
    return g.map((b) => ({ ...b, items: orderItems(b.items) }));
  }, [channels]);

  // 합계 채널 값 = 같은 그룹에서 이름 접두사가 같은 (합계가 아닌) 하위 채널들의 합
  const memberSum = (sumName: string, items: Channel[]) => {
    const prefix = sumName.replace(/합계\s*$/, "").trim();
    return items
      .filter((c) => !isSum(c.name) && c.name.startsWith(prefix))
      .reduce((s, c) => s + num(values[c.id]), 0);
  };
  const cellValue = (c: Channel, items: Channel[]) =>
    isSum(c.name) ? memberSum(c.name, items) : num(values[c.id]);

  // 총 합계에서는 합계 행 제외(중복 방지)
  const total = useMemo(
    () =>
      channels
        .filter((c) => !isSum(c.name))
        .reduce((s, c) => s + num(values[c.id]), 0),
    [channels, values]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">마트/온라인/특정 입력</h1>
        <p className="text-sm text-slate-500">
          일자 기준 · 채널별 공급가액 <span className="text-slate-400">(합계 행은 자동 계산되며 총 합계에서 제외됩니다)</span>
        </p>
      </div>

      <DateBar date={date} setDate={setDate}>
        <span className="text-sm text-slate-500 mr-2">
          합계 <b className="text-slate-800">{fmt(total)}</b> 원
        </span>
        <button className="btn-ghost" onClick={fetchValues} disabled={loading}>
          {loading ? "조회 중..." : "🔍 조회"}
        </button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </DateBar>

      <div className="card">
        <ExcelBox
          kind="loading"
          onDone={fetchValues}
          exportName={`상차금액_${date}.xlsx`}
          // 양식: 선택한 일자 + 구분 + 채널명이 미리 채워지고, 공급가액만 비워둠
          // (합계 행은 자동계산이므로 제외)
          getTemplateRows={() =>
            grouped.flatMap((g) =>
              g.items
                .filter((c) => !isSum(c.name))
                .map((c) => [date, g.group, c.name, ""])
            )
          }
          getExport={() => [
            ["일자", "구분", "채널명", "공급가액"],
            ...grouped.flatMap((g) =>
              g.items.map((c) => [date, g.group, c.name, cellValue(c, g.items)])
            ),
          ]}
        />
      </div>

      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-600">
            🗑 잘못 올린 데이터 삭제
          </span>
          <input
            type="date"
            className="input !py-1 !px-2 !text-xs w-[130px]"
            value={delFrom}
            onChange={(e) => setDelFrom(e.target.value)}
          />
          <span className="text-xs text-slate-500">~</span>
          <input
            type="date"
            className="input !py-1 !px-2 !text-xs w-[130px]"
            value={delTo}
            onChange={(e) => setDelTo(e.target.value)}
          />
          <button
            className="btn bg-red-50 text-red-600 hover:bg-red-100"
            onClick={removeRange}
            disabled={deleting}
          >
            {deleting ? "처리 중..." : "기간 삭제"}
          </button>
          {delMsg && <span className="text-xs text-slate-600">{delMsg}</span>}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          선택한 기간의 상차 데이터를 모두 삭제합니다. 삭제 전 건수를 확인시켜 드리며, 되돌릴 수 없습니다.
        </p>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data celled">
            <thead>
              <tr>
                <th style={{ minWidth: 90 }}>구분</th>
                <th style={{ minWidth: 240 }}>채널명</th>
                <th className="text-right" style={{ minWidth: 160 }}>공급가액</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) =>
                g.items.map((c, i) => {
                  const sum = isSum(c.name);
                  return (
                    <tr key={c.id} className={sum ? "bg-blue-50" : undefined}>
                      <td className="text-slate-500 align-middle">
                        {i === 0 ? g.group : ""}
                      </td>
                      <td className={sum ? "font-semibold text-slate-700" : ""}>
                        {c.name}
                      </td>
                      <td>
                        {sum ? (
                          <div className="text-right pr-2 font-semibold tabular-nums text-blue-700">
                            {fmt(memberSum(c.name, g.items))}
                          </div>
                        ) : (
                          <NumberInput
                            value={values[c.id] ?? 0}
                            onChange={(val) =>
                              setValues((v) => ({ ...v, [c.id]: val }))
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-100">
                <td colSpan={2}>총 합계 (합계 행 제외)</td>
                <td className="text-right">{fmt(total)} 원</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
