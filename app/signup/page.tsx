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
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">회원가입</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          정보를 입력해 계정을 만드세요
        </p>
        <form onSubmit={handleSignup} className="card space-y-4">
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
        <p className="text-sm text-center mt-4 text-slate-600">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-brand font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
