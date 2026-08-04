"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/actions";

// 각 화면 (모두 클라이언트 컴포넌트)
import DashboardScreen from "@/app/(app)/dashboard/page";
import B2bScreen from "@/app/(app)/b2b/page";
import ExportScreen from "@/app/(app)/export/page";
import MasterScreen from "@/app/(app)/master/page";
import MembersScreen from "@/app/(app)/members/page";
import GradesScreen from "@/app/(app)/grades/page";
import LoginHistoryScreen from "@/app/(app)/login-history/page";
import LoadingBoard from "@/components/LoadingBoard";
import SpecialDaily from "@/components/SpecialDaily";
import B2bReport from "@/components/B2bReport";
import LoadingReport from "@/components/LoadingReport";
import ExportReport from "@/components/ExportReport";
import SpecialMatrix from "@/components/SpecialMatrix";
import CrabBoard from "@/components/CrabBoard";
import CrabReport from "@/components/CrabReport";
import SalesReport from "@/components/SalesReport";

const MART = ["오프라인", "롯데마트_수수료업체", "이마트_수수료업체"];
const ONLINE = ["온라인"];

type Screen = {
  key: string;
  label: string;
  icon: string;
  group: "none" | "input" | "report" | "admin";
  render: () => React.ReactNode;
};

const SCREENS: Screen[] = [
  { key: "dashboard", label: "대시보드", icon: "📊", group: "none", render: () => <DashboardScreen /> },

  { key: "b2b", label: "B2B", icon: "🏢", group: "input", render: () => <B2bScreen /> },
  { key: "loading", label: "B2C 오프라인", icon: "🏬", group: "input", render: () => <LoadingBoard title="B2C 오프라인" groups={MART} /> },
  { key: "online", label: "B2C 온라인", icon: "🛒", group: "input", render: () => <LoadingBoard title="B2C 온라인" groups={ONLINE} /> },
  { key: "special", label: "특정", icon: "📦", group: "input", render: () => <SpecialDaily /> },
  { key: "crab", label: "꽃게", icon: "🦀", group: "input", render: () => <CrabBoard /> },
  { key: "salesreport", label: "매출 리포트", icon: "🧾", group: "input", render: () => <SalesReport /> },
  { key: "export", label: "수출대장", icon: "🌏", group: "input", render: () => <ExportScreen /> },

  { key: "r-b2b", label: "B2B 현황", icon: "📈", group: "report", render: () => <B2bReport /> },
  { key: "r-mart", label: "B2C 오프라인 현황", icon: "📈", group: "report", render: () => <LoadingReport title="B2C 오프라인" groups={MART} /> },
  { key: "r-online", label: "B2C 온라인 현황", icon: "📈", group: "report", render: () => <LoadingReport title="B2C 온라인" groups={ONLINE} /> },
  { key: "r-special", label: "특정 현황", icon: "📈", group: "report", render: () => <SpecialMatrix readOnly /> },
  { key: "r-crab", label: "꽃게 현황", icon: "📈", group: "report", render: () => <CrabReport /> },
  { key: "r-export", label: "수출대장 현황", icon: "📈", group: "report", render: () => <ExportReport /> },

  { key: "master", label: "기준정보 관리", icon: "🗂️", group: "admin", render: () => <MasterScreen /> },
  { key: "members", label: "회원관리", icon: "👤", group: "admin", render: () => <MembersScreen /> },
  { key: "grades", label: "등급관리", icon: "🏷️", group: "admin", render: () => <GradesScreen /> },
  { key: "login-history", label: "로그인 이력", icon: "🕘", group: "admin", render: () => <LoginHistoryScreen /> },
];

const byKey = (k: string) => SCREENS.find((s) => s.key === k)!;

// URL 경로 → 탭 키 (KPI 카드 등 <Link>로 이동해도 해당 탭이 열리도록)
const PATH_TO_KEY: Record<string, string> = {
  "/dashboard": "dashboard",
  "/b2b": "b2b",
  "/loading": "loading",
  "/online": "online",
  "/special": "special",
  "/crab": "crab",
  "/sales-report": "salesreport",
  "/export": "export",
  "/report/b2b": "r-b2b",
  "/report/mart": "r-mart",
  "/report/online": "r-online",
  "/report/special": "r-special",
  "/report/crab": "r-crab",
  "/report/export": "r-export",
  "/master": "master",
  "/members": "members",
  "/grades": "grades",
  "/login-history": "login-history",
};

