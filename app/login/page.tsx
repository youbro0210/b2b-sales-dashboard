"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/actions";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn(email, password);
    if (!res.ok) {
      setError(res.error ?? "로그인에 실패했습니다.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">매출 관리 시스템</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          로그인하여 대시보드에 접속하세요
        </p>
        <form onSubmit={handleLogin} className="card space-y-4">
          <div>
            <label className="label">이메일</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">비밀번호</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-slate-600">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-brand font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
