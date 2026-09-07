import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記｜デンピストAI",
};

// ============================================================
// 特定商取引法に基づく表記（LP指示書 セクション11）
// 支払方法・支払時期／解約条件は 2026-09-07 に確定文へ差し替え済み。
// ============================================================

export default function LegalPage() {
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
            <dd className="mt-2 text-sm text-ink-soft">
              銀行振込（請求書払い）／利用開始月の末日締め、翌月末日までのお振込みとなります。
              <br />
              ※ご利用開始日は毎月1日です。無料トライアル終了後に本契約へ移行される場合、翌月1日からのご利用開始となります（トライアル終了日から当月末までは無料でご利用いただけます）。
            </dd>
          </div>
          <div>
            <dt className="font-bold">サービス提供時期</dt>
            <dd className="mt-2 text-sm text-ink-soft">
              お申し込み後、貴院専用の設定およびオンラインキックオフ（30分）完了後、ご利用開始となります。
            </dd>
          </div>
          <div>
            <dt className="font-bold">解約条件</dt>
            <dd className="mt-2 text-sm text-ink-soft">
              月払いの場合：解約のお申し出はいつでも可能です。お申し出いただいた月の翌月末をもって解約となり、それまでのご利用料金をお支払いいただきます。日割りによる精算・返金はございません。
              <br />
              年払いの場合：いつでも解約をお申し出いただけますが、割引を適用した年額プランのため、残期間分を含めご返金はございません。
              <br />
              ※無料トライアル期間中はいつでも解約でき、自動で課金・本契約へ移行されることはありません。
            </dd>
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
