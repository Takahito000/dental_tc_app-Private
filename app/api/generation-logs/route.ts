import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ============================================================
// 発行ログ一覧（/app/logs）用 読み取り専用API
// - 認証: /api/clinic-prices と同パターン（token → clinics.access_token 照合 → clinic.id）
// - clinic_id で絞り込み、他医院のデータは絶対に返さない
// - SELECT は id, patient_anon_id, staff_name, inputs, created_at のみ
//   （patient_sheet / talk_script は長文のため一覧APIでは取得しない）
// ============================================================

const LIMIT = 500;

async function handle(token: string) {
  const t = (token || "").trim();
  if (!t) {
    return NextResponse.json({ error: "token required" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 既存の照合パターンと同じく clinics.access_token で医院を特定する
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("access_token", t)
      .single();

    if (!clinic) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    // 上限+1件取って到達判定する（truncated はUIの注記用）
    const { data, error } = await supabase
      .from("generation_logs")
      .select("id, patient_anon_id, staff_name, inputs, created_at")
      .eq("clinic_id", clinic.id)
      .order("created_at", { ascending: false })
      .limit(LIMIT + 1);

    if (error) {
      console.error("GenerationLogs API Query Error:", error);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    const rows = data || [];
    const truncated = rows.length > LIMIT;
    return NextResponse.json({
      logs: rows.slice(0, LIMIT),
      truncated,
      limit: LIMIT,
    });
  } catch (err) {
    console.error("GenerationLogs API Error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token =
    searchParams.get("t") ||
    searchParams.get("token") ||
    searchParams.get("access_token") ||
    "";
  return handle(token);
}

export async function POST(req: Request) {
  let token = "";
  try {
    const body = await req.json();
    token = (body?.t || body?.token || body?.access_token || "").toString();
  } catch {
    // ボディがJSONでない場合はクエリ側のみで判定する
  }
  return handle(token);
}
