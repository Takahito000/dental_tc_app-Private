"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TermsContent from "../terms-content";

// ============================================================
// 同意画面のクライアント本体（page.tsx は Suspense 包みの server コンポーネント）
// ============================================================

// ============================================================
// 利用規約 同意画面（/terms/consent）
// - 未同意の医院トークンでツール本体等にアクセスした場合、middleware から
//   本画面へ強制遷移される（サーバ側ガード。クライアント側のみの制御は禁止）
// - 「同意して利用を開始する」押下で /api/terms/consent へ記録（冪等）
//   → 元のアクセス先（next）またはツール本体へ遷移
// - 既に同意済みのトークンが来た場合はツール本体へリダイレクトする
// - ボタン名「同意して利用を開始する」は kimishika側の案内メールでも使用するため厳密に一致させること
// ============================================================

export default function TermsConsentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<"loading" | "consent" | "notoken" | "error">(
    "loading"
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // next は同一オリジンのパスのみ許可（オープンリダイレクト対策）
  const rawNext = searchParams.get("next") || "";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

  useEffect(() => {
    const urlToken = searchParams.get("t") || "";
    const savedToken = localStorage.getItem("clinic_access_token") || "";
    let cookieToken = "";
    try {
      cookieToken =
        decodeURIComponent(
          document.cookie.match(/(?:^|;\s*)clinic_access_token=([^;]*)/)?.[1] ||
            ""
        ) || "";
    } catch {
      cookieToken =
        document.cookie.match(/(?:^|;\s*)clinic_access_token=([^;]*)/)?.[1] ||
        "";
    }
    const activeToken = urlToken || savedToken || cookieToken;
    if (!activeToken) {
      setPhase("notoken");
      return;
    }
    setToken(activeToken);
    localStorage.setItem("clinic_access_token", activeToken);
    document.cookie = `clinic_access_token=${encodeURIComponent(activeToken)}; max-age=31536000; path=/; SameSite=Lax; Secure`;

    // 既に同意済みならツール本体へリダイレクトする
    fetch(`/api/terms/consent?t=${encodeURIComponent(activeToken)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.consented) {
          router.replace(nextPath || `/app?t=${encodeURIComponent(activeToken)}`);
          return;
        }
        setPhase("consent");
      })
      .catch(() => setPhase("consent"));
  }, [searchParams, router, nextPath]);

  const handleAgree = async () => {
    if (submitting || !token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/terms/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(nextPath || `/app?t=${encodeURIComponent(token)}`);
      } else {
        setSubmitError(data.error || "同意の記録に失敗しました。");
        setSubmitting(false);
      }
    } catch {
      setSubmitError("通信エラーが発生しました。もう一度お試しください。");
      setSubmitting(false);
    }
  };

  return (
    <div className="text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-3">
          <span className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icon-lp.png" alt="デンピストAI" className="h-9 w-9" />
            <span className="font-serif-jp text-lg font-bold tracking-wide">
              デンピストAI
            </span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 leading-loose">
        <h1 className="font-serif-jp text-2xl font-bold">利用規約への同意</h1>

        {phase === "loading" && (
          <p className="mt-8 text-sm text-ink-soft">読み込み中...</p>
        )}

        {phase === "notoken" && (
          <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            医院トークンが確認できません。
            <br />
            医院専用のURL（?t= 付き）から再度アクセスしてください。
          </div>
        )}

        {phase === "consent" && (
          <>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <b>デンピストAIのご利用には、利用規約への同意が必要です。</b>
              <br />
              以下の利用規約をご確認の上、「同意して利用を開始する」ボタンを押してください。
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block font-bold text-accent underline underline-offset-2"
              >
                利用規約を別タブで開く
              </a>
            </div>

            {/* 規約全文（スクロール表示） */}
            <div className="mt-6 max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-paper p-5">
              <TermsContent />
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleAgree}
                disabled={submitting}
                className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? "送信中..." : "同意して利用を開始する"}
              </button>
              {submitError && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {submitError}
                </p>
              )}
              <p className="mt-3 text-center text-[11px] text-ink-soft">
                同意いただいた時点で
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  利用規約
                </a>
                に同意したものとみなされます。
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
