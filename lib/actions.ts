"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { signSession, verifySession, SESSION_COOKIE } from "@/lib/jwt";

// ----------------- 인증 -----------------

async function requireUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) throw new Error("로그인이 필요합니다.");
  return session;
}

async function requireAdmin() {
  const session = await requireUser();
  const rows = await sql`
    select g.level from users u
    left join grades g on g.id = u.grade_id
    where u.id = ${session.uid}`;
  if (!rows.length || Number(rows[0].level ?? 0) < 100)
    throw new Error("관리자 권한이 필요합니다.");
  return session;
}

function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function signUp(
  email: string,
  password: string,
  name?: string,
  phone?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    email = (email || "").trim().toLowerCase();
    const nm = (name || "").trim() || null;
    const ph = (phone || "").trim() || null;
    if (!email || !password) return { ok: false, error: "이메일과 비밀번호를 입력하세요." };
    if (!nm) return { ok: false, error: "이름을 입력하세요." };
    if (password.length < 6) return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };

    const existing = await sql`select id from users where email = ${email}`;
    if (existing.length) return { ok: false, error: "이미 가입된 이메일입니다." };

    // 첫 번째 가입자는 자동으로 관리자 + 승인
    const cnt = await sql`select count(*)::int as n from users`;
    const isFirst = Number(cnt[0].n) === 0;
    const gradeName = isFirst ? "관리자" : "일반";
    const g = await sql`select id from grades where name = ${gradeName} limit 1`;
    const gradeId = g.length ? g[0].id : null;

    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      insert into users (email, password_hash, grade_id, approved, name, phone)
      values (${email}, ${hash}, ${gradeId}, ${isFirst}, ${nm}, ${ph})
      returning id, email`;
    const u = rows[0];
    const token = await signSession({ uid: Number(u.id), email: u.email });
    setSessionCookie(token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: "가입 처리 중 오류가 발생했습니다: " + (e?.message ?? "") };
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    email = (email || "").trim().toLowerCase();
    const rows = await sql`select id, email, password_hash from users where email = ${email}`;
    if (!rows.length) return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    const token = await signSession({ uid: Number(rows[0].id), email: rows[0].email });
    setSessionCookie(token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: "로그인 처리 중 오류가 발생했습니다: " + (e?.message ?? "") };
  }
}

export async function signOut() {
  cookies().delete(SESSION_COOKIE);
}

// ----------------- 등급 관리 (관리자) -----------------

export async function listGrades() {
  await requireAdmin();
  return await sql`select * from grades order by level desc, id`;
}
export async function addGrade(
  name: string, level: number, can_edit: boolean, description: string | null
) {
  await requireAdmin();
  await sql`insert into grades (name, level, can_edit, description)
            values (${name}, ${level}, ${can_edit}, ${description})
            on conflict (name) do nothing`;
}
export async function updateGrade(
  id: number, name: string, level: number, can_edit: boolean, description: string | null
) {
  await requireAdmin();
  await sql`update grades set name=${name}, level=${level}, can_edit=${can_edit},
            description=${description} where id=${id}`;
}
export async function deleteGrade(id: number) {
  await requireAdmin();
  await sql`update users set grade_id = null where grade_id = ${id}`;
  await sql`delete from grades where id=${id}`;
}

// ----------------- 회원 관리 (관리자) -----------------

export async function listUsers() {
  await requireAdmin();
  return await sql`
    select u.id, u.email, u.name, u.phone, u.approved, u.grade_id, u.created_at,
           g.name as grade_name, g.level as grade_level
    from users u left join grades g on g.id = u.grade_id
    order by u.created_at`;
}
export async function listGradeOptions() {
  await requireAdmin();
  return await sql`select id, name, level from grades order by level desc`;
}
export async function setUserGrade(id: number, grade_id: number | null) {
  await requireAdmin();
  await sql`update users set grade_id=${grade_id} where id=${id}`;
}
export async function setUserApproved(id: number, approved: boolean) {
  await requireAdmin();
  await sql`update users set approved=${approved} where id=${id}`;
}
export async function deleteUser(id: number) {
  const s = await requireAdmin();
  if (Number(s.uid) === Number(id)) throw new Error("본인 계정은 삭제할 수 없습니다.");
  await sql`delete from users where id=${id}`;
}

// ----------------- 마스터: 고객사 -----------------

export async function listCustomers(kinds?: string[]) {
  await requireUser();
  if (kinds && kinds.length) {
    return await sql`select * from customers where kind = any(${kinds}) order by name`;
  }
  return await sql`select * from customers order by name`;
}
export async function addCustomer(name: string, kind: string) {
  await requireUser();
  await sql`insert into customers (name, kind) values (${name}, ${kind})
            on conflict (name, kind) do nothing`;
}
export async function deleteCustomer(id: number) {
  await requireUser();
  await sql`delete from customers where id = ${id}`;
}

// ----------------- 마스터: 국가 -----------------

export async function listCountries() {
  await requireUser();
  return await sql`select * from countries order by name`;
}
export async function addCountry(name: string) {
  await requireUser();
  await sql`insert into countries (name) values (${name}) on conflict (name) do nothing`;
}
export async function deleteCountry(id: number) {
  await requireUser();
  await sql`delete from countries where id = ${id}`;
}

// ----------------- 마스터: 품목 -----------------

export async function listProducts() {
  await requireUser();
  return await sql`select * from products order by name`;
}
export async function addProduct(erp_code: string | null, name: string, unit: string | null) {
  await requireUser();
  await sql`insert into products (erp_code, name, unit) values (${erp_code}, ${name}, ${unit})`;
}
export async function deleteProduct(id: number) {
  await requireUser();
  await sql`delete from products where id = ${id}`;
}

// ----------------- 마스터: 채널 -----------------

export async function listChannels() {
  await requireUser();
  return await sql`select * from channels order by sort_order`;
}
export async function addChannel(group_name: string | null, name: string, sort_order: number) {
  await requireUser();
  await sql`insert into channels (group_name, name, sort_order)
            values (${group_name}, ${name}, ${sort_order})
            on conflict (name) do nothing`;
}
export async function deleteChannel(id: number) {
  await requireUser();
  await sql`delete from channels where id = ${id}`;
}

// ----------------- B2B 매출 -----------------

export async function listB2bByDate(date: string) {
  await requireUser();
  return await sql`select * from b2b_sales where sale_date = ${date} order by id`;
}

// 기간(시작일~종료일) B2B 매출 조회 — 엑셀 기간 다운로드용
export async function listB2bRange(from: string, to: string) {
  await requireUser();
  return await sql`select * from b2b_sales
                   where sale_date >= ${from} and sale_date <= ${to}
                   order by sale_date, id`;
}

export async function saveB2b(
  date: string,
  rows: {
    id?: number;
    customer_id: number | null;
    customer_name: string | null;
    mfg_cost: number;
    sales_amount: number;
    profit_amount: number;
    note: string | null;
  }[]
) {
  await requireUser();
  for (const r of rows) {
    if (r.id) {
      await sql`update b2b_sales set
        customer_id=${r.customer_id}, customer_name=${r.customer_name},
        mfg_cost=${r.mfg_cost}, sales_amount=${r.sales_amount},
        profit_amount=${r.profit_amount}, note=${r.note}
        where id=${r.id}`;
    } else {
      await sql`insert into b2b_sales
        (sale_date, customer_id, customer_name, mfg_cost, sales_amount, profit_amount, note)
        values (${date}, ${r.customer_id}, ${r.customer_name}, ${r.mfg_cost},
                ${r.sales_amount}, ${r.profit_amount}, ${r.note})`;
    }
  }
}

export async function deleteB2b(id: number) {
  await requireUser();
  await sql`delete from b2b_sales where id = ${id}`;
}

// ----------------- 상차금액 -----------------

// 기간 내 상차 데이터 건수 (삭제 전 확인용)
export async function countLoadingRange(from: string, to: string) {
  await requireUser();
  const rows = (await sql`select count(*)::int as n from loading_amounts
                          where load_date >= ${from} and load_date <= ${to}`) as any[];
  return Number(rows?.[0]?.n ?? 0);
}

// 기간 내 상차 데이터 삭제 (잘못 업로드한 데이터 정리용)
export async function deleteLoadingRange(from: string, to: string) {
  await requireUser();
  await sql`delete from loading_amounts
            where load_date >= ${from} and load_date <= ${to}`;
  return { ok: true };
}

export async function listLoadingByDate(date: string) {
  await requireUser();
  return await sql`select channel_id, supply_amount from loading_amounts where load_date = ${date}`;
}

export async function saveLoading(
  date: string,
  items: { channel_id: number; channel_name: string; supply_amount: number }[]
) {
  await requireUser();
  await sql`delete from loading_amounts where load_date = ${date}`;
  for (const it of items) {
    if (!it.supply_amount) continue;
    await sql`insert into loading_amounts (load_date, channel_id, channel_name, supply_amount)
              values (${date}, ${it.channel_id}, ${it.channel_name}, ${it.supply_amount})`;
  }
}

// ----------------- 수출대장 -----------------

export async function listExportByMonth(month: string) {
  await requireUser();
  const start = month + "-01";
  const d = new Date(start);
  d.setMonth(d.getMonth() + 1);
  const end = d.toISOString().slice(0, 10);
  return await sql`select * from export_sales
    where delivery_date >= ${start} and delivery_date < ${end}
    order by delivery_date`;
}

type ExportInput = {
  id?: number;
  supply_type: string | null;
  customer_id: number | null;
  customer_name: string | null;
  country_id: number | null;
  country_name: string | null;
  delivery_date: string;
  erp_code: string | null;
  product_name: string | null;
  unit: string | null;
  sales_per_unit: number;
  qty_unit: number;
  qty_box: number;
  sales_total: number;
  mfg_cost_total: number;
  logistics_cost: number;
  exchange_rate: number;
  category: string | null;
  gov_support: string | null;
};

export async function upsertExport(r: ExportInput) {
  await requireUser();
  if (r.id) {
    await sql`update export_sales set
      supply_type=${r.supply_type}, customer_id=${r.customer_id}, customer_name=${r.customer_name},
      country_id=${r.country_id}, country_name=${r.country_name}, delivery_date=${r.delivery_date},
      erp_code=${r.erp_code}, product_name=${r.product_name}, unit=${r.unit},
      sales_per_unit=${r.sales_per_unit}, qty_unit=${r.qty_unit}, qty_box=${r.qty_box},
      sales_total=${r.sales_total}, mfg_cost_total=${r.mfg_cost_total},
      logistics_cost=${r.logistics_cost}, exchange_rate=${r.exchange_rate},
      category=${r.category}, gov_support=${r.gov_support}
      where id=${r.id}`;
  } else {
    await sql`insert into export_sales
      (supply_type, customer_id, customer_name, country_id, country_name, delivery_date,
       erp_code, product_name, unit, sales_per_unit, qty_unit, qty_box, sales_total,
       mfg_cost_total, logistics_cost, exchange_rate, category, gov_support)
      values (${r.supply_type}, ${r.customer_id}, ${r.customer_name}, ${r.country_id},
       ${r.country_name}, ${r.delivery_date}, ${r.erp_code}, ${r.product_name}, ${r.unit},
       ${r.sales_per_unit}, ${r.qty_unit}, ${r.qty_box}, ${r.sales_total},
       ${r.mfg_cost_total}, ${r.logistics_cost}, ${r.exchange_rate}, ${r.category}, ${r.gov_support})`;
  }
}

export async function deleteExport(id: number) {
  await requireUser();
  await sql`delete from export_sales where id = ${id}`;
}

// ----------------- 엑셀 대량 업로드 -----------------

export async function bulkSaveB2b(
  rows: {
    sale_date: string;
    customer_name: string;
    mfg_cost: number;
    sales_amount: number;
    profit_amount: number;
    note: string | null;
  }[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    await requireUser();
    const custs = await sql`select id, name from customers`;
    const map = new Map(custs.map((c: any) => [String(c.name).trim(), c.id]));
    let n = 0;
    for (const r of rows) {
      if (!r.sale_date) continue;
      const cid = map.get(String(r.customer_name || "").trim()) ?? null;
      await sql`insert into b2b_sales
        (sale_date, customer_id, customer_name, mfg_cost, sales_amount, profit_amount, note)
        values (${r.sale_date}, ${cid}, ${r.customer_name || null}, ${r.mfg_cost || 0},
                ${r.sales_amount || 0}, ${r.profit_amount || 0}, ${r.note || null})`;
      n++;
    }
    return { ok: true, count: n };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message ?? "업로드 실패" };
  }
}

export async function bulkSaveLoading(
  rows: { load_date: string; channel_name: string; supply_amount: number }[]
): Promise<{ ok: boolean; count: number; error?: string; skipped?: string[] }> {
  try {
    await requireUser();
    const chans = await sql`select id, name from channels`;
    const map = new Map(chans.map((c: any) => [String(c.name).trim(), c.id]));

    const valid = rows.filter((r) => r.load_date);
    // 같은 날짜를 다시 올리면 기존 데이터를 "대체"한다 (여러 번 올려도 중복 누적되지 않음)
    const dates = Array.from(new Set(valid.map((r) => r.load_date)));
    for (const d of dates) {
      await sql`delete from loading_amounts where load_date = ${d}`;
    }

    let n = 0;
    const skipped: string[] = [];
    for (const r of valid) {
      const name = String(r.channel_name || "").trim();
      const cid = map.get(name) ?? null;
      // 기준정보에 없는 채널은 건너뛴다 (화면에 안 보이는 유령 데이터 방지)
      if (cid == null) {
        if (name && !skipped.includes(name)) skipped.push(name);
        continue;
      }
      if (!r.supply_amount) continue;
      await sql`insert into loading_amounts (load_date, channel_id, channel_name, supply_amount)
                values (${r.load_date}, ${cid}, ${name}, ${r.supply_amount || 0})`;
      n++;
    }
    return { ok: true, count: n, skipped };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message ?? "업로드 실패" };
  }
}

export async function bulkSaveExport(
  rows: {
    delivery_date: string;
    supply_type: string | null;
    customer_name: string | null;
    country_name: string | null;
    erp_code: string | null;
    product_name: string | null;
    unit: string | null;
    sales_per_unit: number;
    qty_unit: number;
    qty_box: number;
    sales_total: number;
    mfg_cost_total: number;
    logistics_cost: number;
    exchange_rate: number;
    category: string | null;
    gov_support: string | null;
  }[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    await requireUser();
    const [custs, countries] = await Promise.all([
      sql`select id, name from customers`,
      sql`select id, name from countries`,
    ]);
    const cmap = new Map(custs.map((c: any) => [String(c.name).trim(), c.id]));
    const nmap = new Map(countries.map((c: any) => [String(c.name).trim(), c.id]));
    let n = 0;
    for (const r of rows) {
      if (!r.delivery_date) continue;
      const cid = cmap.get(String(r.customer_name || "").trim()) ?? null;
      const coid = nmap.get(String(r.country_name || "").trim()) ?? null;
      await sql`insert into export_sales
        (supply_type, customer_id, customer_name, country_id, country_name, delivery_date,
         erp_code, product_name, unit, sales_per_unit, qty_unit, qty_box, sales_total,
         mfg_cost_total, logistics_cost, exchange_rate, category, gov_support)
        values (${r.supply_type || null}, ${cid}, ${r.customer_name || null}, ${coid},
         ${r.country_name || null}, ${r.delivery_date}, ${r.erp_code || null}, ${r.product_name || null},
         ${r.unit || null}, ${r.sales_per_unit || 0}, ${r.qty_unit || 0}, ${r.qty_box || 0},
         ${r.sales_total || 0}, ${r.mfg_cost_total || 0}, ${r.logistics_cost || 0},
         ${r.exchange_rate || 0}, ${r.category || null}, ${r.gov_support || null})`;
      n++;
    }
    return { ok: true, count: n };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message ?? "업로드 실패" };
  }
}

// ----------------- 대시보드 -----------------

export async function dashboardData() {
  await requireUser();
  const [b2b, exp, load] = await Promise.all([
    sql`select sale_date, customer_name, sales_amount, profit_amount from b2b_sales`,
    sql`select delivery_date, customer_name, country_name, sales_total from export_sales`,
    sql`select load_date, supply_amount from loading_amounts`,
  ]);
  return { b2b, exp, load };
}
