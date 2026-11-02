import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

// ============================================================
// Middleware（KC-063：利用規約 同意ゲート）
//
// 【役割1: 既存】ルートへのアクセスでクエリパラメータ t がある場合のみ /app へリダイレクト
//           （t なしのルートアクセスは LP を表示。LP指示書の既存運用を維持）
//
// 【役割2: 新規】同意ゲート（サーバ側ガード）
//   - 対象: /app 以下のページ、およびトークンをクエリで受ける /api/* （GET）
//   - 医院トークンで医院を特定し、現行 CURRENT_TERMS_VERSION への同意レコードが
//     無い場合は /terms/consent へ強制リダイレクト（API は 403 で拒否）
//   - ゲート対象外: /、/check、/privacy、/legal、/terms、/terms/consent、
//     /api/org-check（匿名）、/api/terms/consent（同意記録自体）
//   - POST系API（/api/counseling・/api/send-pdf）はボディ内トークンを使うため
//     ルート内の共通ヘルパーでゲートする（middlewareではボディを読まない）
//   - 同意チェックのDB障害等はフェイルセーフで通す（既存利用を妨げない）
//
// 【ガード漏れ防止】ゲート判定はこの middleware のみに集約し、
//   ページ追加時は matcher にパスを含めれば自動でゲート対象になる構造。
// ============================================================

// 同意ゲート対象のAPI（GETかつクエリでトークンを受ける経路）。
// POST系（counseling/send-pdf）はルート内ゲートのため対象外。
const GATED_API_PATHS = ["/api/clinic", "/api/clinic-prices", "/api/generation-logs"];
// 同意ゲートから除外するAPI（同意記録・匿名ログ保存）
const EXEMPT_API_PATHS = ["/api/org-check", "/api/terms/consent"];

function getSupabaseForMiddleware() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const urlMatch = rawUrl.match(/(https?:\/\/[^\s\[\]\(\)]+)/);
  const supabaseUrl = urlMatch ? urlMatch[1] : "";
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const serviceKey = rawKey.replace(/[\[\]\(\)'"\s]/g, "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

async function hasConsent(clinicId: string): Promise<boolean | null> {
  const supabase = getSupabaseForMiddleware();
  if (!supabase) return null; // 環境未設定: フェイルセーフで通す
  const { data, error } = await supabase
    .from("terms_consents")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("tos_version", CURRENT_TERMS_VERSION)
    .limit(1);
  if (error) return null; // DB障害: フェイルセーフで通す
  return Array.isArray(data) && data.length > 0;
}

async function resolveClinicByToken(token: string): Promise<string | null> {
  const supabase = getSupabaseForMiddleware();
  if (!supabase) return null;
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("access_token", token)
    .single();
  return clinic?.id ?? null;
}

// リクエストから医院トークンを抽出する（クエリ → Cookie の順）
function extractToken(req: NextRequest): string {
  const sp = req.nextUrl.searchParams;
  const fromQuery =
    (sp.get("t") || sp.get("token") || sp.get("access_token") || "").trim();
  if (fromQuery) return fromQuery;
  const cookieToken =
    req.cookies.get("clinic_access_token")?.value || "";
  try {
    return decodeURIComponent(cookieToken).trim();
  } catch {
    return cookieToken.trim();
  }
}

function consentUrl(req: NextRequest, token: string): string {
  const nextPath = req.nextUrl.pathname + req.nextUrl.search;
  const url = req.nextUrl.clone();
  url.pathname = "/terms/consent";
  url.search = "";
  url.searchParams.set("t", token);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 【役割1: 既存】/?t=xxx → /app へリダイレクト（LPは t なしのみ表示）
  if (pathname === "/") {
    const t = req.nextUrl.searchParams.get("t");
    if (t) {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 【役割2】同意ゲート
  try {
    // 除外APIは常に通す
    if (EXEMPT_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();
    }

    const isAppPage = pathname === "/app" || pathname.startsWith("/app/");
    const isGatedApi = GATED_API_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (isAppPage || isGatedApi) {
      // POST系APIはルート内ゲートに任せる（ボディをmiddlewareで読まない）
      if (req.method !== "GET" && req.method !== "HEAD") {
        return NextResponse.next();
      }
      const token = extractToken(req);
      if (token) {
        const clinicId = await resolveClinicByToken(token);
        if (clinicId) {
          const consented = await hasConsent(clinicId);
          if (consented === false) {
            if (isAppPage) {
              return NextResponse.redirect(consentUrl(req, token), 307);
            }
            return NextResponse.json(
              { success: false, error: "terms consent required" },
              { status: 403 }
            );
          }
        }
      }
    }
  } catch (err) {
    // ゲート自体の障害はフェイルセーフで通す（既存利用を妨げない）
    console.error("Terms gate middleware error (fail-open):", err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 同意ゲートの判定は /app 系ページと /api 系のみ必要。
     * 静的アセット・公開ページ（/、/check、/privacy、/terms 等）は除外し、
     * パフォーマンスと公開導線を維持する。
     * ※ "/" は matcher に含める（?t= リダイレクトの既存運用のため）
     */
    "/",
    "/app/:path*",
    "/api/:path*",
  ],
};
