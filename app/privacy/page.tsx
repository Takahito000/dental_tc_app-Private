import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜デンピストAI",
};

// ============================================================
// プライバシーポリシー（LP指示書 セクション11）
// 個人情報を収集しない旨を明記した簡易版。
// 文案は実装前に運営者の確認を受けたもの。
// ============================================================

export default function PrivacyPage() {
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
        <h1 className="font-serif-jp text-2xl font-bold">
          プライバシーポリシー
        </h1>

        <section className="mt-10">
          <h2 className="font-bold">■ 収集する情報について</h2>
          <p className="mt-3 text-sm text-ink-soft">
            本ツール（デンピストAI）では、患者さまのお名前・連絡先等の個人情報を入力・保存する欄はありません。治療方針に関する13項目の選択内容および生成されたシートは、個人を特定できる情報を一切含みません。これらの情報は保存されません。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-bold">
            ■ お申し込みフォームでいただく情報について
          </h2>
          <p className="mt-3 text-sm text-ink-soft">
            トライアルお申し込みフォームにてご入力いただく医院名・ご担当者名・メールアドレス等の情報は、トライアルの運営、ご連絡、およびサービス提供のためにのみ利用いたします。法令に基づく場合を除き、第三者へ提供いたしません。なお、フォームにはNotion（Notion Labs, Inc.）を利用しており、ご入力情報は同社のプライバシーポリシーに基づき管理されます。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-bold">■ アクセス解析について</h2>
          <p className="mt-3 text-sm text-ink-soft">
            本サイトではGoogle Analyticsを利用し、Cookieを通じて匿名のアクセス情報を収集しています。個人を特定する情報は含まれません。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-bold">■ 情報の管理</h2>
          <p className="mt-3 text-sm text-ink-soft">
            ご入力いただいた情報の管理は、運営者（CS.lab／以下「当方」）が責任を持って適切に行います。情報の開示・訂正・削除をご希望の場合は、お問い合わせフォームよりご請求ください。
          </p>
        </section>
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
            <a href="/legal" className="underline hover:text-ink">
              特定商取引法に基づく表記
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
