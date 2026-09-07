"use client";

import { useState, useEffect, useRef } from "react";

// ============================================================
// セクション2（課題・共感）の背景動画
// - autoplay・muted・playsInline でモバイルも自動再生
// - ループせず、中盤（50%地点）からフェードアウトを開始し、
//   再生終了直前（97%地点）に完全に消える（下層はセクションの静的背景 bg-tint）
// - モバイル（md未満）では背景動画を描画しない（静的背景のまま）
// - prefers-reduced-motion のユーザーには動画を描画しない（静的背景のまま）
// - 読み込み中のチラつき防止のため poster（汎用の薄色プレースホルダー）を設定
// ============================================================

// 💡 フェードの開始・終了位置（再生進行度の割合）
const FADE_START = 0.5;
const FADE_END = 0.97;

export default function Section2Background() {
  const [reducedMotion, setReducedMotion] = useState(false);
  // 💡 モバイルでは背景動画を表示しない
  const [isDesktop, setIsDesktop] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 💡 再生進行度に応じて opacity を直接設定（毎フレーム state 更新しないよう DOM 操作）
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || Number.isNaN(v.duration)) return;
    const progress = v.currentTime / v.duration;
    let opacity = 1;
    if (progress > FADE_START) {
      opacity = Math.max(
        0,
        1 - (progress - FADE_START) / (FADE_END - FADE_START)
      );
    }
    v.style.opacity = String(opacity);
  };

  // 💡 動画不要ユーザー・モバイル／未hydration時はセクションの静的背景（bg-tint）のまま
  if (reducedMotion || !isDesktop) return null;

  return (
    <>
      <video
        ref={videoRef}
        aria-hidden="true"
        onTimeUpdate={handleTimeUpdate}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        poster="/images/video-poster.jpg"
        preload="metadata"
      >
        <source src="/videos/counseling-bg.mp4" type="video/mp4" />
      </video>
      {/* 💡 テキスト可読性のための半透明オーバーレイ（--color-tint） */}
      <div className="absolute inset-0 bg-tint/85" />
    </>
  );
}
