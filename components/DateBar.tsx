"use client";

import { todayKST } from "@/lib/types";

export default function DateBar({
  date,
  setDate,
  children,
}: {
  date: string;
  setDate: (d: string) => void;
  children?: React.ReactNode;
}) {
  const shift = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="btn-ghost" onClick={() => shift(-1)}>
        ◀ 이전
      </button>
      <input
        type="date"
        className="input max-w-[180px]"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button className="btn-ghost" onClick={() => shift(1)}>
        다음 ▶
      </button>
      <button className="btn-ghost" onClick={() => setDate(todayKST())}>
        오늘
      </button>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
