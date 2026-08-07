"use client";

// 천단위 구분자(,)가 표시되는 숫자 입력 컴포넌트.
// 입력 중에는 원문을 유지하고, 포커스가 빠지면 콤마 포맷으로 표시한다.
// 사칙연산 수식 입력 지원: 예) =((87000*44)+(66500*108)) 또는 87000*44+66500*108
// (= 로 시작하거나 + - * / ( ) 가 포함되면 수식으로 보고 계산한다)

import { useState } from "react";

const toNum = (s: string): number => {
  const cleaned = String(s).replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return 0;
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
};

const format = (v: number, decimals: number): string => {
  if (v == null || isNaN(v) || v === 0) return "";
  return Number(v).toLocaleString("en-US", { maximumFractionDigits: decimals });
};

// 수식으로 볼지 판단 (= 로 시작하거나 사칙연산 기호 포함)
const isFormula = (s: string): boolean => {
  const t = String(s).trim();
  return /^=/.test(t) || /[+*/()]/.test(t) || /\d\s*-\s*\d/.test(t);
};

// 안전한 사칙연산 계산 (숫자와 + - * / ( ) . 만 허용)
const evalExpr = (s: string): number | null => {
  const e = String(s).trim().replace(/^=/, "").replace(/,/g, "").trim();
  if (e === "") return null;
  if (!/^[0-9+\-*/(). ]+$/.test(e)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const r = Function(`"use strict"; return (${e});`)();
    return typeof r === "number" && isFinite(r) ? r : null;
  } catch {
    return null;
  }
};

const roundTo = (v: number, decimals: number): number => {
  const p = Math.pow(10, Math.max(0, decimals));
  return Math.round(v * p) / p;
};

// 입력 문자열 정리(일반 숫자 모드): 숫자·소수점·음수기호만
const sanitize = (s: string, decimals: number): string => {
  let out = s.replace(/[^\d.-]/g, "");
  out = out.replace(/(?!^)-/g, "");
  const firstDot = out.indexOf(".");
  if (firstDot !== -1) {
    out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, "");
  }
  if (decimals <= 0) {
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

  // 수식이면 계산해서 부모 값에 반영 (블러/엔터 시)
  const commit = () => {
    if (isFormula(raw)) {
      const r = evalExpr(raw);
      if (r != null) {
        const rounded = roundTo(r, decimals);
        setRaw(String(rounded));
        onChange(rounded);
      }
    }
    setFocused(false);
  };

  return (
    <input
      type="text"
      inputMode="text"
      className={className}
      placeholder={placeholder}
      title="사칙연산 입력 가능: 예) =((87000*44)+(66500*108))"
      value={focused ? raw : format(value, decimals)}
      onFocus={() => {
        setFocused(true);
        setRaw(value ? String(value) : "");
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onChange={(e) => {
        const v = e.target.value;
        if (isFormula(v)) {
          setRaw(v);
        } else {
          const s = sanitize(v, decimals);
          setRaw(s);
          onChange(toNum(s));
        }
      }}
    />
  );
}