export default function AppShell({
  email,
  isAdmin,
  canEdit,
}: {
  email: string;
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // 열린 탭 (열린 순서 유지) — 화면 상태를 살려두기 위해 언마운트하지 않는다
  const [tabs, setTabs] = useState<string[]>(["dashboard"]);
  const [active, setActive] = useState("dashboard");

  const openTab = useCallback((key: string) => {
    setTabs((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setActive(key);
    setMenuOpen(false);
  }, []);

  // KPI·오늘매출 카드 등 URL 이동(<Link>) 시 해당 탭을 열어 활성화
  useEffect(() => {
    const key = PATH_TO_KEY[pathname ?? ""];
    if (key) openTab(key);
  }, [pathname, openTab]);

  const closeTab = useCallback(
    (key: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setTabs((prev) => {
        const next = prev.filter((k) => k !== key);
        if (next.length === 0) {
          setActive("dashboard");
          return ["dashboard"];
        }
        setActive((cur) => {
          if (cur !== key) return cur;
          const i = prev.indexOf(key);
          return next[Math.max(0, i - 1)];
        });
        return next;
      });
    },
    []
  );

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  // 등급별 메뉴 구성
  const visible = SCREENS.filter((s) => {
    if (s.group === "input") return canEdit || isAdmin;
    if (s.group === "admin") return isAdmin;
    return true;
  });
  const section = (g: Screen["group"]) => visible.filter((s) => s.group === g);

  const oceanBg = {
    background: "linear-gradient(180deg,#0A2540 0%,#0E3A5F 55%,#0F4C75 100%)",
  };

  const MenuLink = ({ s }: { s: Screen }) => {
    const on = active === s.key;
    return (
      <button
        onClick={() => openTab(s.key)}
        className={`relative w-full text-left flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm transition ${
          on ? "text-white font-bold" : "text-sky-100/75 hover:bg-white/10 hover:text-white"
        }`}
        style={
          on
            ? {
                background: "linear-gradient(90deg,#0184CA 0%,#0EA5E9 100%)",
                boxShadow: "0 2px 12px rgba(14,165,233,0.45)",
              }
            : undefined
        }
      >
        {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white" />}
        <span className={on ? "" : "opacity-80"}>{s.icon}</span>
        {s.label}
      </button>
    );
  };

  const Divider = ({ label }: { label: string }) => (
    <div className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sky-200/50">
      {label}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* 모바일 상단바 */}
      <div
        className="md:hidden flex items-center justify-between text-white px-4 py-3 sticky top-0 z-30"
        style={oceanBg}
      >
        <button onClick={() => openTab("dashboard")} className="font-bold tracking-wide">
          🌊 은하수산
        </button>
        <button onClick={() => setMenuOpen(true)} aria-label="메뉴 열기" className="text-2xl leading-none">
          ☰
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed md:static top-0 left-0 z-50 h-full w-60 shrink-0 text-slate-100 flex flex-col transform transition-transform duration-200 md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={oceanBg}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <button onClick={() => openTab("dashboard")} className="block text-left">
            <div className="text-lg font-bold tracking-wide flex items-center gap-1.5">
              <span>🌊</span> 은하수산
            </div>
            <div className="text-[11px] text-sky-200/80 mt-1 tracking-wide">
              매출관리 시스템 · Since 1970
            </div>
          </button>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden text-slate-300 text-xl"
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {section("none").map((s) => (
            <MenuLink key={s.key} s={s} />
          ))}
          {section("input").length > 0 && <Divider label="입력" />}
          {section("input").map((s) => (
            <MenuLink key={s.key} s={s} />
          ))}
          {section("report").length > 0 && <Divider label="현황" />}
          {section("report").map((s) => (
            <MenuLink key={s.key} s={s} />
          ))}
          {section("admin").length > 0 && <Divider label="관리" />}
          {section("admin").map((s) => (
            <MenuLink key={s.key} s={s} />
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-xs text-sky-200/70 truncate mb-2">{email}</div>
          <button
            onClick={logout}
            className="w-full text-sm bg-white/10 hover:bg-white/20 rounded-lg py-2 transition"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 본문: 탭바 + 탭 내용 */}
      <main className="flex-1 min-w-0 w-full flex flex-col">
        {/* 탭바 */}
        <div className="sticky top-12 md:top-0 z-20 bg-white border-b border-slate-200 overflow-x-auto">
          <div className="flex items-stretch gap-1 px-2 pt-2 whitespace-nowrap">
            {tabs.map((k) => {
              const s = byKey(k);
              const on = active === k;
              return (
                <div
                  key={k}
                  onClick={() => setActive(k)}
                  className={`group flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-sm cursor-pointer select-none transition ${
                    on
                      ? "bg-white border-slate-300 text-slate-900 font-semibold"
                      : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  style={on ? { boxShadow: "inset 0 3px 0 #0EA5E9" } : undefined}
                >
                  <span className="opacity-80">{s.icon}</span>
                  <span>{s.label}</span>
                  {k !== "dashboard" && (
                    <button
                      onClick={(e) => closeTab(k, e)}
                      aria-label="탭 닫기"
                      className="ml-1 text-slate-400 hover:text-red-500 leading-none px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 탭 내용 — 열린 탭은 계속 마운트해 두어 입력값이 유지된다 */}
        <div className="flex-1 min-w-0 p-4 pb-8 md:p-8">
          {tabs.map((k) => (
            <div key={k} style={{ display: active === k ? "block" : "none" }}>
              {byKey(k).render()}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
