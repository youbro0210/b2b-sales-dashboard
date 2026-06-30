import { neon } from "@neondatabase/serverless";

// Neon HTTP 드라이버 — 서버리스(Vercel) 환경에 적합.
// 사용: const rows = await sql`select * from customers`;
export const sql = neon(process.env.DATABASE_URL!);
