"use client";

// 천단위 구분자(,)가 표시되는 숫자 입력 컴포넌트.
// 입력 중(포커스)에는 사용자가 친 원문을 그대로 유지해 소수점 입력이 가능하고,
// 포커스가 빠지면 콤마 포맷으로 표시한다.
// decimals: 허용 소수 자릿수 (기본 2, 엔화 금액은 4, 수량은 0).

import { useState } from "react";

const toNum = (s: string): number => {
  const cleaned = String(s).replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return 0;
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
};

// 콤마 포맷 (포커스 아웃 시 표시)
const format = (v: number, decimals: number): string => {
  if (v == null || isNaN(v) || v === 0) return "";
  return Number(v).toLocaleString("en-US", { maximumFractionDigits: decimals });
};

// 입력 문자열 정리: 숫자·소수점·음수기호만, 소수 자릿수 제한
const sanitize = (s: string, decimals: number): string => {
  let out = s.replace(/[^\d.-]/g, "");
  // 음수기호는 맨 앞에만
  out = out.replace(/(?!^)-/g, "");
  // 소수점은 하나만
  const firstDot = out.indexOf(".");
  if (firstDot !== -1) {
    out =
      out.slice(0, firstDot + 1) +
      out.slice(firstDot + 1).replace(/\./g, "");
  }
  if (decimals <= 0) {
    // 정수만
    out = out.replace(/\./g, "");
  } else if (firstDot !== -1) {
    const [intp, decp = ""] = out.split(".");
    out = intp + "." + decp.slice(0, decimals);
  }
  return out;
};

export default function NumberInput({
  value,
  onChange,
  className = "input text-right",
  placeholder = "0",
  decimals = 2,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  decimals?: number;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={focused ? raw : format(value, decimals)}
      onFocus={() => {
        setFocused(true);
        setRaw(value ? String(value) : "");
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const s = sanitize(e.target.value, decimals);
        setRaw(s);
        onChange(toNum(s));
      }}
    />
  );
}
