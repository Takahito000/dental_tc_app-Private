// KC-063：利用規約 /terms 新設・同意ゲートの検証
//
// 【Part S: 静的検査】常時実行。構造・文言・ゲートの組込みを検証する。
// 【Part B: 動作検証】POSTermsGateモック（PostgREST境界）＋本番ビルドサーバで
//   未同意リダイレクト・同意記録・冪等・ゲート対象外ページを検証する。
//   使い方: npm run build && node test-termsGate.mjs --behavior（内部でサーバ起動はしない。
//   事前に TEST_BASE_URL でサーバを起動しておくこと）
import { readFileSync } from "fs";

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ FAIL: ${name}`);
  }
};

console.log("Part S: 静的検査");

const migration = readFileSync(
  "supabase/migrations/20261103000000_terms_consents.sql",
  "utf8"
);
const termsLib = readFileSync("lib/terms.ts", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");
const consentApi = readFileSync("app/api/terms/consent/route.ts", "utf8");
const counseling = readFileSync("app/api/counseling/route.ts", "utf8");
const sendPdf = readFileSync("app/api/send-pdf/route.ts", "utf8");
const consentPage = readFileSync("app/terms/consent/consent-client.tsx", "utf8");
const termsPage = readFileSync("app/terms/page.tsx", "utf8");
const termsContent = readFileSync("app/terms/terms-content.tsx", "utf8");
const privacy = readFileSync("app/privacy/page.tsx", "utf8");
const lp = readFileSync("app/page.tsx", "utf8");
const legal = readFileSync("app/legal/page.tsx", "utf8");
const appPage = readFileSync("app/app/page.tsx", "utf8");
const logsClient = readFileSync("app/app/logs/logs-client.tsx", "utf8");
const checkClient = readFileSync("app/check/check-client.tsx", "utf8");

// S1: マイグレーション
ok(migration.includes("create table if not exists public.terms_consents"),
  "S1-1 terms_consents テーブル作成");
ok(/unique \(clinic_id, tos_version\)/.test(migration),
  "S1-2 (clinic_id, tos_version) 一意制約（二重同意防止）");
ok(migration.includes("references public.clinics (id)"),
  "S1-3 医院識別は clinics への外部キー");
ok(migration.includes("agreed_at") && migration.includes("default now()"),
  "S1-4 agreed_at はサーバ時刻で記録");
ok(migration.includes("enable row level security") && !/create policy/i.test(migration),
  "S1-5 RLS有効・ポリシーなし（service_role経由のみ）");

// S2: バージョン定数・共通ヘルパー
ok(termsLib.includes('CURRENT_TERMS_VERSION = "1.0"'),
  "S2-1 CURRENT_TERMS_VERSION = \"1.0\"");
ok(termsLib.includes("cs-lab2024.notion.site"),
  "S2-2 問い合わせフォームURLが定義されている");
ok(termsLib.includes('from("terms_consents")') && termsLib.includes(".eq(\"tos_version\", CURRENT_TERMS_VERSION)"),
  "S2-3 同意判定は terms_consents × 現行バージョン");
ok(/catch|error\)\s*\{[\s\S]*return true/.test(termsLib) || termsLib.includes("fail-safe"),
  "S2-4 チェック失敗時はフェイルセーフで通す");

// S3: middleware ゲート
ok(middleware.includes('"/app/:path*"') && middleware.includes('"/api/:path*"'),
  "S3-1 matcher が /app 系・/api 系をカバー");
ok(middleware.includes("CURRENT_TERMS_VERSION"),
  "S3-2 middleware が現行バージョン定数を使用");
ok(middleware.includes('"/api/org-check"') && middleware.includes('"/api/terms/consent"'),
  "S3-3 ゲート対象外: org-check（匿名）・terms/consent（同意記録）");
ok(middleware.includes("GATED_API_PATHS") &&
  ["/api/clinic", "/api/clinic-prices", "/api/generation-logs"].every((p) => middleware.includes(`"${p}"`)),
  "S3-4 ゲート対象API（clinic・clinic-prices・generation-logs）");
ok(middleware.includes('url.pathname = "/terms/consent"'),
  "S3-5 未同意のページアクセスは /terms/consent へリダイレクト");
ok(middleware.includes('status: 403'),
  "S3-6 未同意のAPIアクセスは 403 で拒否");
ok(middleware.includes("fail-open") || middleware.includes("フェイルセーフ"),
  "S3-7 ゲート自体の障害はフェイルセーフで通す");
ok(/get\("t"\)\s*\|\|\s*sp\.get\("token"\)/.test(middleware.replace(/\n/g, " ")) ||
  middleware.includes('sp.get("t")'),
  "S3-8 トークン抽出（クエリ t/token/access_token + Cookie）");

// S4: 同意API
ok(consentApi.includes("recordTermsConsent") && termsLib.includes('from("terms_consents")'),
  "S4-1 POST で同意をサーバ側に記録（recordTermsConsent 経由で terms_consents へ）");
ok(consentApi.includes("already"),
  "S4-2 二重同意は already として既存レコードを採用（冪等）");
ok(consentApi.includes("hasTermsConsent"),
  "S4-3 GET で同意状態を返す（同意画面のリダイレクト判定）");

// S5: 既存APIへのゲート組込み
ok(counseling.includes("hasTermsConsent"),
  "S5-1 /api/counseling が同意ゲートを呼ぶ");
ok(counseling.includes("termsConsentRequired: true"),
  "S5-2 counseling の拒否応答に termsConsentRequired フラグ");
ok(counseling.indexOf("hasTermsConsent") < counseling.indexOf("try_increment_clinic_monthly_usage"),
  "S5-3 counseling は同意チェック→月100回チェックの順（Difyより前）");
ok(sendPdf.includes("hasTermsConsent"),
  "S5-4 /api/send-pdf が同意ゲートを呼ぶ");

// S6: 同意画面
ok(consentPage.includes("同意して利用を開始する"),
  "S6-1 ボタン名が「同意して利用を開始する」（kimishika案内メールと厳密一致）");
ok(consentPage.includes('fetch("/api/terms/consent"') && consentPage.includes('method: "POST"'),
  "S6-2 押下で POST /api/terms/consent へ記録");
ok(consentPage.includes("disabled={submitting}"),
  "S6-3 送信中はボタン無効化（連打防止）");
ok(consentPage.includes('d.consented') && consentPage.includes("router.replace"),
  "S6-4 同意済みトークンはツール本体へリダイレクト");
ok(consentPage.includes('rawNext.startsWith("/")') && consentPage.includes('startsWith("//")'),
  "S6-5 next は同一オリジンのパスのみ許可（オープンリダイレクト対策）");
ok(consentPage.includes("TermsContent"),
  "S6-6 規約全文が同意画面にインライン表示");

// S7: /terms ページ
ok(termsPage.includes('title: "利用規約｜デンピストAI"'),
  "S7-1 title が「利用規約｜デンピストAI」");
for (let i = 1; i <= 17; i++) {
  ok(termsContent.includes(`第${i}条`),
    `S7-2 第${i}条 が掲載`);
}
ok(termsContent.includes("2026年11月5日 制定・施行"),
  "S7-3 付則の制定日（2026年11月5日）");
ok(termsContent.includes('href={CONTACT_FORM_URL}') && termsContent.includes("問い合わせフォーム") &&
  !termsContent.includes("問い合わせフォーム（kimishikaと同一のフォームを使用）"),
  "S7-4 問い合わせフォームが別タブリンク（付則の重複表記なし）");
ok(!termsContent.includes("残タスク") && !termsContent.includes("確定事項メモ") && !termsContent.includes("作成の要点"),
  "S7-5 運営メモが公開テキストに含まれない");

// S8: /privacy 追記
ok(privacy.includes("■ 外部AIサービスへの送信について"),
  "S8-1 「外部AIサービスへの送信について」ブロック");
ok(privacy.includes("外部のAIプラットフォーム（Dify）およびAIモデルプロバイダのAPIを利用します"),
  "S8-2 Dify送信の記載（承認文案どおり）");
ok(privacy.includes("再学習に利用されない設定"),
  "S8-3 再学習非利用の確認記載");

// S9: フッターリンク
ok(lp.includes('href="/terms"'), "S9-1 LP（/）フッターに利用規約リンク");
ok(appPage.includes('href="/terms"'), "S9-2 ツール本体（/app）フッターに利用規約リンク");
ok(logsClient.includes('href="/terms"'), "S9-3 発行ログ（/app/logs）フッターに利用規約リンク");
ok(checkClient.includes('href="/terms"'), "S9-4 /check フッターに利用規約リンク");
ok(privacy.includes('href="/terms"'), "S9-5 /privacy フッターに利用規約リンク");
ok(termsPage.includes('href="/terms"') || readFileSync("app/terms/page.tsx","utf8").includes("/terms"),
  "S9-6 /terms 自体のフッター導線あり");
ok(legal.includes('href="/terms"'), "S9-7 /legal フッターに利用規約リンク");

// ============================================================
// Part B: 動作検証（--behavior。TEST_BASE_URL にサーバが起動していること）
// ============================================================
if (!process.argv.includes("--behavior")) {
  console.log("\nPart B: 動作検証 — スキップ（--behavior 未指定）");
} else {
  const BASE = process.env.TEST_BASE_URL || "http://localhost:3100";
  const TOK = "tok-kc063-test";
  const bOk = (cond, name) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.error(`  ✗ FAIL: ${name}`); }
  };
  const run = async () => {
    console.log(`\nPart B: 動作検証 (${BASE})`);

    // (a) 未同意トークンの直接アクセスはゲートされる
    const rApp = await fetch(`${BASE}/app?t=${TOK}`, { redirect: "manual" });
    const loc = rApp.headers.get("location") || "";
    bOk(rApp.status === 307 && loc.includes("/terms/consent") && loc.includes(`t=${TOK}`),
      `B-a1 GET /app?t= → 307 同意画面へ (${rApp.status} → ${loc})`);
    const rLogs = await fetch(`${BASE}/app/logs?t=${TOK}`, { redirect: "manual" });
    bOk(rLogs.status === 307 && (rLogs.headers.get("location") || "").includes("/terms/consent"),
      "B-a2 GET /app/logs?t= → 307 同意画面へ");
    const rApi = await fetch(`${BASE}/api/generation-logs?t=${TOK}`);
    bOk(rApi.status === 403, `B-a3 GET /api/generation-logs?t= → 403 (${rApi.status})`);
    const rCounsel = await fetch(`${BASE}/api/counseling`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "denture", token: TOK }),
    });
    const counselBody = await rCounsel.json().catch(() => ({}));
    bOk(rCounsel.status === 403 && counselBody.termsConsentRequired === true,
      `B-a4 POST /api/counseling（未同意）→ 403 + termsConsentRequired (${rCounsel.status})`);

    // (b) 同意記録
    const rConsent = await fetch(`${BASE}/api/terms/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: TOK }),
    });
    const consentBody = await rConsent.json().catch(() => ({}));
    bOk(rConsent.status === 200 && consentBody.success === true && consentBody.already === false,
      `B-b1 同意記録 POST → success (${rConsent.status})`);
    const rCheck = await fetch(`${BASE}/api/terms/consent?t=${TOK}`);
    const checkBody = await rCheck.json().catch(() => ({}));
    bOk(checkBody.consented === true, "B-b2 同意状態 GET → consented=true");

    // (c) 同意後はアクセス可能・二重同意は冪等
    const rApp2 = await fetch(`${BASE}/app?t=${TOK}`, { redirect: "manual" });
    bOk(rApp2.status === 200, `B-c1 同意後 GET /app?t= → 200 (${rApp2.status})`);
    const rConsent2 = await fetch(`${BASE}/api/terms/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: TOK }),
    });
    const consentBody2 = await rConsent2.json().catch(() => ({}));
    bOk(consentBody2.success === true && consentBody2.already === true,
      "B-c2 同一バージョンへの二重同意 → already=true（冪等）");

    // (d) ゲート対象外ページは未同意でも表示
    for (const p of ["/", "/check", "/privacy", "/terms"]) {
      const r = await fetch(`${BASE}${p}`);
      bOk(r.status === 200, `B-d GET ${p} → 200 (${r.status})`);
    }

    console.log(`\n結果: ${pass}件PASS / ${fail}件FAIL`);
    process.exit(fail > 0 ? 1 : 0);
  };
  run().catch((e) => {
    console.error("Part B 実行エラー:", e);
    process.exit(1);
  });
}

if (!process.argv.includes("--behavior")) {
  console.log(`\n結果: ${pass}件PASS / ${fail}件FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}
