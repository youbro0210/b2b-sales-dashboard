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
  ReferenceLine,
  Cell,
} from "recharts";
import { dashboardData, serverToday } from "@/lib/actions";
import { fmt, todayKST, monthKST } from "@/lib/types";

const won = (v: number, decimals = 2) => fmt(v, decimals);
// KPI 카드: 억원 단위 (소수점 2자리)
const eok = (v: number) =>
  (Number(v || 0) / 1e8).toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
// 백만원 단위 축/툴팁/막대 상단 라벨
const millTick = (v: number) => (v / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 });
const millTip = (v: number) => (v / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + " 백만원";
const millLabel = (v: any) =>
  Number(v) ? (Number(v) / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : "";
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

// 상차 채널 '구분' → 메뉴 매핑 (마트/온라인/특정 메뉴와 동일 기준)
const G_MART = ["오프라인", "롯데마트_수수료업체", "이마트_수수료업체"];
const G_ONLINE = ["온라인"];
const G_SPECIAL = ["특정"];
const inGroup = (r: Any, gs: string[]) => gs.includes(String(r.group_name ?? ""));

export default function DashboardPage() {
  const [b2b, setB2b] = useState<Any[]>([]);
  const [exp, setExp] = useState<Any[]>([]);
  const [load, setLoad] = useState<Any[]>([]);
  const [month, setMonth] = useState<string>(() => monthKST());
  const [loading, setLoading] = useState(true);
  const [specialChan, setSpecialChan] = useState<string>(""); // "" = 전체 특정 채널

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
  // 마트 / 온라인 / 특정 분리 집계
  const martSales = loadMonth
    .filter((r) => inGroup(r, G_MART))
    .reduce((s, r) => s + num(r.supply_amount), 0);
  const onlineSales = loadMonth
    .filter((r) => inGroup(r, G_ONLINE))
    .reduce((s, r) => s + num(r.supply_amount), 0);
  const specialSales = loadMonth
    .filter((r) => inGroup(r, G_SPECIAL))
    .reduce((s, r) => s + num(r.supply_amount), 0);
  const totalSales = b2bSales + expSales + loadSales;

  // 전체 매출(B2C 오프라인 + 수출 + 마트/온라인/특정)을 일자별로 합산
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

  // 전월 (선택한 월의 한 달 전) "YYYY-MM"
  const prevMonthKey = useMemo(() => {
    const m = Number(mm);
    const py = m === 1 ? year - 1 : year;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}`;
  }, [year, mm]);

  // 일자별 매출: 당월 · 전월 같은 일자 · 작년 동월 같은 일자
  const daily = useMemo(() => {
    const days = new Date(year, Number(mm), 0).getDate();
    const out: { day: string; 당월: number; 전월: number; 작년: number }[] = [];
    for (let d = 1; d <= days; d++) {
      const dd = String(d).padStart(2, "0");
      const cur = totalByDate[`${year}-${mm}-${dd}`] || 0;
      const pm = totalByDate[`${prevMonthKey}-${dd}`] || 0;
      const ly = totalByDate[`${prevYear}-${mm}-${dd}`] || 0;
      if (cur || pm || ly) out.push({ day: `${d}일`, 당월: cur, 전월: pm, 작년: ly });
    }
    return out;
  }, [totalByDate, year, mm, prevYear, prevMonthKey]);

  // 특정 채널 목록 (드롭다운용)
  const specialChannels = useMemo(() => {
    const s = new Set<string>();
    load.forEach((r) => {
      if (inGroup(r, G_SPECIAL) && r.channel_name) s.add(String(r.channel_name));
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [load]);

  // 특정 일자별 매출: 선택 채널(또는 전체) 기준 당월·전월·작년 동일자
  const specialDaily = useMemo(() => {
    const rows = load.filter(
      (r) =>
        inGroup(r, G_SPECIAL) &&
        (!specialChan || String(r.channel_name) === specialChan)
    );
    const byDate: Record<string, number> = {};
    rows.forEach((r) => {
      const k = ymd(r.load_date);
      if (k) byDate[k] = (byDate[k] || 0) + num(r.supply_amount);
    });
    const days = new Date(year, Number(mm), 0).getDate();
    const out: { day: string; 당월: number; 전월: number; 작년: number }[] = [];
    for (let d = 1; d <= days; d++) {
      const dd = String(d).padStart(2, "0");
      const cur = byDate[`${year}-${mm}-${dd}`] || 0;
      const pm = byDate[`${prevMonthKey}-${dd}`] || 0;
      const ly = byDate[`${prevYear}-${mm}-${dd}`] || 0;
      if (cur || pm || ly) out.push({ day: `${d}일`, 당월: cur, 전월: pm, 작년: ly });
    }
    return out;
  }, [load, specialChan, year, mm, prevYear, prevMonthKey]);

  // 특정 차트 단위 자동 조정: 채널별 매출 규모가 작으면(백만원 미만) 천원/원 단위로
  // 표시해, 축·라벨이 전부 "0"으로 반올림돼 그래프가 깨져 보이는 문제를 막는다.
  const specMax = useMemo(
    () => specialDaily.reduce((m, d) => Math.max(m, d.당월, d.전월, d.작년), 0),
    [specialDaily]
  );
  const specUnit = useMemo(() => {
    if (specMax >= 1e8) return { div: 1e8, name: "억원" };
    if (specMax >= 1e6) return { div: 1e6, name: "백만원" };
    if (specMax >= 1e3) return { div: 1e3, name: "천원" };
    return { div: 1, name: "원" };
  }, [specMax]);
  const specTick = (v: number) =>
    (Number(v) / specUnit.div).toLocaleString("ko-KR", {
      maximumFractionDigits: specUnit.div === 1 ? 0 : 1,
    });
  const specTip = (v: number) => specTick(v) + " " + specUnit.name;
  const specLabel = (v: any) => (Number(v) ? specTick(Number(v)) : "");

  // 당월 매출이 가장 높은 날 (막대를 다른 색으로 강조)
  const peakIdx = useMemo(() => {
    let idx = -1;
    let max = 0;
    daily.forEach((d, i) => {
      if (d.당월 > max) {
        max = d.당월;
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

  // 오늘(현재일) 매출 — 서버 시각(한국시간) 기준. 기기 시계가 틀려도 정확하다.
  const [todayStr, setTodayStr] = useState<string>(() => todayKST());
  useEffect(() => {
    serverToday()
      .then((d) => {
        if (d) {
          setTodayStr(d);
          setMonth((m) => (m === monthKST() ? d.slice(0, 7) : m));
        }
      })
      .catch(() => {});
  }, []);

  const lastYearTodayStr = `${Number(todayStr.slice(0, 4)) - 1}${todayStr.slice(4)}`;

  const todayStats = useMemo(() => {
    const sumOn = (rows: Any[], dateField: string, valField: string, d: string) =>
      rows.reduce(
        (s, r) => (ymd(r[dateField]) === d ? s + num(r[valField]) : s),
        0
      );
    const sumGroup = (d: string, gs: string[]) =>
      load.reduce(
        (s, r) =>
          ymd(r.load_date) === d && inGroup(r, gs)
            ? s + num(r.supply_amount)
            : s,
        0
      );
    const mk = (d: string) => {
      const b = sumOn(b2b, "sale_date", "sales_amount", d);
      const e = sumOn(exp, "delivery_date", "sales_total", d);
      const l = sumOn(load, "load_date", "supply_amount", d);
      return {
        b2b: b,
        exp: e,
        load: l,
        mart: sumGroup(d, G_MART),
        online: sumGroup(d, G_ONLINE),
        special: sumGroup(d, G_SPECIAL),
        total: b + e + l,
      };
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
          {/* 선택 월 KPI — 오늘 매출과 동일하게 6개 타일을 2열(모바일)/3열(데스크톱)로 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Kpi title="총 매출 (선택 월)" value={eok(totalSales)} accent />
            <Kpi title="B2B" value={eok(b2bSales)} href={`/b2b?date=${todayStr}`} />
            <Kpi title="수출 매출" value={eok(expSales)} href={`/export?month=${month}`} />
            <Kpi title="B2C 오프라인" value={eok(martSales)} href={`/loading?date=${todayStr}`} />
            <Kpi title="B2C 온라인" value={eok(onlineSales)} href={`/online?date=${todayStr}`} />
            <Kpi title="특정" value={eok(specialSales)} href={`/special?date=${todayStr}`} />
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Today title="총 매출" value={todayStats.cur.total} prev={todayStats.prev.total} accent />
              <Today
                title="B2B"
                value={todayStats.cur.b2b}
                prev={todayStats.prev.b2b}
                href={`/b2b?date=${todayStr}`}
              />
              <Today
                title="수출 매출"
                value={todayStats.cur.exp}
                prev={todayStats.prev.exp}
                href={`/export?month=${todayStr.slice(0, 7)}`}
              />
              <Today
                title="B2C 오프라인"
                value={todayStats.cur.mart}
                prev={todayStats.prev.mart}
                href={`/loading?date=${todayStr}`}
              />
              <Today
                title="B2C 온라인"
                value={todayStats.cur.online}
                prev={todayStats.prev.online}
                href={`/online?date=${todayStr}`}
              />
              <Today
                title="특정"
                value={todayStats.cur.special}
                prev={todayStats.prev.special}
                href={`/special?date=${todayStr}`}
              />
            </div>
          </div>

          <div className="card overflow-hidden min-w-0" style={panelStyle}>
            <div className="flex items-start justify-between gap-2 flex-wrap mb-4">
              <h2 className="font-semibold text-slate-100">
                일자별 매출 ({month}){" "}
                <span className="text-xs font-normal text-slate-400">
                  vs 전월({prevMonthKey}) · 작년 동월({prevYear}-{mm})
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                <span style={{ color: C.amber }}>■</span> 최고 매출일 · 단위: 백만원
              </span>
            </div>
            {daily.length === 0 ? (
              <p className="text-sm text-slate-400">데이터가 없습니다.</p>
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <div style={{ minWidth: narrow ? Math.max(360, daily.length * 62) : undefined }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={daily} barCategoryGap="8%" barGap={1} margin={{ top: 24, right: 8 }}>
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
                  <Bar dataKey="작년" fill={C.slate} maxBarSize={18} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="작년" position="top" formatter={millLabel} fill="#94a3b8" fontSize={9} />
                  </Bar>
                  <Bar dataKey="전월" fill={C.green} maxBarSize={18} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="전월" position="top" formatter={millLabel} fill="#86efac" fontSize={9} />
                  </Bar>
                  <Bar dataKey="당월" fill={C.blue} maxBarSize={18} radius={[3, 3, 0, 0]}>
                    {daily.map((_, i) => (
                      <Cell key={i} fill={i === peakIdx ? C.amber : C.blue} />
                    ))}
                    <LabelList dataKey="당월" position="top" formatter={millLabel} fill="#e0f2fe" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="card overflow-hidden min-w-0" style={panelStyle}>
            <div className="flex items-start justify-between gap-2 flex-wrap mb-4">
              <h2 className="font-semibold text-slate-100">
                월별 매출 추이 ({year}년){" "}
                <span className="text-xs font-normal text-slate-400">vs {prevYear}년</span>
              </h2>
              <span className="text-[11px] text-slate-400">단위: 백만원</span>
            </div>
            <div className="w-full max-w-full overflow-x-auto">
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
                <ReferenceLine
                  y={totalByMonth[prevMonthKey] || 0}
                  stroke={C.amber}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `지난달(${Number(prevMonthKey.slice(5, 7))}월) ${millLabel(totalByMonth[prevMonthKey] || 0)}`,
                    position: "insideTopRight",
                    fill: C.amber,
                    fontSize: 10,
                  }}
                />
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

          {/* 특정 일자별 매출 — 채널 선택(전체/개별) · 당월/전월/작년 · 단위 자동조정 · 맨 아래 배치 */}
          <div className="card overflow-hidden min-w-0" style={panelStyle}>
            <div className="flex items-start justify-between gap-2 flex-wrap mb-4">
              <h2 className="font-semibold text-slate-100">
                특정 일자별 매출 ({month}){" "}
                <span className="text-xs font-normal text-slate-400">
                  {specialChan || "전체 채널"} · vs 전월({prevMonthKey}) · 작년 동월({prevYear}-{mm}) · 단위: {specUnit.name}
                </span>
              </h2>
              <select
                className="input !py-1 !text-xs max-w-[190px] !bg-slate-800 !text-slate-100 !border-slate-600"
                value={specialChan}
                onChange={(e) => setSpecialChan(e.target.value)}
              >
                <option value="">전체 채널</option>
                {specialChannels.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {specialDaily.length === 0 ? (
              <p className="text-sm text-slate-400">
                {specialChan || "전체 채널"} · 해당 월/전월/작년에 매출 데이터가 없습니다.
              </p>
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <div style={{ minWidth: narrow ? Math.max(360, specialDaily.length * 62) : undefined }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={specialDaily} barCategoryGap="8%" barGap={1} margin={{ top: 24, right: 8 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke={C.grid} vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={axisTick}
                        axisLine={{ stroke: C.grid }}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis tickFormatter={specTick} width={44} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: number) => specTip(v)}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "#cbd5e1" }}
                        cursor={{ fill: "rgba(255,255,255,0.06)" }}
                      />
                      <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                      <Bar dataKey="작년" fill={C.slate} maxBarSize={18} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="작년" position="top" formatter={specLabel} fill="#94a3b8" fontSize={9} />
                      </Bar>
                      <Bar dataKey="전월" fill={C.green} maxBarSize={18} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="전월" position="top" formatter={specLabel} fill="#86efac" fontSize={9} />
                      </Bar>
                      <Bar dataKey="당월" fill={C.blue} maxBarSize={18} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="당월" position="top" formatter={specLabel} fill="#e0f2fe" fontSize={10} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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
  href,
}: {
  title: string;
  value: number;
  prev: number;
  accent?: boolean;
  href?: string;
}) {
  const diff = prev > 0 ? ((value - prev) / prev) * 100 : null;
  const up = (diff ?? 0) >= 0;
  const Wrap: any = href ? Link : "div";
  return (
    <Wrap
      {...(href ? { href } : {})}
      className={`rounded-xl border p-4 block ${
        href ? "transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer" : ""
      } ${accent ? "border-transparent" : "border-teal-200 bg-white"}`}
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
    </Wrap>
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
