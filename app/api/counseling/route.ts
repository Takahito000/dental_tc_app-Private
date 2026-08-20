import { NextResponse } from "next/server";
// 変更①：変数ではなく、関数をインポートする
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 修正前
const apiUrl = process.env.DIFY_API_URL || "https://api.dify.ai/v1";

// 修正後（不要なブラケットやクォーテーションを強制的にお掃除）
const rawApiUrl = process.env.DIFY_API_URL || "https://api.dify.ai/v1";
const apiUrl = rawApiUrl.replace(/[\[\]\(\)'"]/g, "").trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "DIFY_API_KEY が設定されていません。" },
        { status: 500 }
      );
    }

    // Dify Completion API へリクエスト送信
    const difyRes = await fetch(`${apiUrl}/completion-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: body,
        response_mode: "blocking",
        user: "hygienist-user",
      }),
    });

    const difyData = await difyRes.json();

    if (!difyRes.ok) {
      console.error("[Dify API Error]", difyRes.status, difyData);
      return NextResponse.json(
        {
          success: false,
          error: `Dify APIエラー (${difyRes.status}): ${difyData.message || "通信失敗"}`,
        },
        { status: difyRes.status }
      );
    }

    const answer: string = difyData.answer || "";

    // テキストから患者用シートとトークカンペを抽出
    const patientSheetMatch = answer.match(/===PATIENT_SHEET_START===([\s\S]*?)===PATIENT_SHEET_END===/);
    const talkScriptMatch = answer.match(/===TALK_SCRIPT_START===([\s\S]*?)===TALK_SCRIPT_END===/);

    const patientSheet = patientSheetMatch ? patientSheetMatch[1].trim() : answer;
    const talkScript = talkScriptMatch ? talkScriptMatch[1].trim() : "";

    // ----------------------------------------------------
    // ★ Supabase への利用ログ書き込み処理（フェーズ1）
    // ----------------------------------------------------
    let patientAnonId = "";
    try {
      // 変更②：APIが実行された「この瞬間」に初めてSupabaseクライアントを生成する
      const supabase = getSupabaseAdmin();
      
      const demoClinicId = "11111111-1111-1111-1111-111111111111"; // SQLで投入したデモ医院ID
      const { data: logData, error: logError } = await supabase
        .from("usage_logs")
        .insert({
          clinic_id: demoClinicId,
          staff_name: "衛生士",
        })
        .select("patient_anon_id")
        .single();

      if (!logError && logData) {
        patientAnonId = logData.patient_anon_id;
        console.log("Supabase Log Created:", patientAnonId);
      } else {
        console.warn("Supabase Log Warning:", logError?.message);
      }
    } catch (dbErr) {
      console.error("Supabase Log DB Error:", dbErr);
    }

    return NextResponse.json({
      success: true,
      patientSheet,
      talkScript,
      patientAnonId, // 自動採番された匿名ID (例: A101)
    });
  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "サーバー内部エラー" },
      { status: 500 }
    );
  }
}