"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions";

type NavItem = { href: string; label: string; icon: string };
type NavRow = NavItem | { divider: string };

// 대시보드 · 현황: 모든 승인 사용자
const dashboardRow: NavRow = { href: "/dashboard", label: "대시보드", icon: "📊" };
// 입력: 편집 권한(can_edit) 또는 관리자만
const editNav: NavRow[] = [
  { divider: "입력" },
  { href: "/b2b", label: "B2B", icon: "🏢" },
  { href: "/loading", label: "B2C 오프라인", icon: "🏬" },
  { href: "/online", label: "B2C 온라인", icon: "🛒" },
  { href: "/special", label: "특정", icon: "📦" },
  { href: "/export", label: "수출대장", icon: "🌏" },
];
// 현황: 모든 승인 사용자
const reportNav: NavRow[] = [
  { divider: "현황" },
  { href: "/report/b2b", label: "B2B 현황", icon: "📈" },
  { href: "/report/mart", label: "B2C 오프라인 현황", icon: "📈" },
  { href: "/report/online", label: "B2C 온라인 현황", icon: "📈" },
  { href: "/report/special", label: "특정 현황", icon: "📈" },
  { href: "/report/export", label: "수출대장 현황", icon: "📈" },
];
// 관리(설정): 관리자만
const adminNav: NavRow[] = [
  { divider: "관리" },
  { href: "/master", label: "기준정보 관리", icon: "🗂️" },
  { href: "/members", label: "회원관리", icon: "👤" },
  { href: "/grades", label: "등급관리", icon: "🏷️" },
  { href: "/login-history", label: "로그인 이력", icon: "🕘" },
];

export default function Sidebar({
  email,
  isAdmin,
  canEdit,
}: {
  email: string;
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav: NavRow[] = [
    dashboardRow,
    ...(canEdit || isAdmin ? editNav : []),
    ...reportNav,
    ...(isAdmin ? adminNav : []),
  ];

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const oceanBg = { background: "linear-gradient(180deg,#0A2540 0%,#0E3A5F 55%,#0F4C75 100%)" };

  return (
    <>
      {/* 모바일 상단바 */}
      <div
        className="md:hidden flex items-center justify-between text-white px-4 py-3 sticky top-0 z-30"
        style={oceanBg}
      >
        <Link href="/dashboard" className="font-bold tracking-wide">
          🌊 은하수산
        </Link>
        <button onClick={() => setOpen(true)} aria-label="메뉴 열기" className="text-2xl leading-none">
          ☰
        </button>
      </div>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static top-0 left-0 z-50 h-full w-60 shrink-0 text-slate-100 flex flex-col transform transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={oceanBg}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block">
            <div className="text-lg font-bold tracking-wide flex items-center gap-1.5">
              <span>🌊</span> 은하수산
            </div>
            <div className="text-[11px] text-sky-200/80 mt-1 tracking-wide">
              매출관리 시스템 · Since 1970
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-slate-300 text-xl"
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item, idx) => {
            if ("divider" in item) {
              return (
                <div
                  key={"d" + idx}
                  className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sky-200/50"
                >
                  {item.divider}
                </div>
              );
            }
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? "text-white font-bold"
                    : "text-sky-100/75 hover:bg-white/10 hover:text-white"
                }`}
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(90deg,#0184CA 0%,#0EA5E9 100%)",
                        boxShadow: "0 2px 12px rgba(14,165,233,0.45)",
                      }
                    : undefined
                }
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white" />
                )}
                <span className={active ? "" : "opacity-80"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
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
    </>
  );
}
