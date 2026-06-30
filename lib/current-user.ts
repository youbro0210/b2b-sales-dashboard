import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";

// 서버 컴포넌트에서 현재 로그인 사용자 확인
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}
