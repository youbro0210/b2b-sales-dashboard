"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/actions";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signUp(email, password, name, phone);
    if (!res.ok) {
      setError(res.error ?? "가입에 실패했습니다.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0A2540 0%,#0E4C7A 55%,#0184CA 100%)" }}
    >
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle,#7dd3fc 0%,transparent 70%)" }}
      />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold text-white tracking-wide flex items-center justify-center gap-2">
            <span>🌊</span> 은하수산
          </div>
          <p className="text-sky-100/80 text-sm mt-2 tracking-wide">
            매출관리 시스템 · Since 1970
          </p>
        </div>
        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 text-center mb-1">회원가입</h2>
          <div>
            <label className="label">이름</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">전화번호</label>
            <input
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>
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
            <label className="label">비밀번호 (6자 이상)</label>
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
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <p className="text-sm text-center mt-5 text-sky-100/90">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-white font-semibold underline underline-offset-2">
            로그인
          </Link>
        </p>
        <p className="text-center text-[11px] text-sky-200/60 mt-8">
          © eunha Fisheries Co., Ltd.
        </p>
      </div>
    </div>
  );
}
