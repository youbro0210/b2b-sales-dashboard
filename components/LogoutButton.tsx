"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/actions";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className={className ?? "btn-ghost"}>
      로그아웃
    </button>
  );
}
