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
  password: string
): Promise<{ ok: boolean; error?: string }> {
  email = (email || "").trim().toLowerCase();
  if (!email || !password) return { ok: false, error: "이메일과 비밀번호를 입력하세요." };
  if (password.length < 6) return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };

  const existing = await sql`select id from users where email = ${email}`;
  if (existing.length) return { ok: false, error: "이미 가입된 이메일입니다." };

  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`
    insert into users (email, password_hash) values (${email}, ${hash})
    returning id, email`;
  const u = rows[0];
  const token = await signSession({ uid: Number(u.id), email: u.email });
  setSessionCookie(token);
  return { ok: true };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  email = (email || "").trim().toLowerCase();
  const rows = await sql`select id, email, password_hash from users where email = ${email}`;
  if (!rows.length) return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  const token = await signSession({ uid: Number(rows[0].id), email: rows[0].email });
  setSessionCookie(token);
  return { ok: true };
}

export async function signOut() {
  cookies().delete(SESSION_COOKIE);
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
