import type { MetadataRoute } from "next";

// PWA 매니페스트 — 안드로이드/아이폰에서 "홈 화면에 추가"로 설치되며
// 주소창 없는 전체화면 앱처럼 실행된다. (/manifest.webmanifest 로 서빙됨)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "은하수산 매출관리 시스템",
    short_name: "은하수산",
    description: "은하수산 · B2B · 수출 · 마트/온라인/특정 매출 통합 관리",
    lang: "ko",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0A2540",
    theme_color: "#0A2540",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
