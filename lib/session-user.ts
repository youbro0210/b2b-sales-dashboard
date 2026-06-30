import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";
import { sql } from "@/lib/db";

// 서버 컴포넌트에서 현재 로그인 사용자 + 등급/승인 정보를 DB 에서 조회
export async function getSessionUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const s = await verifySession(token);
  if (!s) return null;
  try {
    const rows = await sql`
      select u.id, u.email, u.approved, u.grade_id,
             g.name as grade_name, g.level as grade_level, g.can_edit
      from users u left join grades g on g.id = u.grade_id
      where u.id = ${s.uid}`;
    if (!rows.length) return null;
    const r = rows[0] as any;
    const level = Number(r.grade_level ?? 0);
    return {
      uid: Number(r.id),
      email: r.email as string,
      approved: r.approved === true,
      gradeName: (r.grade_name ?? null) as string | null,
      level,
      canEdit: r.can_edit === true,
      isAdmin: level >= 100,
    };
  } catch {
    // grades 컬럼이 아직 없거나 DB 오류 시 최소 정보로 통과
    return { uid: Number(s.uid), email: s.email, approved: true, gradeName: null, level: 0, canEdit: true, isAdmin: false };
  }
}
