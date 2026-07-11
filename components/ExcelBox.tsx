"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { bulkSaveB2b, bulkSaveLoading, bulkSaveExport } from "@/lib/actions";
import { todayKST } from "@/lib/types";

type Kind = "b2b" | "loading" | "export";

const TEMPLATES: Record<Kind, { file: string; headers: string[]; example: any[] }> = {
  b2b: {
    file: "B2B매출_업로드양식.xlsx",
    headers: ["일자", "고객사명", "제조원가", "매출액", "매출이익액", "비고"],
    example: ["2026-06-01", "(주)푸디슨", 100000, 150000, 50000, ""],
  },
  loading: {
    file: "상차금액_업로드양식.xlsx",
    headers: ["일자", "구분", "채널명", "공급가액"],
    example: ["2026-06-01", "오프라인", "코스트코", 1000000],
  },
  export: {
    file: "수출대장_업로드양식.xlsx",
    headers: [
      "납기일", "공급구분", "고객사명", "수출국가", "ERP CODE", "품명", "단위",
      "매출액/단위", "수량(단위)", "수량(박스)", "매출 계", "제조원가 계", "물류비",
      "환율", "대분류", "정부지원사업",
    ],
    example: [
      "2026-06-08", "직접", "울타리", "미국", "A001GA0411000003", "(냉동)광어회 밀키트",
      "354", 5000, 100, 10, 500000, 300000, 20000, 1350, "밀키트", "",
    ],
  },
};

const num = (v: any) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
};

function toDate(v: any): string {
  if (!v && v !== 0) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim().replace(/\./g, "-").replace(/\//g, "-");
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s.slice(0, 10);
}

export default function ExcelBox({
  kind,
  onDone,
  getExport,
  exportName,
  getTemplateRows,
  getRangeExport,
  rangeExportName,
}: {
  kind: Kind;
  onDone?: () => void;
  getExport?: () => any[][];
  exportName?: string;
  // 양식 다운로드 시 예시 1줄 대신 미리 채워진 행들을 내려줌 (예: 전체 채널)
  getTemplateRows?: () => any[][];
  // 기간 데이터 다운로드 (시작일~종료일)
  getRangeExport?: (from: string, to: string) => Promise<any[][]>;
  rangeExportName?: (from: string, to: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const today = todayKST();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);

  const downloadTemplate = () => {
    const t = TEMPLATES[kind];
    const rows = getTemplateRows ? getTemplateRows() : [t.example];
    const ws = XLSX.utils.aoa_to_sheet([t.headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "양식");
    XLSX.writeFile(wb, t.file);
  };

  const downloadRange = async () => {
    if (!getRangeExport) return;
    if (from > to) {
      setMsg("시작일이 종료일보다 늦습니다.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const aoa = await getRangeExport(from, to);
      if (!aoa || aoa.length <= 1) {
        setMsg("해당 기간에 데이터가 없습니다.");
      } else {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "데이터");
        XLSX.writeFile(
          wb,
          rangeExportName ? rangeExportName(from, to) : `데이터_${from}_${to}.xlsx`
        );
        setMsg(`${aoa.length - 1}건 다운로드`);
      }
    } catch (err: any) {
      setMsg("다운로드 오류: " + (err?.message ?? ""));
    }
    setBusy(false);
  };

  const downloadData = () => {
    if (!getExport) return;
    const aoa = getExport();
    if (!aoa || aoa.length <= 1) {
      setMsg("다운로드할 데이터가 없습니다.");
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "데이터");
    XLSX.writeFile(wb, exportName || TEMPLATES[kind].file.replace("_업로드양식", "_데이터"));
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      let res: { ok: boolean; count: number; error?: string; skipped?: string[] };
      if (kind === "b2b") {
        const rows = json
          .map((r) => ({
            sale_date: toDate(r["일자"]),
            customer_name: String(r["고객사명"] ?? "").trim(),
            mfg_cost: num(r["제조원가"]),
            sales_amount: num(r["매출액"]),
            profit_amount: num(r["매출이익액"]),
            note: String(r["비고"] ?? "").trim() || null,
          }))
          .filter((r) => r.sale_date);
        res = await bulkSaveB2b(rows);
      } else if (kind === "loading") {
        const rows = json
          .map((r) => ({
            load_date: toDate(r["일자"]),
            channel_name: String(r["채널명"] ?? "").trim(),
            supply_amount: num(r["공급가액"]),
          }))
          .filter((r) => r.load_date);
        res = await bulkSaveLoading(rows);
      } else {
        const rows = json
          .map((r) => ({
            delivery_date: toDate(r["납기일"]),
            supply_type: String(r["공급구분"] ?? "").trim() || null,
            customer_name: String(r["고객사명"] ?? "").trim() || null,
            country_name: String(r["수출국가"] ?? "").trim() || null,
            erp_code: String(r["ERP CODE"] ?? "").trim() || null,
            product_name: String(r["품명"] ?? "").trim() || null,
            unit: String(r["단위"] ?? "").trim() || null,
            sales_per_unit: num(r["매출액/단위"]),
            qty_unit: num(r["수량(단위)"]),
            qty_box: num(r["수량(박스)"]),
            sales_total: num(r["매출 계"]),
            mfg_cost_total: num(r["제조원가 계"]),
            logistics_cost: num(r["물류비"]),
            exchange_rate: num(r["환율"]),
            category: String(r["대분류"] ?? "").trim() || null,
            gov_support: String(r["정부지원사업"] ?? "").trim() || null,
          }))
          .filter((r) => r.delivery_date);
        res = await bulkSaveExport(rows);
      }

      if (res.ok) {
        const skipped = res.skipped ?? [];
        setMsg(
          `${res.count}건 업로드 완료` +
            (skipped.length
              ? ` · 기준정보에 없는 채널 ${skipped.length}개 제외 (${skipped.join(", ")})`
              : "")
        );
        onDone?.();
      } else {
        setMsg("실패: " + (res.error ?? ""));
      }
    } catch (err: any) {
      setMsg("파일 읽기 오류: " + (err?.message ?? ""));
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto whitespace-nowrap">
      <button className="btn-ghost shrink-0" onClick={downloadTemplate}>
        📄 양식 다운로드
      </button>
      <button
        className="btn-ghost shrink-0"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy ? "업로드 중..." : "⬆ 엑셀 업로드"}
      </button>
      {getExport && (
        <button className="btn-ghost shrink-0" onClick={downloadData}>
          ⬇ 데이터 다운로드
        </button>
      )}
      {getRangeExport && (
        <span className="flex items-center gap-1.5 flex-nowrap shrink-0">
          <span className="text-slate-300 px-0.5">|</span>
          <span className="text-xs text-slate-500 shrink-0">기간</span>
          <input
            type="date"
            className="input !py-1 !px-2 !text-xs w-[130px] shrink-0"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-xs text-slate-500 shrink-0">~</span>
          <input
            type="date"
            className="input !py-1 !px-2 !text-xs w-[130px] shrink-0"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button className="btn-ghost shrink-0" onClick={downloadRange} disabled={busy}>
            {busy ? "처리 중..." : "⬇ 기간 다운로드"}
          </button>
        </span>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onPick}
      />
      {msg && <span className="text-xs text-slate-600">{msg}</span>}
    </div>
  );
}
