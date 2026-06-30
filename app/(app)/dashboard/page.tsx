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

const won = (v: number) => fmt(Math.round(v));
const monthKey = (d: string) => (d ? String(d).slice(0, 7) : "");
const num = (v: any) => Number(v ?? 0);

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
      const d = String(date).slice(0, 10);
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

  const byCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    b2bMonth.forEach((r) => {
      const n = r.customer_name || "(미지정)";
      map[n] = (map[n] || 0) + num(r.sales_amount);
    });
    expMonth.forEach((r) => {
      const n = r.customer_name || "(미지정)";
      map[n] = (map[n] || 0) + num(r.sales_total);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [b2bMonth, expMonth]);

  const byCountry = useMemo(() => {
    const map: Record<string, number> = {};
    expMonth.forEach((r) => {
      const n = r.country_name || "(미지정)";
      map[n] = (map[n] || 0) + num(r.sales_total);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expMonth]);

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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi title="총 매출 (선택 월)" value={won(totalSales)} accent />
            <Kpi title="B2B 매출" value={won(b2bSales)} />
            <Kpi title="수출 매출" value={won(expSales)} />
            <Kpi title="상차 공급가액" value={won(loadSales)} />
            <Kpi title="B2B 매출이익" value={won(b2bProfit)} />
          </div>

          <div className="card">
            <h2 className="font-semibold mb-4">일자별 매출 ({month})</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={12} />
                <Tooltip formatter={(v: number) => won(v) + " 원"} />
                <Legend />
                <Bar dataKey="B2B" stackId="a" fill="#3b82f6" />
                <Bar dataKey="수출" stackId="a" fill="#10b981" />
                <Bar dataKey="상차" stackId="a" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 className="font-semibold mb-4">월별 매출 추이 (전체)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={12} />
                <Tooltip formatter={(v: number) => won(v) + " 원"} />
                <Legend />
                <Line type="monotone" dataKey="B2B" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="수출" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="상차" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold mb-4">거랜첸별 매출 TOP 10 ({month})</h2>
              {byCustomer.length === 0 ? (
                <p className="text-sm text-slate-400">데이터가 없습니다.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={byCustomer} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip formatter={(v: number) => won(v) + " 원"} />
                    <Bar dataKey="value" fill="#1e40af" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 className="font-semibold mb-4">수출 국가별 매출 ({month})</h2>
              {byCountry.length === 0 ? (
                <p className="text-sm text-slate-400">데이터가 없습니다.</p>
              ) : (
                <table className="data">
                  <thead>
                    <tr><th>국가</th><th className="text-right">매출액</th></tr>
                  </thead>
                  <tbody>
                    {byCountry.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className="text-right">{won(c.value)} 원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className={`card ${accent ? "bg-brand text-white border-brand" : ""}`}>
      <div className={`text-xs ${accent ? "text-blue-100" : "text-slate-500"}`}>{title}</div>
      <div className="text-xl font-bold mt-2">{value}</div>
      <div className={`text-xs mt-1 ${accent ? "text-blue-100" : "text-slate-400"}`}>원</div>
    </div>
  );
}
