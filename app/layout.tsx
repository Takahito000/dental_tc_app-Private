import "./globals.css";
import { Noto_Sans_JP } from "next/font/google";

// 💡 高級感・高齢患者の視認性のため、Noto Sans JP をアプリ全体の基準フォントに統一
//    （next/font はビルド時にフォントを自前ホスティングするため、PDF生成（html-to-image）にも埋め込まれる）
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata = {
  title: "デンピストAI｜AI自費義歯カウンセリング支援",
  description: "Denpist AI — 歯科衛生士のための自費義歯カウンセリング支援ツール",
  // 💡 PWA化: iOSでホーム画面に追加した際にアプリとして起動させる
  appleWebApp: { capable: true, statusBarStyle: "default", title: "デンピストAI" },
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
        className={`${notoSansJP.className} min-h-screen bg-slate-100 antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
