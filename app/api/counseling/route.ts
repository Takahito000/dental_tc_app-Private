import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

   // 1. APIキーとURLのクリーンアップ
    const rawApiKey = process.env.DIFY_API_KEY || "";
    const apiKey = rawApiKey.replace(/[\[\]\(\)'"\s]/g, "").trim();

    // 2重貼り付け等のURL破損を判定し、正しいベースURL（https://.../v1）のみを強制抽出
    const rawApiUrl = (process.env.DIFY_API_URL || "https://api.dify.ai/v1").replace(/[\[\]\(\)'"\s]/g, "").trim();
    const urlMatch = rawApiUrl.match(/(https?:\/\/[^\/]+\/v1)/);
    const baseUrl = urlMatch ? urlMatch[1] : "https://api.dify.ai/v1";
    
    const targetUrl = `${baseUrl}/completion-messages`;

    let rawApiUrl = (process.env.DIFY_API_URL || "https://api.dify.ai/v1")
      .replace(/[\[\]\(\)'"\s]/g, "")
      .trim()
      .replace(/\/+$/, "");

    rawApiUrl = rawApiUrl.replace(/\/completion-messages$/, "");
    const targetUrl = `${rawApiUrl}/completion-messages`;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "DIFY_API_KEY が設定されていません。" },
        { status: 500 }
      );
    }

    // Dify Completion API へリクエスト送信
    const difyRes = await fetch(targetUrl, {
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

    const resText = await difyRes.text();
    let difyData: any = {};
    try {
      difyData = resText ? JSON.parse(resText) : {};
    } catch {
      console.error("[Dify Response Parse Error]", resText);
      return NextResponse.json(
        {
          success: false,
          error: `Difyからの応答解析に失敗しました (Target: ${targetUrl}, Status: ${difyRes.status})`,
        },
        { status: 500 }
      );
    }

    if (!difyRes.ok) {
      console.error("[Dify API Error]", difyRes.status, difyData);
      return NextResponse.json(
        {
          success: false,
          error: `Dify APIエラー (${difyRes.status}) [URL: ${targetUrl}]: ${difyData.message || "通信失敗"}`,
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
    // Supabase への利用ログ書き込み処理（遅延初期化）
    // ----------------------------------------------------
    let patientAnonId = "";
    try {
      const supabase = getSupabaseAdmin();
      const demoClinicId = "11111111-1111-1111-1111-111111111111";
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
      patientAnonId,
    });
  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "サーバー内部エラー" },
      { status: 500 }
    );
  }
}