"use client";

import { ReactNode } from "react";
import { todayKST } from "@/lib/types";

// 현황 화면 공통 껍데기: 제목 + 기간(시작~종료) + 필터 + 조회/엑셀 버튼.
// 실제 표/합계/페이징은 children 으로 각 현황이 채운다.
export default function ReportShell({
  title,
  from,
  to,
  setFrom,
  setTo,
  onSearch,
  onDownload,
  loading,
  count,
  extraFilter,
  children,
}: {
  title: string;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  onSearch: () => void;
  onDownload: () => void;
  loading: boolean;
  count: number;
  extraFilter?: ReactNode;
  children: ReactNode;
}) {
  const preset = (kind: "today" | "month" | "prevMonth") => {
    const t = todayKST();
    if (kind === "today") {
      setFrom(t);
      setTo(t);
    } else if (kind === "month") {
      setFrom(t.slice(0, 8) + "01");
      setTo(t);
    } else {
      const y = Number(t.slice(0, 4));
      const m = Number(t.slice(5, 7));
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const mk = `${py}-${String(pm).padStart(2, "0")}`;
      const last = new Date(py, pm, 0).getDate();
      setFrom(`${mk}-01`);
      setTo(`${mk}-${String(last).padStart(2, "0")}`);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{title} 현황</h1>
        <p className="text-sm text-slate-500">기간·고객사별 조회 · 조회 전용(수정 불가)</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            className="input max-w-[150px]"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-xs text-slate-500">~</span>
          <input
            type="date"
            className="input max-w-[150px]"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {extraFilter}
          <button className="btn-primary whitespace-nowrap" onClick={onSearch} disabled={loading}>
            {loading ? "조회 중..." : "🔍 조회"}
          </button>
          <button className="btn-ghost whitespace-nowrap" onClick={onDownload}>
            ⬇ 엑셀 다운로드
          </button>
          <span className="text-slate-300 px-0.5">|</span>
          <button className="btn-ghost !py-1 !px-2 !text-xs" onClick={() => preset("today")}>오늘</button>
          <button className="btn-ghost !py-1 !px-2 !text-xs" onClick={() => preset("month")}>이번 달</button>
          <button className="btn-ghost !py-1 !px-2 !text-xs" onClick={() => preset("prevMonth")}>지난 달</button>
          <span className="ml-auto text-sm text-slate-500">{count}건</span>
        </div>
      </div>

      {children}
    </div>
  );
}
