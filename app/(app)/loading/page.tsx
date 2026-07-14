"use client";

import LoadingBoard from "@/components/LoadingBoard";

// 마트 = 오프라인 채널 + 수수료업체
const GROUPS = ["오프라인", "롯데마트_수수료업체", "이마트_수수료업체"];

export default function MartPage() {
  return <LoadingBoard title="마트" groups={GROUPS} />;
}
