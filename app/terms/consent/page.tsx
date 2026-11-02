import { Suspense } from "react";
import TermsConsentClient from "./consent-client";

// ============================================================
// 利用規約 同意画面（/terms/consent）— server エントリ
// useSearchParams を使う client 本体を Suspense で包む（/app/logs と同運用）
// ============================================================

export default function TermsConsentPage() {
  return (
    <Suspense fallback={null}>
      <TermsConsentClient />
    </Suspense>
  );
}
