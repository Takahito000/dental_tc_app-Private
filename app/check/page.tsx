import { Suspense } from "react";
import type { Metadata } from "next";
import CheckClient from "./check-client";

// ============================================================
// 自費提案 組織力チェック（/check）
// - SNS直リンク用の専用OGP
// - ツール本体（/app）とは無関係。index対象（robots.ts は /app のみ disallow）
// ============================================================

const TITLE = "自費の選択肢、届いていますか？｜8問の組織チェック";
const DESCRIPTION =
  "8問・約2分で、貴院の組織タイプと見込み利益を判定します。";
const SITE_URL = "https://denpist-ai.com";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/check` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/check`,
    siteName: "デンピストAI",
    images: [{ url: `${SITE_URL}/images/ogp.jpg`, width: 1200, height: 630 }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function CheckPage() {
  return (
    <Suspense fallback={null}>
      <CheckClient />
    </Suspense>
  );
}
