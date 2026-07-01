"use client";

// 천단위 구분자(,)가 표시되는 숫자 입력 컴포넌트.
// 내부 값은 number 로 유지하고, 화면에는 콤마 포맷으로 보여준다.

const toNum = (s: string): number => {
  const cleaned = s.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
};

const display = (v: number): string =>
  v === 0 || v == null || isNaN(v)
    ? ""
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 });

export default function NumberInput({
  value,
  onChange,
  className = "input text-right",
  placeholder = "0",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={display(value)}
      onChange={(e) => onChange(toNum(e.target.value))}
    />
  );
}
