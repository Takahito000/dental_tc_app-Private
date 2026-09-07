import "./globals.css";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import Ga4Script from "./ga4-script";

// 💡 高級感・高齢患者の視認性のため、Noto Sans JP をアプリ全体の基準フォントに統一
//    （next/font はビルド時にフォントを自前ホスティングするため、PDF生成（html-to-image）にも埋め込まれる）
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// 💡 シートのタイトル・見出し用の明朝体（2026-08-27 デザイン刷新）
//    next/font 経由で自前ホスティング＋CSS変数化し、PDF生成にも確実に埋め込む
const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-serif-jp",
  display: "swap",
});

// 💡 LP指示書 セクション6: SEO・メタ情報（ツール本体 /app は noindex を app/app/layout.tsx で上書き）
export const metadata = {
  title: "デンピストAI｜治療の選択肢を、患者さまの手に。",
  description:
    "保険と自費の選択肢を患者さま一人ひとりに合わせて比較できる説明シートをAIが生成。歯科医院のためのカウンセリング支援ツール。13項目のタップだけで、その日の診療から使えます。",
  // 💡 PWA化: iOSでホーム画面に追加した際にアプリとして起動させる
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "デンピストAI",
  },
};

// 💡 PWA化: ブラウザのテーマカラー（アプリヘッダーの紺色に合わせる）
export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${notoSansJP.className} ${notoSerifJP.variable} min-h-screen bg-bg antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Ga4Script />
      </body>
    </html>
  );
}
