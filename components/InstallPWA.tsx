"use client";

import { useEffect, useState } from "react";

// 홈 화면 설치(PWA) 버튼.
// - 안드로이드/데스크톱 크롬: beforeinstallprompt 를 잡아두었다가 버튼 클릭 시 설치창을 띄운다.
// - 아이폰 사파리: beforeinstallprompt 가 없으므로 "공유 → 홈 화면에 추가" 안내를 보여준다.
// 이미 설치되어 standalone 으로 실행 중이면 아무것도 표시하지 않는다.

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 크롬은 fetch 핸들러가 있는 서비스워커가 등록돼야 설치 프롬프트를 띄운다.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  if (installed || dismissed) return null;
  if (!deferred && !isIOS) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {showIOSHelp && (
        <div className="max-w-[260px] rounded-xl bg-white shadow-lg border border-slate-200 p-3 text-xs text-slate-700 leading-relaxed">
          <b className="block mb-1 text-slate-900">아이폰에서 설치하기</b>
          사파리 하단의 <b>공유</b> 버튼을 누른 뒤 <b>“홈 화면에 추가”</b>를 선택하세요.
          <button
            className="mt-2 block text-slate-400 underline"
            onClick={() => setShowIOSHelp(false)}
          >
            닫기
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => (isIOS ? setShowIOSHelp((v) => !v) : install())}
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#0184CA 0%,#0A2540 100%)" }}
        >
          📲 앱 설치
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="설치 안내 닫기"
          className="rounded-full w-7 h-7 bg-slate-200 text-slate-600 text-xs shadow"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
