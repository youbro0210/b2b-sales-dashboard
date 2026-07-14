"use client";

import LoadingBoard from "@/components/LoadingBoard";

const GROUPS = ["온라인"];

export default function OnlinePage() {
  return <LoadingBoard title="온라인" groups={GROUPS} />;
}
