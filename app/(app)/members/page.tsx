"use client";

import { useEffect, useState } from "react";
import {
  listUsers,
  listGradeOptions,
  setUserGrade,
  setUserApproved,
  deleteUser,
} from "@/lib/actions";
import { ymd } from "@/lib/types";

type Grade = { id: number; name: string; level: number };

export default function MembersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [u, g] = await Promise.all([listUsers(), listGradeOptions()]);
      setRows(u as any[]);
      setGrades(g as Grade[]);
    } catch (e: any) {
      setErr(e?.message ?? "불러오기 실패");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const changeGrade = async (id: number, gid: string) => {
    await setUserGrade(id, gid ? Number(gid) : null);
    load();
  };
  const toggleApprove = async (id: number, approved: boolean) => {
    await setUserApproved(id, !approved);
    load();
  };
  const remove = async (id: number) => {
    if (!confirm("이 회원을 삭제할까요?")) return;
    try {
      await deleteUser(id);
      load();
    } catch (e: any) {
      alert(e?.message ?? "삭제 실패");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">회원관리</h1>
        <p className="text-sm text-slate-500">가입 회원 승인 · 등급 지정 · 삭제</p>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>이름</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th>등급</th>
                <th>승인상태</th>
                <th>가입일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-6">
                    회원이 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name ?? "-"}</td>
                  <td className="whitespace-nowrap">{r.phone ?? "-"}</td>
                  <td>{r.email}</td>
                  <td>
                    <select
                      className="input max-w-[140px]"
                      value={r.grade_id ?? ""}
                      onChange={(e) => changeGrade(r.id, e.target.value)}
                    >
                      <option value="">— 미지정 —</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {r.approved ? (
                      <span className="text-green-600 font-medium">승인됨</span>
                    ) : (
                      <span className="text-amber-600 font-medium">대기</span>
                    )}
                  </td>
                  <td className="text-slate-500">
                    {ymd(r.created_at)}
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      className="btn-ghost mr-2 py-1 px-3 text-xs"
                      onClick={() => toggleApprove(r.id, r.approved)}
                    >
                      {r.approved ? "승인취소" : "승인"}
                    </button>
                    <button
                      className="text-red-500 text-sm"
                      onClick={() => remove(r.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400">
        ※ 첫 가입자는 자동으로 관리자(승인됨)로 설정됩니다. 이후 가입자는 “대기” 상태이며 관리자가 승인해야 데이터에 접근할 수 있습니다.
      </p>
    </div>
  );
}
