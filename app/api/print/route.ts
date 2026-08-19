import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 変更点: JSONではなく、送られてきた「ファイル（FormData）」を受け取る
    const formData = await req.formData();
    const webhookUrl = process.env.N8N_PRINT_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: "N8N_PRINT_WEBHOOK_URL が未設定です。" },
        { status: 500 }
      );
    }

    // 変更点: FormData (PDFファイル＋医院IDなど) をそのままn8nへ転送！
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