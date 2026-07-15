"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, fmtInt, ymd, todayKST } from "@/lib/types";
import { listExportRange } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);

// 수출대장 현황 (조회 전용 + 엑셀 다운로드)
export default function ExportReport() {
  const today = todayKST();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    setRows((await listExportRange(from, to)) as any[]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const total = rows.reduce((s, r) => s + num(r.sales_total), 0);

  const download = () => {
    const aoa = [
      [
        "납기일", "공급구분", "고객사명", "수출국가", "품명", "단위",
        "매출액/단위", "수량(단위)", "수량(박스)", "매출 계", "제조원가 계", "물류비",
        "환율", "대분류", "정부지원사업",
      ],
      ...rows.map((r) => [
        ymd(r.delivery_date),
        r.supply_type,
        r.customer_name,
        r.country_name,
        r.product_name,
        r.unit,
        num(r.sales_per_unit),
        num(r.qty_unit),
        num(r.qty_box),
        num(r.sales_total),
        num(r.mfg_cost_total),
        num(r.logistics_cost),
        num(r.exchange_rate),
        r.category,
        r.gov_support,
      ]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "현황");
    XLSX.writeFile(wb, `수출대장현황_${from}_${to}.xlsx`);
  };

  return (
    <ReportShell
      title="수출대장"
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      onSearch={fetchRows}
      onDownload={download}
      loading={loading}
      count={rows.length}
    >
      <div className="card overflow-x-auto">
        <div className="flex justify-between mb-3">
          <h2 className="font-semibold">수출 내역</h2>
          <span className="text-sm text-slate-500">
            매출 합계 <b className="text-slate-800">{fmt(total)}</b> 원
          </span>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>납기일</th>
                <th>구분</th>
                <th>고객사</th>
                <th>국가</th>
                <th>품명</th>
                <th className="text-right">수량(단위)</th>
                <th className="text-right">매출 계</th>
                <th className="text-right">원가 계</th>
                <th className="text-right">환율</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-slate-400 py-6">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{ymd(r.delivery_date)}</td>
                  <td>{r.supply_type}</td>
                  <td>{r.customer_name}</td>
                  <td>{r.country_name}</td>
                  <td>{r.product_name}</td>
                  <td className="text-right tabular-nums">{fmtInt(num(r.qty_unit))}</td>
                  <td className="text-right tabular-nums">
                    {fmt(num(r.sales_total), r.country_name === "일본" ? 4 : 2)}
                  </td>
                  <td className="text-right tabular-nums">
                    {fmt(num(r.mfg_cost_total), r.country_name === "일본" ? 4 : 2)}
                  </td>
                  <td className="text-right tabular-nums">{r.exchange_rate}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-slate-50">
                  <td colSpan={6}>합계</td>
                  <td className="text-right">{fmt(total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </ReportShell>
  );
}
