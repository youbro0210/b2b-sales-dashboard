"use client";

import { useEffect, useState } from "react";
import {
  listCustomers, addCustomer, deleteCustomer,
  listCountries, addCountry, deleteCountry,
  listProducts, addProduct, deleteProduct,
  listChannels, addChannel, deleteChannel,
} from "@/lib/actions";

// 새로 추가한 항목이 맨 위에 보이도록 id 내림차순 정렬
const byNewest = (d: any[]) => [...d].sort((a, b) => Number(b.id) - Number(a.id));

type Tab = "customers" | "countries" | "products" | "channels";
const tabs: { key: Tab; label: string }[] = [
  { key: "customers", label: "고객사" },
  { key: "countries", label: "수출국가" },
  { key: "products", label: "품목 (ERP)" },
  { key: "channels", label: "상차 채널" },
];

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>("customers");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">기준정보 관리</h1>
        <p className="text-sm text-slate-500">고객사 · 수출국가 · ERP/품명 · 상차 채널</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`btn ${tab === t.key ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "customers" && <Customers />}
      {tab === "countries" && <Countries />}
      {tab === "products" && <Products />}
      {tab === "channels" && <Channels />}
    </div>
  );
}

function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("b2b");
  const load = () => listCustomers().then((d) => setRows(byNewest(d as any[])));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; await addCustomer(name.trim(), kind); setName(""); load(); };
  const del = async (id: number) => { if (confirm("삭제할까요?")) { await deleteCustomer(id); load(); } };
  return (
    <Section form={
      <>
        <input className="input flex-1" placeholder="고객사명" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input max-w-[140px]" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="b2b">B2C 온라인</option>
          <option value="export">수출</option>
          <option value="both">공용</option>
        </select>
        <button className="btn-primary" onClick={add}>추가</button>
      </>
    }>
      <table className="data">
        <thead><tr><th>고객사명</th><th>구분</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.kind === "b2b" ? "B2C 온라인" : r.kind === "export" ? "수출" : "공용"}</td>
              <td><button className="text-red-500 text-sm" onClick={() => del(r.id)}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function Countries() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const load = () => listCountries().then((d) => setRows(byNewest(d as any[])));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; await addCountry(name.trim()); setName(""); load(); };
  const del = async (id: number) => { if (confirm("삭제할까요?")) { await deleteCountry(id); load(); } };
  return (
    <Section form={<><input className="input flex-1" placeholder="국가명" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" onClick={add}>추가</button></>}>
      <table className="data">
        <thead><tr><th>국가명</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (<tr key={r.id}><td>{r.name}</td><td><button className="text-red-500 text-sm" onClick={() => del(r.id)}>삭제</button></td></tr>))}</tbody>
      </table>
    </Section>
  );
}

function Products() {
  const [rows, setRows] = useState<any[]>([]);
  const [erp, setErp] = useState(""); const [name, setName] = useState(""); const [unit, setUnit] = useState("");
  const load = () => listProducts().then((d) => setRows(byNewest(d as any[])));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; await addProduct(erp.trim() || null, name.trim(), unit.trim() || null); setErp(""); setName(""); setUnit(""); load(); };
  const del = async (id: number) => { if (confirm("삭제할까요?")) { await deleteProduct(id); load(); } };
  return (
    <Section form={
      <>
        <input className="input max-w-[200px]" placeholder="ERP CODE" value={erp} onChange={(e) => setErp(e.target.value)} />
        <input className="input flex-1" placeholder="품명" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input max-w-[100px]" placeholder="단위" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <button className="btn-primary" onClick={add}>추가</button>
      </>
    }>
      <table className="data">
        <thead><tr><th>ERP CODE</th><th>품명</th><th>단위</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (<tr key={r.id}><td className="text-xs text-slate-500">{r.erp_code}</td><td>{r.name}</td><td>{r.unit}</td><td><button className="text-red-500 text-sm" onClick={() => del(r.id)}>삭제</button></td></tr>))}</tbody>
      </table>
    </Section>
  );
}

function Channels() {
  const [rows, setRows] = useState<any[]>([]);
  const [grp, setGrp] = useState(""); const [name, setName] = useState("");
  const load = () => listChannels().then((d) => setRows(byNewest(d as any[])));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim()) return;
    const order = rows.length ? Math.max(...rows.map((r) => Number(r.sort_order))) + 1 : 0;
    await addChannel(grp.trim() || null, name.trim(), order); setName(""); load();
  };
  const del = async (id: number) => { if (confirm("삭제할까요?")) { await deleteChannel(id); load(); } };
  return (
    <Section form={
      <>
        <input className="input max-w-[160px]" placeholder="구분(그룹)" value={grp} onChange={(e) => setGrp(e.target.value)} />
        <input className="input flex-1" placeholder="채널명" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={add}>추가</button>
      </>
    }>
      <table className="data">
        <thead><tr><th>구분</th><th>채널명</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (<tr key={r.id}><td className="text-slate-500">{r.group_name}</td><td>{r.name}</td><td><button className="text-red-500 text-sm" onClick={() => del(r.id)}>삭제</button></td></tr>))}</tbody>
      </table>
    </Section>
  );
}

function Section({ form, children }: { form: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="card"><div className="flex gap-2 items-center flex-wrap">{form}</div></div>
      <div className="card overflow-x-auto">{children}</div>
    </>
  );
}
