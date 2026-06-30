import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "매출 관리 시스템",
  description: "B2B · 수출 · 상차 매출 통합 관리 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
