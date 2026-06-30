import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email} />
      <main className="flex-1 p-6 md:p-8 overflow-x-auto">{children}</main>
    </div>
  );
}
