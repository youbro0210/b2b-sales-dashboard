"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions";

const baseNav = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/b2b", label: "B2B 매출", icon: "🏢" },
  { href: "/loading", label: "상차금액", icon: "🚚" },
  { href: "/export", label: "수출대장", icon: "🌏" },
  { href: "/master", label: "기준정보 관리", icon: "🗂️" },
];
const adminNav = [
  { href: "/members", label: "회원관리", icon: "👤" },
  { href: "/grades", label: "등급관리", icon: "🏷️" },
];

export default function Sidebar({
  email,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = isAdmin ? [...baseNav, ...adminNav] : baseNav;

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3 sticky top-0 z-30">
        <span className="font-bold">매출 관리</span>
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
        className={`fixed md:static top-0 left-0 z-50 h-full w-60 shrink-0 bg-slate-900 text-slate-100 flex flex-col transform transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-700 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">매출 관리</div>
            <div className="text-xs text-slate-400 mt-1">통합 대시보드</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-slate-400 text-xl"
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  active ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 truncate mb-2">{email}</div>
          <button
            onClick={logout}
            className="w-full text-sm bg-slate-800 hover:bg-slate-700 rounded-lg py-2"
          >
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
