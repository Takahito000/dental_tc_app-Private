"use client";

import { useState, useEffect } from "react";

// ============================================================
// セクション3 実例ギャラリー（タブ切り替え＋ライトボックス）
// 義歯：report-sample.jpg / report-sample-2.jpg（全2ページ）
// 被せ物（クラウン）：report-sample-crown.jpg（全1ページ）
// ============================================================

type TabKey = "denture" | "crown";

const TABS: { key: TabKey; label: string }[] = [
  { key: "denture", label: "義歯の生成例" },
  { key: "crown", label: "被せ物の生成例" },
];

export default function ReportGallery() {
  const [tab, setTab] = useState<TabKey>("denture");
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );

  // 💡 ライトボックス表示中：Escキーで閉じる＋背景スクロールを無効化
  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* 2択セグメントコントロール：選択中はアクセント色（--color-accent） */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="生成例の切り替え"
          className="inline-flex rounded-full border border-line bg-white p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-colors md:px-7 ${
                tab === t.key
                  ? "bg-accent text-white"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* タブ直下のラベル */}
      <p className="mt-4 text-center text-sm font-bold text-ink">
        {tab === "denture"
          ? "義歯カウンセリングの生成例（全2ページ）"
          : "クラウンカウンセリングの生成例（全1ページ）"}
      </p>

      <div className="mt-6">
        {tab === "denture" ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/report-sample.jpg"
              alt="デンピストAIが生成した比較説明シート（義歯）の実例 1ページ目"
              onClick={() =>
                setLightbox({
                  src: "/images/report-sample.jpg",
                  alt: "デンピストAIが生成した比較説明シート（義歯）の実例 1ページ目",
                })
              }
              className="w-full cursor-zoom-in rounded-lg border border-line drop-shadow-2xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/report-sample-2.jpg"
              alt="デンピストAIが生成した比較説明シート（義歯）の実例 2ページ目"
              onClick={() =>
                setLightbox({
                  src: "/images/report-sample-2.jpg",
                  alt: "デンピストAIが生成した比較説明シート（義歯）の実例 2ページ目",
                })
              }
              className="w-full cursor-zoom-in rounded-lg border border-line drop-shadow-2xl"
            />
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/images/report-sample-crown.jpg"
            alt="デンピストAIが生成した比較説明シート（被せ物）の実例"
            onClick={() =>
              setLightbox({
                src: "/images/report-sample-crown.jpg",
                alt: "デンピストAIが生成した比較説明シート（被せ物）の実例",
              })
            }
            className="mx-auto w-full max-w-xl cursor-zoom-in rounded-lg border border-line drop-shadow-2xl"
          />
        )}
      </div>

      {/* ==================== ライトボックス ==================== */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="画像の拡大表示"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          {/* 閉じるボタン */}
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-2xl leading-none text-white hover:bg-white/30"
          >
            ×
          </button>
          {/* 💡 縦長A4画像は高さ基準で画面内に収める（max-h-[90vh]） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
