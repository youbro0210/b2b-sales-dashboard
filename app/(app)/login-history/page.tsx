"use client";

import { useCallback, useState } from "react";
import { listLoginHistory, invalidateAllSessions, signOut } from "@/lib/actions";
import { todayKST } from "@/lib/types";

const PAGE = 20;

function fmtDateTime(v: any): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  // 한국시간으로 표시
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export default function LoginHistoryPage() {
  const today = todayKST();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  // 모든 기기·모든 사용자 강제 로그아웃 (세션 발급 기준시각 갱신)
  async function logoutAll() {
    if (
      !confirm(
        "모든 사용자를 모든 기기에서 로그아웃합니다.\n본인도 로그아웃되어 다시 로그인해야 합니다. 계속할까요?"
      )
    )
      return;
    setBusy(true);
    try {
      await invalidateAllSessions();
      await signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  const fetchRows = useCallback(
    async (p: number) => {
      if (from > to) return;
      setLoading(true);
      const res: any = await listLoginHistory(p, PAGE, from, to);
      setRows(res?.rows ?? []);
      setTotal(Number(res?.total ?? 0));
      setPage(p);
      setSearched(true);
      setLoading(false);
    },
    [from, to]
  );

  // 조회 버튼으로만 조회
  const pageCount = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">로그인 이력</h1>
          <p className="text-sm text-slate-500">회원 로그인 기록 조회 (관리자 전용)</p>
        </div>
        <button
          className="btn-ghost border border-red-200 text-red-600 hover:bg-red-50 whitespace-nowrap"
          onClick={logoutAll}
          disabled={busy}
        >
          {busy ? "처리 중..." : "🔒 전체 로그아웃"}
        </button>
      </div>

      <div className="card">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">시작일</label>
            <input
              type="date"
              className="input max-w-[160px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">종료일</label>
            <input
              type="date"
              className="input max-w-[160px]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            className="btn-primary whitespace-nowrap"
            onClick={() => fetchRows(0)}
            disabled={loading}
          >
            {loading ? "조회 중..." : "🔍 조회"}
          </button>
          {searched && (
            <span className="ml-auto text-sm text-slate-500">
              총 <b className="text-slate-800">{total.toLocaleString("ko-KR")}</b> 건
            </span>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : !searched ? (
          <p className="text-center text-slate-400 py-6">🔍 조회 버튼을 눌러 조회하세요.</p>
        ) : (
          <>
            <table className="data celled">
              <thead>
                <tr>
                  <th style={{ minWidth: 60 }}>No</th>
                  <th style={{ minWidth: 180 }}>이메일</th>
                  <th>이름</th>
                  <th>IP</th>
                  <th style={{ minWidth: 170 }}>로그인 일시</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-slate-500">{total - page * PAGE - i}</td>
                    <td>{r.email}</td>
                    <td>{r.user_name ?? ""}</td>
                    <td className="text-slate-500 tabular-nums">{r.ip ?? ""}</td>
                    <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.logged_in_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > PAGE && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                <button
                  className="btn-ghost !py-1 !px-3"
                  disabled={page === 0}
                  onClick={() => fetchRows(page - 1)}
                >
                  이전
                </button>
                <span className="text-slate-500">
                  {page + 1} / {pageCount}
                </span>
                <button
                  className="btn-ghost !py-1 !px-3"
                  disabled={page >= pageCount - 1}
                  onClick={() => fetchRows(page + 1)}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
