import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "은하수산 매출관리 시스템",
  description: "은하수산 · B2B · 수출 · 상차 매출 통합 관리 대시보드",
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
