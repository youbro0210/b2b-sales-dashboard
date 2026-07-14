import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPWA from "@/components/InstallPWA";

export const metadata: Metadata = {
  title: "은하수산 매출관리 시스템",
  description: "은하수산 · B2C 온라인 · 수출 · 마트/온라인/특정 매출 통합 관리",
  manifest: "/manifest.webmanifest",
  applicationName: "은하수산",
  appleWebApp: {
    capable: true,
    title: "은하수산",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/192",
    apple: "/icons/192",
  },
};

// 모바일 대응: 기기 폭에 맞추고, 확대는 허용(접근성)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A2540",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <InstallPWA />
      </body>
    </html>
  );
}
