"use client";

import { useEffect, useState } from "react";
import { listGrades, addGrade, updateGrade, deleteGrade } from "@/lib/actions";

type Grade = {
  id: number;
  name: string;
  level: number;
  can_edit: boolean;
  description: string | null;
};

export default function GradesPage() {
  const [rows, setRows] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [level, setLevel] = useState(10);
  const [canEdit, setCanEdit] = useState(true);
  const [desc, setDesc] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      setRows((await listGrades()) as Grade[]);
    } catch (e: any) {
      setErr(e?.message ?? "불러오기 실패");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    await addGrade(name.trim(), Number(level), canEdit, desc.trim() || null);
    setName("");
    setLevel(10);
    setCanEdit(true);
    setDesc("");
    load();
  };
  const save = async (g: Grade) => {
    await updateGrade(g.id, g.name, Number(g.level), g.can_edit, g.description);
    load();
  };
  const remove = async (id: number) => {
    if (!confirm("이 등급을 삭제할까요? (해당 등급 회원은 미지정으로 바뀝니다)")) return;
    await deleteGrade(id);
    load();
  };
  const patch = (id: number, p: Partial<Grade>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">등급관리</h1>
        <p className="text-sm text-slate-500">
          권한 등급 정의 (레벨이 높을수록 상위 권한, 100 이상은 관리자)
        </p>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="card">
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label">등급명</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">레벨</label>
            <input type="number" className="input" value={level}
              onChange={(e) => setLevel(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">편집권한</label>
            <select className="input" value={canEdit ? "1" : "0"}
              onChange={(e) => setCanEdit(e.target.value === "1")}>
              <option value="1">편집 가능</option>
              <option value="0">조회 전용</option>
            </select>
          </div>
          <div>
            <label className="label">설명</label>
            <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={add}>등급 추가</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>등급명</th>
                <th className="text-right">레벨</th>
                <th>편집권한</th>
                <th>설명</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>
                    <input className="input" value={g.name}
                      onChange={(e) => patch(g.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" className="input text-right max-w-[90px]" value={g.level}
                      onChange={(e) => patch(g.id, { level: Number(e.target.value) })} />
                  </td>
                  <td>
                    <select className="input max-w-[130px]" value={g.can_edit ? "1" : "0"}
                      onChange={(e) => patch(g.id, { can_edit: e.target.value === "1" })}>
                      <option value="1">편집 가능</option>
                      <option value="0">조회 전용</option>
                    </select>
                  </td>
                  <td>
                    <input className="input" value={g.description ?? ""}
                      onChange={(e) => patch(g.id, { description: e.target.value })} />
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="btn-ghost py-1 px-3 text-xs mr-2" onClick={() => save(g)}>저장</button>
                    <button className="text-red-500 text-sm" onClick={() => remove(g.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
