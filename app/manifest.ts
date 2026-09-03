import type { MetadataRoute } from "next";

// 💡 PWA化: スマホの「ホーム画面に追加」でアプリ化するためのマニフェスト
//    トークンは localStorage に保存済みのため、start_url が "/app" でも
//    起動時に自動復元される（Android）。iOSは追加時に開いていたURLが保持されるため、
//    「トークン付きURLを開いたままホーム画面に追加」する運用案内とセットで機能する。
//    ※LP新設（ツール本体は /app に退避）に伴い start_url を /app に変更
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI自費義歯カウンセリング支援",
    short_name: "デンピストAI",
    description: "歯科衛生士のためのAIカウンセリングシート生成ツール",
    start_url: "/app",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
