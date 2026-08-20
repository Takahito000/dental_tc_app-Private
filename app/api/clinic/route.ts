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

    if (error || !data) {
      // 未登録トークン、または access_token 列未作成でも 404 を返す（フロント側で無害に処理される）
      return NextResponse.json(
        { success: false, error: "このトークンに対応する医院が登録されていません。" },
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
      { success: false, error: err.message || "サーバー内部エラー" },
      { status: 500 }
    );
  }
}
