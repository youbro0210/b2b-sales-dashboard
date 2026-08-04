"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ymd, todayKST } from "@/lib/types";
import {
  listLoadingRange,
  listChannels,
  listSalesNotes,
  addSalesNote,
  updateSalesNote,
  deleteSalesNote,
} from "@/lib/actions";

// B2C 채널 그룹 (오프라인 + 온라인)
const MART = ["오프라인", "롯데마트_수수료업체", "이마트_수수료업체"];
const ONLINE = ["온라인"];
const GROUPS = [...MART, ...ONLINE];

const num = (v: any) => Number(v ?? 0);
const isSum = (n: string) => /합계\s*$/.test((n || "").trim());
// 천원 단위 정수 (반올림 + 콤마)
const won = (v: number) => Math.round(num(v) / 1000).toLocaleString("ko-KR");

// ---- 날짜 도우미 ----
function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function monthStart(d: string) {
  return d.slice(0, 8) + "01";
}
function prevMonthStart(d: string) {
  const [y, m] = d.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}-01`;
}
function prevMonthSameDay(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const last = new Date(py, pm, 0).getDate();
  const dd = Math.min(day, last);
  return `${py}-${String(pm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

type Row = { name: string; d: number; pd: number; mtd: number; pmtd: number };

// 선택 일자 기준 채널별 매출액(당일/전일/당월누계/전월누계) 계산
function useSalesTable(date: string) {
  const [rows, setRows] = useState<any[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const all = (await listChannels()) as any[];
      let cur = "";
      const map: Record<string, number> = {};
      const names: string[] = [];
      all.forEach((c, i) => {
        if (c.group_name) cur = c.group_name;
        const g = c.group_name || cur;
        if (GROUPS.includes(g) && !isSum(c.name)) {
          map[c.name] = i;
          names.push(c.name);
        }
      });
      const data = (await listLoadingRange(prevMonthStart(date), date)) as any[];
      if (!alive) return;
      setChannels(names);
      setRows(
        data.filter((r) =>
          Object.prototype.hasOwnProperty.call(map, String(r.channel_name))
        )
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  const table = useMemo<Row[]>(() => {
    const D = date;
    const prevD = addDays(D, -1);
    const mStart = monthStart(D);
    const pmStart = prevMonthStart(D);
    const pmSame = prevMonthSameDay(D);
    const per: Record<string, Row> = {};
    channels.forEach((c) => (per[c] = { name: c, d: 0, pd: 0, mtd: 0, pmtd: 0 }));
    rows.forEach((r) => {
      const c = String(r.channel_name);
      if (!per[c]) return;
      const dt = ymd(r.load_date);
      const v = num(r.supply_amount);
      if (dt === D) per[c].d += v;
      if (dt === prevD) per[c].pd += v;
      if (dt >= mStart && dt <= D) per[c].mtd += v;
      if (dt >= pmStart && dt <= pmSame) per[c].pmtd += v;
    });
    return channels.map((c) => per[c]);
  }, [rows, channels, date]);

  const total = useMemo<Row>(
    () =>
      table.reduce(
        (a, r) => ({
          name: "합계",
          d: a.d + r.d,
          pd: a.pd + r.pd,
          mtd: a.mtd + r.mtd,
          pmtd: a.pmtd + r.pmtd,
        }),
        { name: "합계", d: 0, pd: 0, mtd: 0, pmtd: 0 }
      ),
    [table]
  );

  return { table, total, loading };
}

// 매출액 표 (당일/전일/당월누계/전월누계 · 천원)
function SalesTable({ date }: { date: string }) {
  const { table, total, loading } = useSalesTable(date);
  return (
    <div className="overflow-x-auto">
      <table className="data celled text-sm">
        <thead>
          <tr>
            <th rowSpan={2} style={{ minWidth: 90 }}>채널</th>
            <th colSpan={4} className="text-center">매출액 (단위: 천원)</th>
          </tr>
          <tr>
            <th className="text-right">당일</th>
            <th className="text-right">전일</th>
            <th className="text-right">당월누계</th>
            <th className="text-right">전월누계</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-6">불러오는 중...</td>
            </tr>
          )}
          {!loading && table.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-6">채널 정보가 없습니다.</td>
            </tr>
          )}
          {!loading &&
            table.map((r) => (
              <tr key={r.name}>
                <td className="font-medium whitespace-nowrap">{r.name}</td>
                <td className="text-right tabular-nums">{won(r.d)}</td>
                <td className="text-right tabular-nums text-slate-500">{won(r.pd)}</td>
                <td className="text-right tabular-nums">{won(r.mtd)}</td>
                <td className="text-right tabular-nums text-slate-500">{won(r.pmtd)}</td>
              </tr>
            ))}
        </tbody>
        {!loading && table.length > 0 && (
          <tfoot>
            <tr className="font-semibold bg-slate-50">
              <td>합계</td>
              <td className="text-right tabular-nums">{won(total.d)}</td>
              <td className="text-right tabular-nums">{won(total.pd)}</td>
              <td className="text-right tabular-nums">{won(total.mtd)}</td>
              <td className="text-right tabular-nums">{won(total.pmtd)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// 특이사항 로드 훅
function useNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  const load = useCallback(
    () => listSalesNotes().then((d) => setNotes(d as any[])),
    []
  );
  useEffect(() => {
    load();
  }, [load]);
  return { notes, load };
}

const NOTE_TYPES: { key: string; label: string }[] = [
  { key: "cur", label: "당월 매출 특이사항" },
  { key: "prev", label: "전월 매출 특이사항" },
];

// 특이사항 편집 (등록/수정/삭제)
function NotesEditor() {
  const { notes, load } = useNotes();

  const Section = ({ type, label }: { type: string; label: string }) => {
    const items = notes.filter((n) => n.note_type === type);
    const [adding, setAdding] = useState("");
    return (
      <div className="card">
        <h3 className="font-semibold mb-2">* {label} *</h3>
        <ol className="space-y-1.5">
          {items.map((n, i) => (
            <li key={n.id} className="flex items-center gap-2">
              <span className="text-slate-400 text-sm w-5 text-right">{i + 1}.</span>
              <input
                className="input flex-1 !py-1 text-sm"
                defaultValue={n.content}
                onBlur={async (e) => {
                  const v = e.target.value.trim();
                  if (v && v !== n.content) {
                    await updateSalesNote(n.id, v);
                    load();
                  }
                }}
              />
              <button
                className="text-red-500 text-sm shrink-0"
                onClick={async () => {
                  if (confirm("삭제할까요?")) {
                    await deleteSalesNote(n.id);
                    load();
                  }
                }}
              >
                삭제
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-slate-400 pl-7">등록된 내용이 없습니다.</li>
          )}
        </ol>
        <div className="flex items-center gap-2 mt-2 pl-7">
          <input
            className="input flex-1 !py-1 text-sm"
            placeholder="특이사항 추가 후 Enter 또는 추가"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && adding.trim()) {
                await addSalesNote(type, adding.trim());
                setAdding("");
                load();
              }
            }}
          />
          <button
            className="btn-primary shrink-0"
            onClick={async () => {
              if (adding.trim()) {
                await addSalesNote(type, adding.trim());
                setAdding("");
                load();
              }
            }}
          >
            추가
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {NOTE_TYPES.map((t) => (
        <div key={t.key}>{Section({ type: t.key, label: t.label })}</div>
      ))}
    </div>
  );
}

// 특이사항 읽기 전용 (대시보드용)
function NotesView({ notes }: { notes: any[] }) {
  return (
    <div className="space-y-3">
      {NOTE_TYPES.map((t) => {
        const items = notes.filter((n) => n.note_type === t.key);
        return (
          <div key={t.key}>
            <div className="text-sm font-semibold text-slate-700 mb-1">* {t.label} *</div>
            {items.length === 0 ? (
              <p className="text-xs text-slate-400 pl-4">-</p>
            ) : (
              <ol className="text-xs text-slate-600 space-y-0.5 pl-1">
                {items.map((n, i) => (
                  <li key={n.id}>
                    {i + 1}. {n.content}
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== 입력 메뉴: 매출 리포트 화면 =====
export default function SalesReport() {
  const [date, setDate] = useState(() => todayKST());
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">매출 리포트</h1>
        <p className="text-sm text-slate-500">
          상차일자 기준 채널별 매출액을 확인하고, 당월/전월 매출 특이사항을 등록하세요.
          (대시보드에 함께 표시됩니다.)
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-sm text-slate-500">상차일자</span>
          <input
            type="date"
            className="input max-w-[170px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <SalesTable date={date} />
      </div>

      <NotesEditor />
    </div>
  );
}

// ===== 대시보드 블록: 상차일자 선택 표 + 특이사항(읽기 전용) =====
export function SalesDashboardBlock() {
  const [date, setDate] = useState(() => todayKST());
  const { notes } = useNotes();
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="font-semibold">B2C 매출 현황</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">상차일자</span>
          <input
            type="date"
            className="input !py-1 !text-xs max-w-[150px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <span className="text-[11px] text-slate-400">· 천원</span>
        </div>
      </div>
      <SalesTable date={date} />
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-400 mb-2">특이사항 등록·수정은 [입력 › 매출 리포트] 화면에서 하세요.</p>
        <NotesView notes={notes} />
      </div>
    </div>
  );
}
