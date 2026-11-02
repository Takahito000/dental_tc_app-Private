import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { hasTermsConsent, recordTermsConsent } from "@/lib/terms";

export const dynamic = "force-dynamic";

// ============================================================
// 利用規約 同意記録API（/api/terms/consent）
// - POST { token } : 同意を記録（冪等。二重同意は既存レコードを採用）
// - GET  ?t=token  : 現行バージョンへの同意状態を返す（同意画面のリダイレクト判定用）
// - 医院トークンで医院を特定し、サーバ側で記録・参照する
// ============================================================

async function resolveClinicId(token: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("access_token", token)
    .single();
  return clinic?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = (body?.token || "").toString().trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "トークンが指定されていません。" },
        { status: 400 }
      );
    }
    const clinicId = await resolveClinicId(token);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: "このトークンに対応する医院が登録されていません。" },
        { status: 404 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { agreedAt, already } = await recordTermsConsent(supabase, clinicId);
    return NextResponse.json({ success: true, already, agreedAt });
  } catch (err: any) {
    console.error("Terms Consent POST Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "サーバー内部エラー" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = (searchParams.get("t") || "").trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "トークンが指定されていません。" },
        { status: 400 }
      );
    }
    const clinicId = await resolveClinicId(token);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: "このトークンに対応する医院が登録されていません。" },
        { status: 404 }
      );
    }
    const supabase = getSupabaseAdmin();
    const consented = await hasTermsConsent(supabase, clinicId);
    return NextResponse.json({ success: true, consented });
  } catch (err: any) {
    console.error("Terms Consent GET Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "サーバー内部エラー" },
      { status: 500 }
    );
  }
}
