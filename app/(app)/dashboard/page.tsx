"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
  Cell,
} from "recharts";
import { dashboardData } from "@/lib/actions";
import { fmt } from "@/lib/types";

const won = (v: number, decimals = 2) => fmt(v, decimals);
// KPI 카드: 억원 단위 (소수점 2자리)
const eok = (v: number) =>
  (Number(v || 0) / 1e8).toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
// 백만원 단위 축/툴팁/막대 상단 라벨
const millTick = (v: number) => (v / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 });
const millTip = (v: number) => (v / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + " 백만원";
const millLabel = (v: any) =>
  Number(v) ? (Number(v) / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) : "";
// 오늘 매출 카드: 백만원 단위 (소수점 1자리)
const mill = (v: number) =>
  (Number(v || 0) / 1e6).toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
// 날짜를 Date 객체/문자열 어느 쪽이든 "YYYY-MM-DD"로 정규화 (date 컬럼은 시간대 없음 → UTC 사용)
const ymd = (d: any): string => {
  if (!d) return "";
  if (d instanceof Date) return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
const monthKey = (d: any) => ymd(d).slice(0, 7);
const num = (v: any) => Number(v ?? 0);

// 다크 차트 패널 테마 (Apple Fitness 스타일 참고)
const C = {
  panel: "#0A2540",
  grid: "#1e3a52",
  axis: "#94a3b8",
  blue: "#38bdf8",
  green: "#34d399",
  amber: "#fbbf24",
  slate: "#64748b",
};
const panelStyle = { background: C.panel, borderColor: C.panel } as const;
const tooltipStyle = {
  background: "#1e293b",
  border: "none",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 12,
  boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
} as const;
const axisTick = { fill: C.axis, fontSize: 11 } as const;

type Any = Record<string, any>;

export default function DashboardPage() {
  const [b2b, setB2b] = useState<Any[]>([]);
  const [exp, setExp] = useState<Any[]>([]);
  const [load, setLoad] = useState<Any[]>([]);
  const [month, setMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(true);

  // 좁은 화면(모바일)에서는 차트에 최소 폭을 주고 가로 스크롤시켜
  // 막대/라벨이 겹치지 않게 한다.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const d = await dashboardData();
      setB2b(d.b2b as Any[]);
      setExp(d.exp as Any[]);
      setLoad(d.load as Any[]);
      setLoading(false);
    })();
  }, []);

  const b2bMonth = useMemo(
    () => b2b.filter((r) => monthKey(r.sale_date) === month),
    [b2b, month]
  );
  const expMonth = useMemo(
    () => exp.filter((r) => monthKey(r.delivery_date ?? "") === month),
    [exp, month]
  );
  const loadMonth = useMemo(
    () => load.filter((r) => monthKey(r.load_date) === month),
    [load, month]
  );

  const b2bSales = b2bMonth.reduce((s, r) => s + num(r.sales_amount), 0);
  const b2bProfit = b2bMonth.reduce((s, r) => s + num(r.profit_amount), 0);
  const expSales = expMonth.reduce((s, r) => s + num(r.sales_total), 0);
  const loadSales = loadMonth.reduce((s, r) => s + num(r.supply_amount), 0);
  const totalSales = b2bSales + expSales + loadSales;

  // 전체 매출(B2B + 수출 + 마트/온라인/특정)을 일자별로 합산
  const totalByDate = useMemo(() => {
    const m: Record<string, number> = {};
    const add = (d: any, v: number) => {
      const k = ymd(d);
      if (!k) return;
      m[k] = (m[k] || 0) + v;
    };
    b2b.forEach((r) => add(r.sale_date, num(r.sales_amount)));
    exp.forEach((r) => add(r.delivery_date ?? "", num(r.sales_total)));
    load.forEach((r) => add(r.load_date, num(r.supply_amount)));
    return m;
  }, [b2b, exp, load]);

  const totalByMonth = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(totalByDate).forEach(([d, v]) => {
      const k = d.slice(0, 7);
      m[k] = (m[k] || 0) + v;
    });
    return m;
  }, [totalByDate]);

  const year = Number(month.slice(0, 4));
  const mm = month.slice(5, 7);
  const prevYear = year - 1;

  // 일자별 매출: 선택한 월 vs 작년 같은 달·같은 일자
  const daily = useMemo(() => {
    const days = new Date(year, Number(mm), 0).getDate();
    const out: { day: string; 올해: number; 작년: number }[] = [];
    for (let d = 1; d <= days; d++) {
      const dd = String(d).padStart(2, "0");
      const cur = totalByDate[`${year}-${mm}-${dd}`] || 0;
      const prev = totalByDate[`${prevYear}-${mm}-${dd}`] || 0;
      if (cur || prev) out.push({ day: `${d}일`, 올해: cur, 작년: prev });
    }
    return out;
  }, [totalByDate, year, mm, prevYear]);

  // 올해 매출이 가장 높은 날 (막대를 다른 색으로 강조)
  const peakIdx = useMemo(() => {
    let idx = -1;
    let max = 0;
    daily.forEach((d, i) => {
      if (d.올해 > max) {
        max = d.올해;
        idx = i;
      }
    });
    return idx;
  }, [daily]);

  // 월별 매출 추이: 올해 1~12월 vs 작년 같은 달
  const monthly = useMemo(() => {
    const out: { month: string; 올해: number; 작년: number }[] = [];
    for (let i = 1; i <= 12; i++) {
      const k = String(i).padStart(2, "0");
      out.push({
        month: `${i}월`,
        올해: totalByMonth[`${year}-${k}`] || 0,
        작년: totalByMonth[`${prevYear}-${k}`] || 0,
      });
    }
    return out;
  }, [totalByMonth, year, prevYear]);

  // 오늘(현재일) 매출 — 구분별 + 작년 같은 날 대비
  const todayStr = ymd(new Date());
  const lastYearTodayStr = `${Number(todayStr.slice(0, 4)) - 1}${todayStr.slice(4)}`;

  const todayStats = useMemo(() => {
    const sumOn = (rows: Any[], dateField: string, valField: string, d: string) =>
      rows.reduce(
        (s, r) => (ymd(r[dateField]) === d ? s + num(r[valField]) : s),
        0
      );
    const mk = (d: string) => {
      const b = sumOn(b2b, "sale_date", "sales_amount", d);
      const e = sumOn(exp, "delivery_date", "sales_total", d);
      const l = sumOn(load, "load_date", "supply_amount", d);
      return { b2b: b, exp: e, load: l, total: b + e + l };
    };
    return { cur: mk(todayStr), prev: mk(lastYearTodayStr) };
  }, [b2b, exp, load, todayStr, lastYearTodayStr]);

  const months = useMemo(() => {
    const set = new Set<string>();
    [
      ...b2b.map((r) => monthKey(r.sale_date)),
      ...exp.map((r) => monthKey(r.delivery_date ?? "")),
      ...load.map((r) => monthKey(r.load_date)),
    ].forEach((m) => m && set.add(m));
    set.add(month);
    return Array.from(set).sort().reverse();
  }, [b2b, exp, load, month]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-sm text-slate-500">B2B · 수출 · 상차 매출 통합 현황</p>
        </div>
        <div className="flex flex-col items-end">
          <select
            className="input max-w-[160px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400 mt-1 mr-1">단위: 억원</span>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">불러오는 중...</div>
      ) : (
        <>
          {/* 선택 월 KPI — 모바일 2열에서 줄이 맞도록 총매출을 2칸 차지시킨다 */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Kpi title="총 매출 (선택 월)" value={eok(totalSales)} accent span2 />
            <Kpi title="B2B 매출" value={eok(b2bSales)} href="/b2b" />
            <Kpi title="수출 매출" value={eok(expSales)} href="/export" />
            <Kpi title="마트/온라인/특정" value={eok(loadSales)} href="/loading" />
            <Kpi title="B2B 매출이익" value={eok(b2bProfit)} href="/b2b" />
          </div>

          {/* 오늘 매출 — 총매출 라인 바로 밑, 앰버 톤으로 구분 */}
          <div className="card !bg-teal-50 !border-teal-200">
            <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-teal-900">오늘 매출</h2>
                <p className="text-[11px] text-teal-700/70 mt-0.5">
                  {todayStr} · 작년 같은 날({lastYearTodayStr}) 대비
                </p>
              </div>
              <span className="text-[11px] text-teal-700/70">단위: 백만원</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Today title="총 매출" value={todayStats.cur.total} prev={todayStats.prev.total} accent />
              <Today title="B2B 매출" value={todayStats.cur.b2b} prev={todayStats.prev.b2b} />
              <Today title="수출 매출" value={todayStats.cur.exp} prev={todayStats.prev.exp} />
              <Today title="마트/온라인/특정" value={todayStats.cur.load} prev={todayStats.prev.load} />
            </div>
          </div>

          <div className="card" style={panelStyle}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold text-slate-100">
                일자별 매출 ({month}){" "}
                <span className="text-xs font-normal text-slate-400">vs {prevYear}년 동월</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                <span style={{ color: C.amber }}>■</span> 최고 매출일 · 단위: 백만원
              </span>
            </div>
            {daily.length === 0 ? (
              <p className="text-sm text-slate-400">데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: narrow ? Math.max(360, daily.length * 56) : undefined }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={daily} barCategoryGap="22%" margin={{ top: 24, right: 8 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke={C.grid} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={axisTick}
                    axisLine={{ stroke: C.grid }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis tickFormatter={millTick} width={44} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => millTip(v)}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#cbd5e1" }}
                    cursor={{ fill: "rgba(255,255,255,0.06)" }}
                  />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                  <Bar dataKey="작년" fill={C.slate} maxBarSize={26} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="작년" position="top" formatter={millLabel} fill="#94a3b8" fontSize={10} />
                  </Bar>
                  <Bar dataKey="올해" fill={C.blue} maxBarSize={26} radius={[4, 4, 0, 0]}>
                    {daily.map((_, i) => (
                      <Cell key={i} fill={i === peakIdx ? C.amber : C.blue} />
                    ))}
                    <LabelList dataKey="올해" position="top" formatter={millLabel} fill="#e0f2fe" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={panelStyle}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold text-slate-100">
                월별 매출 추이 ({year}년){" "}
                <span className="text-xs font-normal text-slate-400">vs {prevYear}년</span>
              </h2>
              <span className="text-[11px] text-slate-400">단위: 백만원</span>
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: narrow ? 720 : undefined }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthly} margin={{ top: 26, right: 14, bottom: 6 }}>
                <CartesianGrid strokeDasharray="2 6" stroke={C.grid} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={{ stroke: C.grid }} tickLine={false} />
                <YAxis tickFormatter={millTick} width={44} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => millTip(v)}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#cbd5e1" }}
                  cursor={{ stroke: "#475569" }}
                />
                <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="작년"
                  stroke={C.slate}
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList dataKey="작년" position="bottom" formatter={millLabel} fill="#94a3b8" fontSize={10} />
                </Line>
                <Line
                  type="monotone"
                  dataKey="올해"
                  stroke={C.blue}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList dataKey="올해" position="top" formatter={millLabel} fill="#e0f2fe" fontSize={10} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 오늘 매출 타일: 금액(원) + 작년 같은 날 대비 증감률
function Today({
  title,
  value,
  prev,
  accent,
}: {
  title: string;
  value: number;
  prev: number;
  accent?: boolean;
}) {
  const diff = prev > 0 ? ((value - prev) / prev) * 100 : null;
  const up = (diff ?? 0) >= 0;
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-transparent" : "border-teal-200 bg-white"
      }`}
      style={
        accent
          ? { background: "linear-gradient(135deg,#0D9488 0%,#115E59 100%)" }
          : undefined
      }
    >
      <div
        className="text-[11px] leading-tight"
        style={{ color: accent ? "#ccfbf1" : "#0F766E" }}
      >
        {title}
      </div>
      <div
        className="mt-1.5 text-base sm:text-lg font-bold tabular-nums leading-tight break-keep"
        style={{ color: accent ? "#ffffff" : "#0f172a" }}
      >
        {mill(value)}
      </div>
      <div className="mt-1 text-[11px] tabular-nums">
        {diff === null ? (
          <span style={{ color: accent ? "#99f6e4" : "#94a3b8" }}>작년 기록 없음</span>
        ) : (
          <span style={{ color: accent ? "#ccfbf1" : up ? "#16a34a" : "#dc2626" }}>
            {up ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}%{" "}
            <span style={{ color: accent ? "#99f6e4" : "#94a3b8" }}>vs 작년</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  accent,
  href,
  span2,
}: {
  title: string;
  value: string;
  accent?: boolean;
  href?: string;
  span2?: boolean;
}) {
  const spanCls = span2 ? "col-span-2 lg:col-span-1" : "";
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="text-[11px] sm:text-xs leading-tight" style={{ color: accent ? "#e0f2fe" : "#64748b" }}>{title}</div>
        {href && <span className="text-slate-300 text-xs leading-none" style={{ color: accent ? "#e0f2fe" : "#94a3b8" }}>›</span>}
      </div>
      <div
        className="text-base sm:text-xl font-bold mt-1.5 sm:mt-2 leading-tight tabular-nums break-keep"
        style={{ color: accent ? "#ffffff" : undefined }}
      >
        {value}
      </div>
    </>
  );
  const style = accent
    ? { background: "linear-gradient(135deg,#0184CA 0%,#0A2540 100%)", borderColor: "#0A2540", color: "#ffffff" }
    : undefined;
  if (href) {
    return (
      <Link
        href={href}
        className={`card !p-4 sm:!p-5 block transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-sky-300/60 cursor-pointer ${spanCls}`}
        style={style}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className={`card !p-4 sm:!p-5 ${spanCls}`} style={style}>
      {inner}
    </div>
  );
}
