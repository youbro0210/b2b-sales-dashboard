"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ReportShell from "@/components/ReportShell";
import { fmt, ymd, todayKST } from "@/lib/types";
import { listLoadingRange, listChannels } from "@/lib/actions";

const num = (v: any) => Number(v ?? 0);
const isSum = (n: string) => /합계\s*$/.test((n || "").trim());

type Group = { name: string; rows: any[]; supply: number };

// 마트 브랜드(채널명 접두어) — 같은 브랜드 채널끼리 소계로 묶는다
// 예) 롯데마트 소계 = 롯데마트 + 롯데마트정발행 + 롯데마트물갈이역발행
const BRANDS = [
  "코스트코",
  "롯데마트",
  "롯데슈퍼",
  "이마트",
  "트레이더스",
  "에브리데이",
  "서원유통",
  "홈플러스",
];
const brandOf = (name: string) => {
  if (name.startsWith("롯데")) return "롯데"; // 롯데 계열(마트·슈퍼·물갈이 등)은 모두 하나로
  const cands = BRANDS.filter((b) => name.startsWith(b));
  return cands.length ? cands.reduce((a, b) => (b.length > a.length ? b : a)) : name;
};

// 코스트코는 마트 합계와 별도로 집계 (합계·누계에서 제외)
const isCostco = (name: string) => name.startsWith("코스트코");

