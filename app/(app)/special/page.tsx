"use client";

import LoadingBoard from "@/components/LoadingBoard";

const GROUPS = ["특정"];

export default function SpecialPage() {
  return <LoadingBoard title="특정" groups={GROUPS} />;
}
