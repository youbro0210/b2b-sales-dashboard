"use client";

import B2bReport from "@/components/B2bReport";
import LoadingReport from "@/components/LoadingReport";
import ExportReport from "@/components/ExportReport";
import SpecialMatrix from "@/components/SpecialMatrix";

// 마트 = 오프라인 + 수수료업체
const MART = ["오프라인", "롯데마트_수수료업체", "이마트_수수료업체"];

export default function ReportPage({ params }: { params: { kind: string } }) {
  switch (params.kind) {
    case "b2b":
      return <B2bReport />;
    case "mart":
      return <LoadingReport title="B2C 오프라인" groups={MART} />;
    case "online":
      return <LoadingReport title="B2C 온라인" groups={["온라인"]} />;
    case "special":
      return <SpecialMatrix readOnly />;
    case "export":
      return <ExportReport />;
    default:
      return <div className="text-slate-500">알 수 없는 현황입니다.</div>;
  }
}