// B2C 오프라인 / 온라인 현황
// 조회 시 채널(판매처)별 합계 + 누계를 먼저 보여주고, 채널명 클릭 시 일자별 세부 내역 팝업
export default function LoadingReport({
  title,
  groups,
}: {
  title: string;
  groups: string[];
}) {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [chan, setChan] = useState(""); // 채널 필터 ("" = 전체)
  const [rows, setRows] = useState<any[]>([]);
  const [order, setOrder] = useState<Record<string, number>>({});
  const [chanList, setChanList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Group | null>(null);

  // 기준정보(채널)에서 이 그룹에 속한 채널 목록·순서를 만든다
  // (listLoadingRange 는 group_name 을 내려주지 않으므로, 채널명 기준으로 그룹 소속을 판단한다)
  const loadChannelMeta = useCallback(async () => {
    const all = (await listChannels()) as any[];
    let cur = "";
    const map: Record<string, number> = {};
    const names: string[] = [];
    all.forEach((c, i) => {
      if (c.group_name) cur = c.group_name;
      const g = c.group_name || cur;
      if (groups.includes(g) && !isSum(c.name)) {
        map[c.name] = i;
        names.push(c.name);
      }
    });
    return { map, names };
  }, [groups]);

  useEffect(() => {
    loadChannelMeta().then(({ map, names }) => {
      setOrder(map);
      setChanList(names);
    });
  }, [loadChannelMeta]);

  const fetchRows = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    // 채널 소속표가 아직 준비되지 않았으면 즉시 로드 (초기 조회 시 빈 화면 방지)
    let meta = order;
    if (Object.keys(meta).length === 0) {
      const m = await loadChannelMeta();
      meta = m.map;
      setOrder(m.map);
      setChanList(m.names);
    }
    const orderOf = (n: string) =>
      Object.prototype.hasOwnProperty.call(meta, n) ? meta[n] : 9999;

    let data = (await listLoadingRange(from, to)) as any[];
    // 이 그룹(오프라인/온라인)에 속한 채널만 남긴다 (채널명 기준)
    data = data.filter((r) =>
      Object.prototype.hasOwnProperty.call(meta, String(r.channel_name))
    );
    if (chan) data = data.filter((r) => String(r.channel_name) === chan);
    data.sort(
      (a, b) =>
        orderOf(String(a.channel_name)) - orderOf(String(b.channel_name)) ||
        ymd(a.load_date).localeCompare(ymd(b.load_date))
    );
    setRows(data);
    setSearched(true);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, chan, order, loadChannelMeta]);

  // 채널별 그룹 (연속 정렬되어 있으므로 순서대로 묶는다)
  const gps = useMemo<Group[]>(() => {
    const g: Group[] = [];
    let cur: Group | null = null;
    for (const r of rows) {
      const nm = r.channel_name || "(미지정)";
      if (!cur || nm !== cur.name) {
        cur = { name: nm, rows: [], supply: 0 };
        g.push(cur);
      }
      cur.rows.push(r);
      cur.supply += num(r.supply_amount);
    }
    return g;
  }, [rows]);

  // 코스트코는 별도 집계 → 일반 마트(main)와 분리
  const mainGps = useMemo(() => gps.filter((g) => !isCostco(g.name)), [gps]);
  const costcoGps = useMemo(() => gps.filter((g) => isCostco(g.name)), [gps]);
  const total = mainGps.reduce((s, g) => s + g.supply, 0);
  const costcoTotal = costcoGps.reduce((s, g) => s + g.supply, 0);

  // 브랜드별로 묶고, 매출(공급가액) 내림차순으로 정렬한 뒤 누계를 누적한다
  // (브랜드는 소계 합계가 큰 순, 브랜드 안 채널은 매출 큰 순)
  const display = useMemo(() => {
    const bmap: Record<string, Group[]> = {};
    mainGps.forEach((g) => {
      const bk = brandOf(g.name);
      if (!bmap[bk]) bmap[bk] = [];
      bmap[bk].push(g);
    });
    const brands = Object.keys(bmap).map((bk) => {
      const chans = [...bmap[bk]].sort((a, b) => b.supply - a.supply);
      const sum = chans.reduce((s, g) => s + g.supply, 0);
      return { bk, chans, sum };
    });
    brands.sort((a, b) => b.sum - a.sum);
    let run = 0;
    const out: any[] = [];
    brands.forEach(({ bk, chans, sum }) => {
      chans.forEach((g) => {
        run += g.supply;
        out.push({ type: "ch", g, cum: run });
      });
      if (chans.length >= 2) {
        out.push({ type: "sub", brand: bk, supply: sum });
      }
    });
    return out;
  }, [mainGps]);

  const download = () => {
    const aoa: any[] = [["채널명", "일자", "공급가액"]];
    mainGps.forEach((g) => {
      g.rows.forEach((r) => aoa.push([g.name, ymd(r.load_date), num(r.supply_amount)]));
      aoa.push([`${g.name} 소계`, "", g.supply]);
    });
    aoa.push(["합계 (코스트코 제외)", "", total]);
    costcoGps.forEach((g) => {
      g.rows.forEach((r) => aoa.push([g.name, ymd(r.load_date), num(r.supply_amount)]));
      aoa.push([`${g.name} 소계`, "", g.supply]);
    });
    if (costcoGps.length) aoa.push(["코스트코 합계(별도)", "", costcoTotal]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "현황");
    XLSX.writeFile(wb, `${title}현황_${from}_${to}.xlsx`);
  };

  const filter = (
    <select
      className="input max-w-[170px]"
      value={chan}
      onChange={(e) => setChan(e.target.value)}
    >
      <option value="">전체 채널</option>
      {chanList.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );

  return (
    <ReportShell
      title={title}
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      onSearch={fetchRows}
      onDownload={download}
      loading={loading}
      count={gps.length}
      extraFilter={filter}
    >
      <div className="card overflow-x-auto">
        <div className="mb-3">
          <h2 className="font-semibold">{title} · 채널별 매출</h2>
          <p className="text-xs text-slate-500">
            채널명을 클릭하면 일자별 세부 내역이 팝업으로 열립니다.
          </p>
        </div>
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : !searched ? (
          <p className="text-center text-slate-400 py-6">🔍 조회 버튼을 눌러 조회하세요.</p>
        ) : (
          <>
            {costcoGps.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-2">
                  코스트코 (별도 집계 · 아래 마트 합계에 미포함)
                </h3>
                <table className="data celled">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>채널명</th>
                      <th className="text-right">공급가액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...costcoGps]
                      .sort((a, b) => b.supply - a.supply)
                      .map((g) => (
                      <tr key={g.name} className="hover:bg-sky-50">
                        <td className="whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDetail(g)}
                            className="font-medium text-sky-700 hover:underline text-left"
                            title="일자별 세부 내역 보기"
                          >
                            {g.name} 🔍
                          </button>
                        </td>
                        <td className="text-right tabular-nums">{fmt(g.supply)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-slate-50">
                      <td>코스트코 합계</td>
                      <td className="text-right tabular-nums">{fmt(costcoTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <table className="data celled">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>채널명</th>
                  <th className="text-right">공급가액</th>
                  <th className="text-right">누계공급가액</th>
                </tr>
              </thead>
              <tbody>
                {gps.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-slate-400 py-6">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {mainGps.length === 0 && costcoGps.length > 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-slate-400 py-4">
                      (일반 마트 데이터 없음 · 코스트코는 위 별도 표시)
                    </td>
                  </tr>
                )}
                {display.map((row, i) =>
                  row.type === "ch" ? (
                    <tr key={row.g.name} className="hover:bg-sky-50">
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetail(row.g)}
                          className="font-medium text-sky-700 hover:underline text-left"
                          title="일자별 세부 내역 보기"
                        >
                          {row.g.name} 🔍
                        </button>
                      </td>
                      <td className="text-right tabular-nums">{fmt(row.g.supply)}</td>
                      <td className="text-right tabular-nums text-slate-500">{fmt(row.cum)}</td>
                    </tr>
                  ) : (
                    <tr key={"sub-" + row.brand + i} className="bg-slate-100 font-medium text-sm">
                      <td className="text-right text-slate-600">{row.brand} 소계</td>
                      <td className="text-right tabular-nums">{fmt(row.supply)}</td>
                      <td></td>
                    </tr>
                  )
                )}
              </tbody>
              {mainGps.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-slate-50">
                    <td>매출 합계 (코스트코 제외)</td>
                    <td className="text-right">{fmt(total)}</td>
                    <td className="text-right tabular-nums">{fmt(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </>
        )}
      </div>

      {detail && <DetailModal group={detail} onClose={() => setDetail(null)} />}
    </ReportShell>
  );
}

// 채널 일자별 세부 내역 팝업
function DetailModal({ group, onClose }: { group: Group; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-lg">{group.name}</h3>
            <p className="text-xs text-slate-500">세부 내역 · {group.rows.length}건</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-auto">
          <table className="data celled text-sm">
            <thead>
              <tr>
                <th className="whitespace-nowrap">일자</th>
                <th className="text-right">공급가액</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{ymd(r.load_date)}</td>
                  <td className="text-right tabular-nums">{fmt(num(r.supply_amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-slate-50">
                <td>소계</td>
                <td className="text-right tabular-nums">{fmt(group.supply)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
