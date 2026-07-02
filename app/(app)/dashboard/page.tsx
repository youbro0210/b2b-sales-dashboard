"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "recharts";
import { dashboardData } from "@/lib/actions";
import { fmt } from "@/lib/types";

const won = (v: number, decimals = 2) => fmt(v, decimals);
// 차트 축(만 단위)도 천단위 구분자 표시
const manTick = (v: number) => `${Math.round(v / 10000).toLocaleString("ko-KR")}만`;
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

  const daily = useMemo(() => {
    const map: Record<string, { date: string; B2B: number; 수출: number; 상차: number }> = {};
    const add = (date: string, key: "B2B" | "수출" | "상차", v: number) => {
      const d = ymd(date);
      if (!d) return;
      map[d] = map[d] || { date: d, B2B: 0, 수출: 0, 상차: 0 };
      map[d][key] += v;
    };
    b2bMonth.forEach((r) => add(r.sale_date, "B2B", num(r.sales_amount)));
    expMonth.forEach((r) => add(r.delivery_date ?? "", "수출", num(r.sales_total)));
    loadMonth.forEach((r) => add(r.load_date, "상차", num(r.supply_amount)));
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, day: d.date.slice(8, 10) + "일" }));
  }, [b2bMonth, expMonth, loadMonth]);

  const monthly = useMemo(() => {
    const map: Record<string, { month: string; B2B: number; 수출: number; 상차: number }> = {};
    const add = (date: string, key: "B2B" | "수출" | "상차", v: number) => {
      const m = monthKey(date);
      if (!m) return;
      map[m] = map[m] || { month: m, B2B: 0, 수출: 0, 상차: 0 };
      map[m][key] += v;
    };
    b2b.forEach((r) => add(r.sale_date, "B2B", num(r.sales_amount)));
    exp.forEach((r) => add(r.delivery_date ?? "", "수출", num(r.sales_total)));
    load.forEach((r) => add(r.load_date, "상차", num(r.supply_amount)));
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [b2b, exp, load]);

  // 거래처별 매출은 B2B 매출 데이터 기준
  const byCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    b2bMonth.forEach((r) => {
      const n = r.customer_name || "(미지정)";
      map[n] = (map[n] || 0) + num(r.sales_amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [b2bMonth]);

  // 수출 국가별 매출 (국가 > 업체(거래처) 세부 내역)
  const byCountry = useMemo(() => {
    const map: Record<string, { total: number; custs: Record<string, number> }> = {};
    expMonth.forEach((r) => {
      const v = num(r.sales_total);
      if (!v) return;
      const country = r.country_name || "(미지정)";
      const cust = r.customer_name || "(미지정)";
      map[country] = map[country] || { total: 0, custs: {} };
      map[country].total += v;
      map[country].custs[cust] = (map[country].custs[cust] || 0) + v;
    });
    return Object.entries(map)
      .map(([country, o]) => ({
        country,
        total: o.total,
        customers: Object.entries(o.custs)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.total - a.total);
  }, [expMonth]);

  // 일자별 거래처·품목·판매금액 TOP 10 (B2B + 수출 개별 매출)
  const topSales = useMemo(() => {
    const rows: { date: string; type: string; customer: string; product: string; amount: number; yen: boolean }[] = [];
    b2bMonth.forEach((r) =>
      rows.push({ date: ymd(r.sale_date), type: "B2B", customer: r.customer_name || "(미지정)", product: "-", amount: num(r.sales_amount), yen: false })
    );
    expMonth.forEach((r) =>
      rows.push({ date: ymd(r.delivery_date), type: "수출", customer: r.customer_name || "(미지정)", product: r.product_name || "-", amount: num(r.sales_total), yen: r.country_name === "일본" })
    );
    return rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [b2bMonth, expMonth]);

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
        <select
          className="input max-w-[160px]"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-slate-500">불러오는 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Kpi title="총 매출 (선택 월)" value={won(totalSales)} accent />
            <Kpi title="B2B 매출" value={won(b2bSales)} />
            <Kpi title="수출 매출" value={won(expSales)} />
            <Kpi title="마트/온라인/특정" value={won(loadSales)} />
            <Kpi title="B2B 매출이익" value={won(b2bProfit)} />
          </div>

          <div className="card" style={panelStyle}>
            <h2 className="font-semibold mb-4 text-slate-100">일자별 매출 ({month})</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily} barCategoryGap="28%" margin={{ top: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="2 6" stroke={C.grid} vertical={false} />
                <XAxis dataKey="day" tick={axisTick} axisLine={{ stroke: C.grid }} tickLine={false} />
                <YAxis tickFormatter={manTick} width={52} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => won(v) + " 원"}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#cbd5e1" }}
                  cursor={{ fill: "rgba(255,255,255,0.06)" }}
                />
                <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                <Bar dataKey="B2B" stackId="a" fill={C.blue} maxBarSize={44} />
                <Bar dataKey="수출" stackId="a" fill={C.green} maxBarSize={44} />
                <Bar dataKey="상차" name="마트/온라인/특정" stackId="a" fill={C.amber} maxBarSize={44} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={panelStyle}>
            <h2 className="font-semibold mb-4 text-slate-100">월별 매출 추이 (전체)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly} margin={{ top: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="2 6" stroke={C.grid} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={{ stroke: C.grid }} tickLine={false} />
                <YAxis tickFormatter={manTick} width={52} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => won(v) + " 원"}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#cbd5e1" }}
                  cursor={{ stroke: "#475569" }}
                />
                <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                <Line type="monotone" dataKey="B2B" stroke={C.blue} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="수출" stroke={C.green} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="상차" name="마트/온라인/특정" stroke={C.amber} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card" style={panelStyle}>
              <h2 className="font-semibold mb-4 text-slate-100">B2B 거래처별 매출 TOP 10 ({month})</h2>
              {byCustomer.length === 0 ? (
                <p className="text-sm text-slate-400">데이터가 없습니다.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={byCustomer} layout="vertical" margin={{ left: 4, right: 12 }} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="2 6" stroke={C.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={manTick} tick={{ fill: C.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fill: "#cbd5e1", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <Tooltip
                      formatter={(v: number) => won(v) + " 원"}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#cbd5e1" }}
                      cursor={{ fill: "rgba(255,255,255,0.06)" }}
                    />
                    <Bar dataKey="value" fill={C.blue} radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card" style={panelStyle}>
              <h2 className="font-semibold mb-1 text-slate-100">수출 국가별 매출 ({month})</h2>
              <p className="text-[11px] text-slate-400 mb-4">국가별 매출과 거래 업체 내역</p>
              {byCountry.length === 0 ? (
                <p className="text-sm text-slate-400">데이터가 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {byCountry.map((c) => {
                    const max = byCountry[0].total || 1;
                    const dp = c.country === "일본" ? 4 : 2;
                    return (
                      <div key={c.country}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-100">🌏 {c.country}</span>
                          <span className="text-sm font-bold tabular-nums text-emerald-300">{won(c.total, dp)} 원</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(4, (c.total / max) * 100)}%`, background: C.green }}
                          />
                        </div>
                        <div className="mt-2 space-y-1">
                          {c.customers.map((cu) => (
                            <div key={cu.name} className="flex items-center justify-between pl-3 text-xs">
                              <span className="text-slate-300">↳ {cu.name}</span>
                              <span className="tabular-nums text-slate-200">{won(cu.value, dp)} 원</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={panelStyle}>
            <h2 className="font-semibold mb-1 text-slate-100">일자별 판매 TOP 10 ({month})</h2>
            <p className="text-[11px] text-slate-400 mb-4">거래처 · 품목별 판매금액 상위 10건 (B2B · 수출)</p>
            {topSales.length === 0 ? (
              <p className="text-sm text-slate-400">데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-700">
                      <th className="text-left py-2 pr-3 font-medium">일자</th>
                      <th className="text-left py-2 pr-3 font-medium">구분</th>
                      <th className="text-left py-2 pr-3 font-medium">거래처</th>
                      <th className="text-left py-2 pr-3 font-medium">품목</th>
                      <th className="text-right py-2 font-medium">판매금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSales.map((r, i) => (
                      <tr key={i} className="border-b border-slate-800/70">
                        <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3">
                          <span
                            className="px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap"
                            style={{
                              background: r.type === "수출" ? "rgba(52,211,153,0.15)" : "rgba(56,189,248,0.15)",
                              color: r.type === "수출" ? "#6ee7b7" : "#7dd3fc",
                            }}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-100">{r.customer}</td>
                        <td className="py-2 pr-3 text-slate-300">{r.product}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-slate-100 whitespace-nowrap">
                          {won(r.amount, r.yen ? 4 : 2)} 원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div
      className="card !p-4 sm:!p-5"
      style={
        accent
          ? { background: "linear-gradient(135deg,#0184CA 0%,#0A2540 100%)", borderColor: "#0A2540", color: "#ffffff" }
          : undefined
      }
    >
      <div className="text-[11px] sm:text-xs leading-tight" style={{ color: accent ? "#e0f2fe" : "#64748b" }}>{title}</div>
      <div
        className="text-base sm:text-xl font-bold mt-1.5 sm:mt-2 leading-tight tabular-nums break-keep"
        style={{ color: accent ? "#ffffff" : undefined }}
      >
        {value}
      </div>
      <div className="text-[11px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: accent ? "#dbeafe" : "#94a3b8" }}>원</div>
    </div>
  );
}
