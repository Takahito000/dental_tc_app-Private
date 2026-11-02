import type { Metadata } from "next";
import TermsContent from "./terms-content";

export const metadata: Metadata = {
  title: "利用規約｜デンピストAI",
};

// ============================================================
// デンピストAI 利用規約 v1.0（/terms）
// - 掲載文案は KC-063 承認テキストを TermsContent コンポーネントにそのまま掲載
// - 付則の問い合わせフォームは kimishika と同一のフォーム（別タブ）へリンク
// ============================================================

export default function TermsPage() {
  return (
    <div className="text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-3">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icon-lp.png" alt="デンピストAI" className="h-9 w-9" />
            <span className="font-serif-jp text-lg font-bold tracking-wide">
              デンピストAI
            </span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 leading-loose">
        <h1 className="font-serif-jp text-2xl font-bold">デンピストAI 利用規約</h1>
        <div className="mt-8">
          <TermsContent />
        </div>
      </main>

      <footer className="border-t border-line bg-tint">
        <div className="mx-auto max-w-3xl px-5 py-8 text-xs text-ink-soft">
          <p>デンピストAI（Dentpist AI）</p>
          <p className="mt-1">運営：CS.lab（山岸貴仁）</p>
          <nav className="mt-4 flex gap-6">
            <a href="/" className="underline hover:text-ink">
              トップページ
            </a>
            <a href="/privacy" className="underline hover:text-ink">
              プライバシーポリシー
            </a>
            <a href="/legal" className="underline hover:text-ink">
              特定商取引法に基づく表記
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
