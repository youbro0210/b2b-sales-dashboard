"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/actions";

const nav = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/b2b", label: "B2B 매출", icon: "🏢" },
  { href: "/loading", label: "상차금액", icon: "🚚" },
  { href: "/export", label: "수출대장", icon: "🌏" },
  { href: "/master", label: "기준정보 관리", icon: "🗂️" },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="text-lg font-bold">매출 관리</div>
        <div className="text-xs text-slate-400 mt-1">통합 대시보드</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
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
  );
}
