import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session-user";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!user.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">승인 대기 중</h1>
          <p className="text-sm text-slate-500 mb-1">
            관리자 승인 후 이용할 수 있습니다.
          </p>
          <p className="text-xs text-slate-400 mb-4">{user.email}</p>
          <LogoutButton className="btn-ghost" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar email={user.email} isAdmin={user.isAdmin} />
      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-x-auto w-full">{children}</main>
    </div>
  );
}
