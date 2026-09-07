"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

// ============================================================
// GA4 計測スクリプト（LP側ページのみ計測対象）
// - ツール本体（/app）は計測対象外のためスクリプトを出力しない
// ============================================================

const GA4_MEASUREMENT_ID = "G-3MKSNPLYH6";

export default function Ga4Script() {
  const pathname = usePathname();

  // 💡 ツール本体は計測対象外（LP・プライバシーポリシー・特商法のみ計測）
  if (pathname === "/app") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
