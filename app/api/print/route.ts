import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    // 送られてきた「ファイル（FormData）」を受け取る
    const formData = await req.formData();

    // 💡【追加】デモトークンからのメール送信はサーバー側でも拒否する
    //    （フロントのボタン非表示は /api/print を直接叩けば迂回できるため、ここで塞ぐ）
    const accessToken = (formData.get("access_token") || "").toString().trim();
    if (accessToken) {
      const supabase = getSupabaseAdmin();
      const { data: clinic } = await supabase
        .from("clinics")
        .select("is_demo")
        .eq("access_token", accessToken)
        .single();
      if (clinic?.is_demo) {
        return NextResponse.json(
          { success: false, error: "デモ版ではメール送信はご利用いただけません。" },
          { status: 403 }
        );
      }
    }
    // ※トークン未取得・未登録の場合は従来通りスルー（既存医院の動作を変えないため、
    //   拒否するのは「デモと確定したトークン」のみに限定する）
    
    // --- 【追加】URLサニタイズ（浄化）処理 ---
    const rawWebhookUrl = process.env.N8N_PRINT_WEBHOOK_URL || "";
    const urlMatch = rawWebhookUrl.match(/(https?:\/\/[^\s\[\]\(\)]+)/);
    const webhookUrl = urlMatch ? urlMatch[1] : "";

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: "N8N_PRINT_WEBHOOK_URL が正しく設定されていません。" },
        { status: 500 }
      );
    }

    // FormData (PDFファイル＋医院IDなど) をそのままn8nへ転送！
    const res = await fetch(webhookUrl, {
      method: "POST",
      body: formData, // JSON.stringify は使いません
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "n8n Webhook呼び出しに失敗しました。" },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Print API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "送信エラー" },
      { status: 500 }
    );
  }
}