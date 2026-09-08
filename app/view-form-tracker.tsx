"use client";

import { useEffect } from "react";

// ============================================================
// 申し込みフォーム（#apply セクション）が画面に表示されたら
// セッション中1回だけ GA4イベント view_form を発火する
// ============================================================

const FLAG_KEY = "view_form_sent";

export default function ViewFormTracker() {
  useEffect(() => {
    const el = document.getElementById("apply");
    if (!el) return;
    if (sessionStorage.getItem(FLAG_KEY)) return;

    const fire = () => {
      window.gtag?.("event", "view_form");
      sessionStorage.setItem(FLAG_KEY, "1");
    };

    // IntersectionObserver未対応環境では即時発火にフォールバック
    if (!("IntersectionObserver" in window)) {
      fire();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fire();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return null;
}
