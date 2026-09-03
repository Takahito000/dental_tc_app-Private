import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記｜デンピストAI",
};

// ============================================================
// 特定商取引法に基づく表記（LP指示書 セクション11）
// 【後で追記】箇所は指示書どおりプレースホルダーのまま。
// ============================================================

export default function LegalPage() {
  return (
    <div className="text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-3">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="デンピストAI" className="h-9 w-9" />
            <span className="font-serif-jp text-lg font-bold tracking-wide">
              デンピストAI
            </span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 leading-loose">
        <h1 className="font-serif-jp text-2xl font-bold">
          特定商取引法に基づく表記
        </h1>

        <dl className="mt-10 space-y-8">
          <div>
            <dt className="font-bold">販売業者</dt>
            <dd className="mt-2 text-sm text-ink-soft">
              CS.lab（山岸貴仁）
            </dd>
          </div>
          <div>
            <dt className="font-bold">所在地・電話番号</dt>
            <dd className="mt-2 text-sm text-ink-soft">
              ご請求をいただければ遅滞なく開示いたします（お問い合わせフォームよりご請求ください）
            </dd>
          </div>
          <div>
            <dt className="font-bold">販売価格</dt>
            <dd className="mt-2 text-sm text-ink-soft">
              料金プランページに記載（税別）
            </dd>
          </div>
          <div>
            <dt className="font-bold">支払方法・支払時期</dt>
            <dd className="mt-2 text-sm text-ink-soft">【後で追記】</dd>
          </div>
          <div>
            <dt className="font-bold">サービス提供時期</dt>
            <dd className="mt-2 text-sm text-ink-soft">
              お申し込み後、オンラインでの初期設定完了後
            </dd>
          </div>
          <div>
            <dt className="font-bold">解約条件</dt>
            <dd className="mt-2 text-sm text-ink-soft">【後で追記】</dd>
          </div>
        </dl>
      </main>

      {/* ==================== 全ページ共通の但し書き ==================== */}
      <p className="mx-auto max-w-3xl px-5 py-8 text-[11px] leading-relaxed text-ink-soft">
        ※本ツールは歯科医師・歯科衛生士による患者さまへの説明を補助するものであり、疾病の診断、治療又は予防に使用されることを目的としていません。診断および治療方針の決定、法令遵守の最終責任は医療機関に帰属します
      </p>

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
          </nav>
        </div>
      </footer>
    </div>
  );
}
