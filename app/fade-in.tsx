"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================
// 出現アニメーション（CSS transition + IntersectionObserver）
// - threshold 0.2 で一度だけ発火（再スクロールでは再実行しない）
// - prefers-reduced-motion では globals.css 側で無効化
// ============================================================

export default function FadeIn({
  children,
  delay = 0,
  variant = "section",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number; // 発火後の遅延（ms）
  variant?: "hero" | "section"; // hero=12px・section=16px 上昇
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fade-in-up ${
        variant === "hero" ? "" : "fade-in-up--section"
      } ${visible ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
