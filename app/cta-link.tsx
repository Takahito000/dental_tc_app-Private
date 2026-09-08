"use client";

// ============================================================
// LPのCTAボタン共通コンポーネント
// - 申し込みセクション（#apply）への誘導リンク
// - クリック時にGA4イベント click_trial を発火（window.gtag 未定義でもエラーにならない）
// ============================================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function CtaLink({
  location,
  className,
  children,
}: {
  /** ボタンの場所を識別する文字列（例: header / hero） */
  location: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="#apply"
      className={className}
      onClick={() => window.gtag?.("event", "click_trial", { location })}
    >
      {children}
    </a>
  );
}
