import type { Metadata } from "next";

// 💡 ツール本体（/app）は検索エンジンに索引させない（LP指示書 セクション6）
export const metadata: Metadata = {
  title: "デンピストAI｜ツール",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
