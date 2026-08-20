import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 💡 トークンから医院情報を引くための照合API
//    フロントは起動時にこれを呼び、正式な医院名を取得する。
//    患者向けシートに「接続中 (token)」のような内部表記を出さないための役割分担。
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

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("clinics")
      .select("id, name, print_email")
      .eq("access_token", token)
      .single();

    if (error) {
      console.error("Clinic API Query Error:", error);
      // PGRST116 = 「0件（該当なし）」の正常系。それ以外はDB側の異常として分けて返す
      if (error.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            error: "このトークンに対応する医院が登録されていません。",
            debug: debugInfo(),
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: `DB照合エラー: ${error.message}`, debug: debugInfo() },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "このトークンに対応する医院が登録されていません。",
          debug: debugInfo(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      name: data.name,
      print_email: data.print_email,
    });
  } catch (err: any) {
    console.error("Clinic API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "サーバー内部エラー", debug: debugInfo() },
      { status: 500 }
    );
  }
}

// 診断用: どのSupabaseプロジェクトに、どの種別のキーで接続しているかを安全に可視化する
// （キー本体は一切返さず、URLのホスト名とキーの役割ロールのみ）
function debugInfo() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const urlMatch = rawUrl.match(/https?:\/\/([^\/\s\[\]\(\)"']+)/);
  const host = urlMatch ? urlMatch[1] : "(URL未設定or破損)";

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let role = "unknown";
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString());
    role = payload.role || "unknown";
  } catch {
    role = key ? "(JWTとして読めない形式)" : "(キー未設定)";
  }

  return { supabaseHost: host, keyRole: role };
}
