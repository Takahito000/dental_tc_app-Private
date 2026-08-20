import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 送られてきた「ファイル（FormData）」を受け取る
    const formData = await req.formData();
    
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