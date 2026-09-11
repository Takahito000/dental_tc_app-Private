import CtaLink from "./cta-link";
import ReportGallery from "./report-gallery";
import Section2Background from "./section2-background";
import ViewFormTracker from "./view-form-tracker";

// 💡 OGP/Twitterカードのメタ情報は app/layout.tsx に集約（og:image は絶対URL指定）。
//    ページ側で openGraph を上書きすると相対パスが使われてしまうため、ここでは定義しない。

// ============================================================
// デンピストAI ランディングページ（LP作成指示書 セクション3の文言を厳守）
// 配色は globals.css の @theme カラー変数を使用（LP指示書 セクション2-1）
// ============================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-bold tracking-widest text-gold">{children}</p>
  );
}

function SerifHeading({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-serif-jp text-2xl font-bold leading-relaxed text-ink md:text-3xl ${className}`}
    >
      {children}
    </h2>
  );
}

export default function LandingPage() {
  // 💡 JSON-LD 構造化データ（SEO）。見た目には影響しない <script type="application/ld+json"> で出力する
  const jsonLdSoftwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "デンピストAI",
    applicationCategory: "BusinessApplication",
    description: "歯科医院向けAI自費カウンセリング支援ツール",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "JPY",
      lowPrice: "19800",
      highPrice: "39800",
      description:
        "税別・月額。無料トライアル4週間あり。モニタープラン19,800円/月（5ヶ月間限定）、スタンダードプラン39,800円/月",
    },
    provider: {
      "@type": "Organization",
      name: "CS.lab",
      url: "https://cs-lab.net",
    },
  };
  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "AIが診断や提案まで代行してくれますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "いいえ。デンピストAIが生成するのは、患者さまごとの選択肢の比較シートです。診断・治療方針の決定は歯科医師が行い、患者さまへの提案はスタッフが行います。AIは「選択肢を見える化する」役割に徹する設計です。",
        },
      },
      {
        "@type": "Question",
        name: "機器の導入は必要ですか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "不要です。インターネットに接続されたスマートフォン・タブレットまたはPCがあれば、そのままご利用いただけます。",
        },
      },
      {
        "@type": "Question",
        name: "患者さまの個人情報の取り扱いは？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "患者さまのお名前・連絡先などの個人情報は一切入力・保存されません。入力は治療方針に関する13項目の選択のみで、生成されるレポートには個人を特定できる情報が含まれません。個人情報保護法上の取り扱い負担はありません。",
        },
      },
      {
        "@type": "Question",
        name: "トライアル終了後、必ず有料プランになりますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "いいえ。継続のご判断はトライアル終了時にいただきます。自動で課金されることはありません。",
        },
      },
    ],
  };
  const jsonLdOrganization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CS.lab",
    url: "https://cs-lab.net",
  };

  return (
    <div className="text-ink">
      {/* 💡 申し込みフォーム表示のGA4計測（セッション中1回のみ） */}
      <ViewFormTracker />
      {/* 💡 構造化データ（検索エンジン向け。表示には影響しない） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdSoftwareApplication),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
      />
      {/* ==================== ヘッダー ==================== */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <a href="#top" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icon-lp.png" alt="デンピストAI" className="h-9 w-9" />
            <span className="whitespace-nowrap font-serif-jp text-lg font-bold tracking-wide">
              デンピストAI
            </span>
          </a>
          <CtaLink
            location="header"
            className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white md:px-5 md:text-sm"
          >
            <span className="sm:hidden">無料で試す</span>
            <span className="hidden sm:inline">
              無料トライアルに申し込む（4週間・無料）
            </span>
          </CtaLink>
        </div>
      </header>

      {/* ==================== セクション1：ファーストビュー ==================== */}
      <section id="top" className="bg-paper">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-12 md:pb-24 md:pt-20">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              {/* 💡 モバイルで4行に分裂しないよう、各行をnowrap＋モバイルのみ文字サイズ調整（PCは現行サイズ維持） */}
              <h1 className="font-serif-jp text-[2.5rem] font-bold leading-relaxed md:text-[3.4rem] md:leading-snug">
                <span className="whitespace-nowrap">治療の選択肢を、</span>
                <br />
                <span className="whitespace-nowrap text-gold">
                  患者さまの手に。
                </span>
              </h1>
              <p className="mt-6 leading-loose text-ink-soft">
                保険と自費、それぞれの選択肢とメリットを患者さま一人ひとりに合わせて比較できる説明シートを、AIがその場で生成。歯科衛生士のカウンセリングを、もっと自然に、もっと伝わる形に。
              </p>
              <div className="mt-8">
                <CtaLink
                  location="hero"
                  className="inline-block rounded-full bg-accent px-10 py-5 text-sm font-bold text-white shadow-sm"
                >
                  無料トライアルに申し込む（4週間・無料）
                </CtaLink>
                <p className="mt-4 text-xs text-ink-soft">
                  ※現在、モニター医院さまを募集しています
                </p>
              </div>
            </div>
            <div className="px-2 py-4 md:pl-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/report-sample.jpg"
                alt="AI客観分析レポートのサンプル"
                className="w-full rotate-2 rounded-lg border border-line drop-shadow-2xl md:rotate-1"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== セクション2：課題・共感 ==================== */}
      <section className="relative isolate overflow-hidden border-y border-line bg-tint">
        {/* 💡 背景動画＋半透明オーバーレイ（テキストは relative z-10 で最前面） */}
        <Section2Background />
        <div className="relative z-10 mx-auto max-w-3xl px-5 py-16 md:py-24">
          {/* 💡 モバイルで4行に分裂しないよう、各行をnowrap＋モバイルのみ文字サイズ調整（PCは現行サイズ維持） */}
          <h2 className="text-center font-serif-jp text-[1.2rem] font-bold leading-relaxed text-ink md:text-3xl">
            <span className="whitespace-nowrap">「高いものを勧めたい」んじゃない。</span>
            <br />
            <span className="whitespace-nowrap">「選択肢を届けたい」だけなのに。</span>
          </h2>
          <div className="mt-10 space-y-8 leading-loose">
            <p>
              義歯や被せ物の自費治療。価値があると分かっていても、提案には大きな心理的ハードルがあります。
            </p>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="mt-1 shrink-0 text-gold">■</span>
                <span>
                  <strong>「売り込み」と思われたくない</strong>
                  <span className="block text-ink-soft">
                    ——技術や知識の問題ではなく、感情が提案を止めている
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 shrink-0 text-gold">■</span>
                <span>
                  <strong>提案できるのが院長やベテランだけ</strong>
                  <span className="block text-ink-soft">
                    ——属人化していて、院長が不在の日は提案機会がゼロになる
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 shrink-0 text-gold">■</span>
                <span>
                  <strong>説明の質がスタッフによってばらつく</strong>
                  <span className="block text-ink-soft">
                    ——間違った知識や誇大な表現は、クレームや法規制のリスクにも
                  </span>
                </span>
              </li>
            </ul>
            <p>
              そして患者さま側にも問題があります。多くの患者さまは、保険と自費の違いを知らないまま、保険を「選ばされて」いる。選択肢の存在自体が、届いていません。
            </p>
            <p>
              保険診療は国が定めた標準的な医療として有効です。問題なのは保険ではなく、「選択肢を知らないまま決めている患者さまと、届け方を知らない医院」という構造です。
            </p>
          </div>
        </div>
      </section>

      {/* ==================== セクション3：プロダクト紹介＋生成物実例 ==================== */}
      <section className="bg-paper">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-24">
          <SectionLabel>PRODUCT</SectionLabel>
          <SerifHeading>
            デンピストAIは、患者さまごとの比較説明シートを、その場で生成します。
          </SerifHeading>
          <p className="mt-6 leading-loose text-ink-soft">
            問診とヒアリングに基づく13項目をタップで入力するだけで、その患者さまに合わせた治療選択肢の比較シートをAIが生成します。
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-7">
              <h3 className="font-serif-jp text-lg font-bold leading-relaxed">
                義歯カウンセリング
                <span className="mt-1 block text-sm font-bold text-gold">
                  ——高単価の成約を生む主力機能
                </span>
              </h3>
              <p className="mt-4 text-sm leading-loose text-ink-soft">
                「調整しても合わない」「痛くて噛めない」に悩む患者さまに、保険と精密義歯の違いを中立に提示。1件の成約が大きな成果になる、利益の柱です。
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white p-7">
              <h3 className="font-serif-jp text-lg font-bold leading-relaxed">
                クラウンカウンセリング
                <span className="mt-1 block text-sm font-bold text-gold">
                  ——毎日の診療で使える頻度の柱
                </span>
              </h3>
              <p className="mt-4 text-sm leading-loose text-ink-soft">
                被せ物は補綴の中で最も頻度の高い処置です。「銀歯のままでいいか」を迷う患者さまに毎日届けられるため、ツールが医院の業務フローに定着します。
              </p>
            </div>
          </div>
          <p className="mt-8 leading-loose">
            クラウンが毎日の接点を作り、義歯が成果を最大化する。この2枚構造だから、保険メインの医院さまでも導入する意味があります。
          </p>

          <figure className="mt-12">
            <ReportGallery />
            <figcaption className="mt-4 text-center text-sm leading-loose text-ink-soft">
              実際の生成例。患者さまの感情や口腔内の状態に合わせて、毎回オリジナルのシートが作成されます。
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ==================== セクション3.5：思想（CONCEPT） ==================== */}
      {/* 💡 このページで唯一の暗色セクション（bg-accent）。装飾は既存セクションと同じ SectionLabel のみ */}
      <section className="bg-accent">
        <div className="mx-auto max-w-5xl px-5 py-20 md:py-32">
          <SectionLabel>CONCEPT</SectionLabel>
          <h2 className="font-serif-jp text-2xl font-bold leading-relaxed text-paper md:text-4xl">
            AIは、選択肢を可視化する。寄り添うのは、人。
          </h2>
          <div className="mt-8 max-w-2xl space-y-6 leading-loose text-paper/90 md:mt-10">
            <p>
              デンピストAIの役割は、患者さまごとの選択肢を中立な一枚のシートにすることまで。
            </p>
            <p>
              シートを手に、患者さまに寄り添って伝えるのは、スタッフの皆さま。
              <br />
              口腔内を診て、医学的な判断を担うのは、先生。
              <br />
              そして選ぶのは、患者さま自身です。
            </p>
            <p>
              使い続けるほどに、医院の中で「選択肢を届ける」という
              <br />
              仕組みそのものが育っていく。
              <br />
              デンピストAIは、カウンセリングの力を、医院に残すツールです。
            </p>
          </div>
        </div>
      </section>

      {/* ==================== セクション4：特徴3点 ==================== */}
      <section className="border-y border-line bg-tint">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-24">
          <SectionLabel>FEATURES</SectionLabel>
          <SerifHeading>選ばれる3つの理由</SerifHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                no: "01",
                title: "13項目をタップするだけ",
                body: "入力は選択式の13項目。文章を打つ必要はありません。診療の合間に、その場で生成できます。",
              },
              {
                no: "02",
                title: "患者さまに「選択肢」を届ける設計",
                body: "自費治療を押し売りするためのシートではありません。保険・自費それぞれの特徴を並べ、患者さま自身が納得して選ぶための材料を提供します。",
              },
              {
                no: "03",
                title: "準備時間はゼロ、個人情報の登録もゼロ",
                body: "専用の資料作成も、事前の勉強会も不要。患者さまの個人情報を入力する欄は存在しないため、情報管理の負担も生じません。アカウント発行後、その日の診療から使えます。",
              },
            ].map((f) => (
              <div key={f.no} className="rounded-xl border border-line bg-white p-7">
                <p className="font-serif-jp text-2xl font-bold text-gold">{f.no}</p>
                <h3 className="mt-3 font-bold leading-relaxed">{f.title}</h3>
                <p className="mt-3 text-sm leading-loose text-ink-soft">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== セクション5：導入フロー ==================== */}
      <section className="bg-paper">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-24">
          <SectionLabel>FLOW</SectionLabel>
          <SerifHeading>導入は、3ステップ。</SerifHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "STEP 1",
                title: "お申し込み",
                body: "下記フォームから、必要事項をご入力ください（1分）",
              },
              {
                step: "STEP 2",
                title: "はじめの30分だけ、オンラインでご一緒します",
                body: "貴院専用の設定は、こちらで済ませてお渡しします。30分は設定作業ではありません。使い方のご説明と、『提案への心理的ブロックがあるのは、当たり前のことです。でも、選択肢を届けることこそ、患者さまへのホスピタリティではないでしょうか』——監修の歯科衛生士の考え方をお伝えするキックオフです。あとはスタッフさまだけでお使いいただけます。",
              },
              {
                step: "STEP 3",
                title: "その日の診療から",
                body: "設定完了後は、いつでも、何度でも。シートの生成に制限はありません。",
              },
            ].map((s) => (
              <div key={s.step} className="relative rounded-xl border border-line bg-white p-7">
                <p className="text-xs font-bold tracking-widest text-gold">{s.step}</p>
                <h3 className="mt-2 font-bold leading-relaxed">{s.title}</h3>
                <p className="mt-3 text-sm leading-loose text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== セクション6：監修者紹介 ==================== */}
      <section className="border-y border-line bg-tint">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-24">
          <SectionLabel>SUPERVISOR</SectionLabel>
          <SerifHeading>監修者紹介</SerifHeading>

          {/* PC（md以上）は2カラム：左=写真、右=名前行・実績カード・プロフィール・経歴。
              モバイルは縦積み＋実績カードを2段グリッド（2枚＋1枚）に抑えた構成 */}
          <div className="mt-10 grid items-start gap-8 md:grid-cols-[1fr_2fr] md:gap-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/supervisor.jpg"
              alt="監修者 山岸雪乃（歯科衛生士）"
              className="mx-auto w-40 rounded-xl border border-line object-cover md:w-full"
            />
            <div>
              <p className="text-center font-serif-jp text-xl font-bold md:text-left">
                <span className="mr-1 text-base font-bold text-accent">監修｜</span>
                山岸 雪乃（<span className="font-bold text-accent">副院長</span> / 歯科衛生士）
              </p>
              <p className="mt-2 text-center text-sm text-ink-soft md:text-left">
                自費義歯専門 歯科クリニック 副院長
                <br />
                一般社団法人日本歯科TC協会 北海道支部 理事
              </p>

              {/* 実績ハイライト：モバイルは2段グリッド（1段目2枚・2段目自費受注のみ全幅）。
                  カードの余白と数値フォントはモバイルのみ1段階縮小。PCは現行の3横並びを維持 */}
              <div className="mt-5 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-[1fr_1fr_1.3fr] md:gap-4">
                {[
                  { label: "臨床経験", value: "15年目" },
                  { label: "カウンセリング実績", value: "772人" },
                  { label: "自費受注", value: "年間2億円ペース" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border border-line bg-white p-4 text-center md:p-6 ${
                      s.label === "自費受注" ? "col-span-2 md:col-span-1" : ""
                    }`}
                  >
                    <p className="text-xs font-bold tracking-widest text-ink-soft">
                      {s.label}
                    </p>
                    <p className="mt-2 font-serif-jp text-xl font-bold text-accent md:text-2xl">
                      {s.value}
                    </p>
                    {s.label === "カウンセリング実績" && (
                      <p className="mt-1 text-xs text-ink-soft">（4年間）</p>
                    )}
                    {s.label === "自費受注" && (
                      <p className="mt-1 text-xs text-ink-soft">を継続</p>
                    )}
                  </div>
                ))}
              </div>

              {/* プロフィール文 */}
              <p className="mt-6 text-sm leading-loose md:mt-8">
                <span className="font-bold text-accent">副院長</span>
                として、自費義歯専門の歯科クリニックでカウンセリングと組織運営を牽引。自費義歯の受注は2023年より年間2億円ペースを継続し、カウンセリング実績は4年間で772人。2022年より歯科衛生士・TC向けセミナー（TC北海道支部オンラインセミナー、TC関東支部バトンリレーセミナー等）に登壇。京都の歯科医院では単独講師としてカウンセリング実践セミナーを担当するなど、その実践知を全国の歯科医療従事者に共有している。
              </p>

              {/* 経歴・メディア */}
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft md:mt-6">
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-gold">・</span>
                  <span>JADTC 認定トリートメントコーディネーターMaster</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-gold">・</span>
                  <span>
                    専門誌「デンタルハイジーン」（医歯薬出版）取材掲載（Vol.40 No.5、Vol.41 No.6）
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-gold">・</span>
                  <span>歯科衛生士・TC向けセミナー登壇（2022年〜）</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 本人メッセージ（引用ブロック）：セクション全幅で2カラムの下に配置（変更なし） */}

          {/* 本人メッセージ（引用ブロック） */}
          <blockquote className="mt-10 rounded-xl border border-line bg-white p-8 leading-loose md:p-10">
            <p>
              カウンセリングの現場でずっと感じていたのは、『伝えたいのに、伝わらない』というもどかしさでした。自費の提案に躊躇してしまうのは、売り込みたくないという優しさの裏返しです。でも、選択肢を知らないまま決めてしまう患者さんを何度も見てきました。伝えることを、仕組みに変えたい。デンピストAIには、私が現場で培ってきたカウンセリングの型をすべて込めています。
            </p>
            <p className="mt-6">
              大事にしたいのは、このツールがカウンセリングの「代わり」にならないことです。シートを使いながら、スタッフが患者さまに提案を重ねていく。その積み重ねが、その医院ならではのカウンセリングの仕組みを育てます。患者さまの選択肢を広げることが、医院にも、スタッフにも、良いことだと信じています。
            </p>
            {/* 💡 メッセージ〜署名の間隔はモバイルのみ1段階詰める */}
            <p className="mt-3 text-right font-bold md:mt-6">―― 山岸 雪乃</p>
          </blockquote>
        </div>
      </section>

      {/* ==================== セクション7：推薦の声 ==================== */}
      <section className="bg-paper">
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-24">
          <SectionLabel>VOICE</SectionLabel>
          <SerifHeading>推薦の声</SerifHeading>
          {/* 💡 差し替え時の分量変動を吸収するため、固定高さを持たない可変レイアウト */}
          {/* 💡 レイアウト切り替え箇所：推薦者が複数になった場合は、
              下記の2カラム構成をやめて推薦文を全幅にし、写真＋署名を
              「h-16 w-16 rounded-full」の小さいアイコン式に戻す
              （差し替え前の記述：
              <div className="mt-8 flex items-center justify-end gap-4">
                <div className="text-right">
                  <p className="font-bold">…署名…</p>
                  <img className="mt-2 ml-auto h-16 w-16 rounded-full border border-line object-cover" />
                </div>
              </div> ） */}
          <blockquote className="mt-10 rounded-xl border border-line bg-white p-8 leading-loose md:p-10">
            {/* 2カラム：左=推薦文、右=写真＋署名。モバイルは縦積み（写真→本文） */}
            <div className="flex flex-col-reverse gap-8 md:flex-row md:gap-10">
              {/* 💡 コメントが長いためフォントサイズを現行の約80%に縮小（肩書・署名のサイズは変更しない） */}
              <div className="text-[0.8rem] md:flex-1">
                <p>
                  “患者さんに寄り添う”
                  <br />
                  “患者さんとご家族に笑顔で暮らしてほしい”
                  <br />
                  山岸雪乃さんを思う時に真っ先に浮かぶ言葉です。
                </p>
                <p className="mt-6">
                  山岸さんと出会って8年半。
                  <br />
                  日々の診療の中で患者さんと向き合い、歯科衛生士主任となり、更に責任ある立場でスタッフをまとめ、院長との架け橋を務める。
                  <br />
                  一般社団法人日本歯科TC協会が目指すトリートメントコーディネーターを体現している方です。
                </p>
                <p className="mt-6">
                  日本でも稀有な入れ歯専門歯科医院での実践経験を惜しみなく提供し、自費の提案に躊躇してしまう歯科医療従事者の方々の背中を押してくれるツールが誕生した事を誇らしく、大変嬉しく思います。
                </p>
                <p className="mt-6">
                  心を寄せる“本物”のカウンセリング。
                </p>
                <p className="mt-6">
                  益々のご活躍を祈念するとともに、愛されるTC（トリートメントコーディネーター）である山岸さんを心から応援しています。
                </p>
              </div>
              {/* 右カラム：カラム自体を内容幅（w-max）にし、写真と署名の中央軸を一致させる */}
              <div className="mx-auto w-max shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/recommender.jpg"
                  alt="推薦者の写真"
                  className="mx-auto aspect-[4/5] w-40 rounded-lg border border-line object-cover drop-shadow-2xl md:w-48"
                />
                {/* 💡 署名は内容幅いっぱい（w-full）で text-center。nowrapの肩書より広いカラム幅が確保されるため中央からのはみ出しなし */}
                <p className="mt-4 w-full text-center text-sm font-bold leading-relaxed">
                  <span className="whitespace-nowrap">
                    一般社団法人日本歯科TC協会 理事
                  </span>
                  <br />
                  北海道支部長
                  <br />
                  フィアーズ 多希子
                </p>
              </div>
            </div>
          </blockquote>
          <p className="mt-4 text-xs text-ink-soft">
            ※個人の立場からいただいた推薦文です
          </p>
        </div>
      </section>

      {/* ==================== セクション8：料金 ==================== */}
      <section className="border-y border-line bg-tint">
        <div className="mx-auto max-w-4xl px-5 py-16 md:py-24">
          <SectionLabel>PRICE</SectionLabel>
          <SerifHeading>料金プラン</SerifHeading>

          <div className="mt-10 rounded-xl border border-gold/40 bg-white p-7">
            <h3 className="font-bold">費用対効果について</h3>
            {/* 💡 試算例グラフ（HTML/CSSのみ・画像不使用。バーはフラット矩形、数字は明朝系フォント） */}
            <h4 className="mt-4 text-sm font-bold text-ink">
              試算例：月に1件ずつ成約した場合
            </h4>
            {/* 💡 内訳（控えめ・バーなし）。合計と月額の対比が視覚的な主役 */}
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              <span className="font-serif-jp">義歯 1件成約 約150,000円</span>
              <span className="mx-1.5 text-gold">＋</span>
              <br className="sm:hidden" />
              <span className="font-serif-jp">クラウン 1件成約 約100,000円〜</span>
            </p>
            <div className="mt-4 space-y-3">
              {/* 合計（最長・ゴールド） */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="w-24 shrink-0 text-xs font-bold text-ink sm:w-28 sm:text-sm">
                  合計
                </span>
                <div className="h-2.5 min-w-4 flex-1 bg-line">
                  <div className="h-full bg-gold" style={{ width: "100%" }} />
                </div>
                <span className="shrink-0 whitespace-nowrap font-serif-jp text-xs font-bold text-ink sm:text-sm">
                  約250,000円〜
                </span>
              </div>
              {/* 月額費用（全長は合計と同じ。うちネイビー部分が16%・ダークネイビー系） */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="w-24 shrink-0 text-xs font-bold text-ink sm:w-28 sm:text-sm">
                  月額費用
                </span>
                <div className="h-2.5 min-w-4 flex-1 bg-line">
                  <div className="h-full bg-ink-soft" style={{ width: "16%" }} />
                </div>
                <span className="shrink-0 whitespace-nowrap font-serif-jp text-xs font-bold text-ink sm:text-sm">
                  39,800円<span className="text-[10px] font-normal text-ink-soft">（税別）</span>
                </span>
              </div>
            </div>
            {/* 注記 */}
            <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
              ※片顎の場合の試算です。医院の設定価格により異なります
              <br />
              ※成約を保証するものではありません
            </p>
            {/* 補足文 */}
            <p className="mt-4 text-sm font-bold leading-relaxed text-ink">
              月に1件ずつの成約で、費用を大きく上回るリターンが見込めます。
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-paper text-left">
                  <th className="border-b border-ink px-4 py-3 font-bold">プラン</th>
                  <th className="border-b border-ink px-4 py-3 font-bold">料金</th>
                  <th className="border-b border-ink px-4 py-3 font-bold">期間・条件</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    plan: "トライアルプラン",
                    price: "無料",
                    cond: "4週間限定。継続利用の場合はモニタープランへのお申し込みが必要です",
                  },
                  {
                    plan: "スタンダードプラン（モニター）",
                    price: "19,800円／月",
                    cond: "5ヶ月間限定。簡単なフィードバックへのご協力をお願いします",
                    highlight: true,
                  },
                  {
                    plan: "スタンダードプラン（月払い）",
                    price: "39,800円／月",
                    cond: "制限なし",
                  },
                  {
                    plan: "スタンダードプラン（年払い）",
                    price: "398,000円／年",
                    cond: "月換算で約2ヶ月分お得",
                  },
                ].map((row, i) => (
                  <tr
                    key={row.plan}
                    className={
                      "highlight" in row && row.highlight
                        ? "bg-accent-tint"
                        : i % 2 === 1
                          ? "bg-paper/60"
                          : ""
                    }
                  >
                    <td className="border-b border-line px-4 py-4 font-bold align-top">
                      {row.plan}
                      {"highlight" in row && row.highlight && (
                        <span className="ml-2 inline-block rounded-full border border-gold px-2 py-0.5 align-middle text-[10px] font-bold tracking-wider text-gold">
                          おすすめ
                        </span>
                      )}
                    </td>
                    <td
                      className="border-b border-line px-4 py-4 align-top font-bold whitespace-nowrap text-accent"
                    >
                      {row.price}
                    </td>
                    <td className="border-b border-line px-4 py-4 leading-relaxed text-ink-soft align-top">
                      {row.cond}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 space-y-2 text-xs leading-relaxed text-ink-soft">
            <li>※価格はすべて税別です</li>
            <li>※トライアル期間終了後、自動で課金・移行されることはありません</li>
            <li>
              ※モニター医院さまは随時募集しています。義歯・クラウンの相談機会が月数件の医院さまでも効果をご実感いただけるよう、トライアルと合わせて約6ヶ月の期間をご用意しています
            </li>
            <li>
              ※年払いプランは割引を適用しているため、途中解約の場合もご返金はいたしかねます
            </li>
            <li>
              ※月払いプランの解約は、お申し出いただいた月の翌月末の適用となります
            </li>
          </ul>
        </div>
      </section>

      {/* ==================== セクション9：FAQ ==================== */}
      <section className="bg-paper">
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-24">
          <SectionLabel>FAQ</SectionLabel>
          <SerifHeading>よくあるご質問</SerifHeading>
          <dl className="mt-10 space-y-6">
            {[
              {
                q: "AIが診断や提案まで代行してくれますか？",
                a: "いいえ。デンピストAIが生成するのは、患者さまごとの選択肢の比較シートです。診断・治療方針の決定は歯科医師が行い、患者さまへの提案はスタッフが行います。AIは「選択肢を見える化する」役割に徹する設計です。",
              },
              {
                q: "機器の導入は必要ですか？",
                a: "不要です。インターネットに接続されたスマートフォン・タブレットまたはPCがあれば、そのままご利用いただけます。",
              },
              {
                q: "患者さまの個人情報の取り扱いは？",
                a: "患者さまのお名前・連絡先などの個人情報は一切入力・保存されません。入力は治療方針に関する13項目の選択のみで、生成されるレポートには個人を特定できる情報が含まれません。個人情報保護法上の取り扱い負担はありません。",
              },
              {
                q: "トライアル終了後、必ず有料プランになりますか？",
                a: "いいえ。継続のご判断はトライアル終了時にいただきます。自動で課金されることはありません。",
              },
              {
                q: "スタッフの入れ替わりがあっても使えますか？",
                a: "はい。操作は13項目のタップのみで、専門知識は不要です。",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-line bg-white p-6"
              >
                <dt className="font-bold leading-relaxed">
                  <span className="mr-2 text-gold">Q.</span>
                  {item.q}
                </dt>
                <dd className="mt-3 text-sm leading-loose text-ink-soft">
                  <span className="mr-2 font-bold text-ink">A.</span>
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ==================== セクション10：申し込み ==================== */}
      {/* 💡 視線誘導：アクセントカラー（茶・ゴールド系）の背景に、見出し・本文はpaper系の色 */}
      <section id="apply" className="bg-gold">
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-24">
          <p className="mb-3 text-sm font-bold tracking-widest text-paper/80">
            TRIAL
          </p>
          <h2 className="font-serif-jp text-2xl font-bold leading-relaxed text-paper md:text-3xl">
            まずは4週間、無料でお試しください
          </h2>
          <p className="mt-6 leading-loose text-paper/90">
            下記フォームからお申し込みください。内容を確認後、こちらからご連絡し、貴院専用の設定を行った上で、オンラインキックオフ（30分）の日程をご相談させていただきます。
          </p>
          {/* 💡 Notionフォームのiframe埋め込み（埋め込みコード指定どおり） */}
          <iframe
            src="https://cs-lab2024.notion.site/ebd//3d3cffab5ad080758b5af046d4205ad7"
            title="無料トライアル申し込みフォーム"
            loading="lazy"
            allowFullScreen
            className="mt-10 h-[600px] w-full rounded-xl border border-line bg-white"
          />
        </div>
      </section>

      {/* ==================== 全ページ共通の但し書き ==================== */}
      <div className="bg-paper">
        <p className="mx-auto max-w-3xl px-5 py-8 text-[11px] leading-relaxed text-ink-soft">
          ※本ツールは歯科医師・歯科衛生士による患者さまへの説明を補助するものであり、疾病の診断、治療又は予防に使用されることを目的としていません。診断および治療方針の決定、法令遵守の最終責任は医療機関に帰属します
        </p>
      </div>

      {/* ==================== セクション11：フッター ==================== */}
      <footer className="border-t border-line bg-tint">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/icon-lp.png" alt="デンピストAI" className="h-8 w-8" />
              <div>
                <p className="font-serif-jp font-bold">デンピストAI（Dentpist AI）</p>
                <p className="text-xs text-ink-soft">運営：CS.lab（山岸貴仁）</p>
              </div>
            </div>
            <nav className="flex gap-6 text-xs text-ink-soft">
              <a href="/privacy" className="underline hover:text-ink">
                プライバシーポリシー
              </a>
              <a href="/legal" className="underline hover:text-ink">
                特定商取引法に基づく表記
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
