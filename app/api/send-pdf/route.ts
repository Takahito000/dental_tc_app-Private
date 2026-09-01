import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

// 💡 PDF 添付メールのサイズ上限（バイナリ換算 5MB）
const PDF_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;

// 💡 件名・本文はコード側で固定（AI生成させない）
const SUBJECT_TEMPLATE = "【デンピストAI】AI客観分析レポート（{{管理ID}}）";
const BODY_TEMPLATE = `AI客観分析レポートのPDFを添付でお送りします。
印刷のうえ、患者様へのご提示にご利用ください。

管理ID: {{管理ID}}
発行日: {{発行日}}

※このメールはデンピストAIの送信ボタン操作により送信されました。`;

export async function POST(req: Request) {
  let pdfData = "";
  let toEmail = "";

  try {
    const body = await req.json();
    const {
      pdfData: rawPdfData,
      accessToken,
      fileName,
      patientAnonId,
      issueDate,
    }: {
      pdfData?: string;
      accessToken?: string;
      fileName?: string;
      patientAnonId?: string;
      issueDate?: string;
    } = body;

    pdfData = rawPdfData || "";

    // 1. バリデーション
    if (!pdfData || typeof pdfData !== "string") {
      return NextResponse.json(
        { ok: false, error: "PDFデータが指定されていません。" },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(pdfData, "base64");
    if (pdfBuffer.byteLength > PDF_SIZE_LIMIT_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PDFが5MBを超えているため送信できません。" },
        { status: 400 }
      );
    }

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { ok: false, error: "医院トークンが指定されていません。" },
        { status: 400 }
      );
    }

    // 2. Supabase から医院メールアドレスを取得
    const supabase = getSupabaseAdmin();
    const { data: clinic, error } = await supabase
      .from("clinics")
      .select("print_email, is_demo")
      .eq("access_token", accessToken)
      .single();

    if (error) {
      console.error("SendPdf API Clinic Query Error:", error);
      return NextResponse.json(
        { ok: false, error: "医院情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    if (!clinic) {
      return NextResponse.json(
        { ok: false, error: "指定されたトークンに対応する医院が見つかりません。" },
        { status: 404 }
      );
    }

    // 💡 デモトークンからのメール送信はサーバー側で拒否
    if (clinic.is_demo === true) {
      return NextResponse.json(
        { ok: false, error: "デモ版ではメール送信はご利用いただけません。" },
        { status: 403 }
      );
    }

    toEmail = (clinic.print_email || "").trim();
    if (!toEmail) {
      return NextResponse.json(
        { ok: false, error: "医院の送信先メールアドレスが登録されていません。" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY || "";
    const mailFrom = process.env.MAIL_FROM || "";

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY が設定されていません。" },
        { status: 500 }
      );
    }

    if (!mailFrom) {
      return NextResponse.json(
        { ok: false, error: "MAIL_FROM が設定されていません。" },
        { status: 500 }
      );
    }

    // 3. Resend で送信
    const resend = new Resend(apiKey);

    const subject = SUBJECT_TEMPLATE.replace(
      /\{\{管理ID\}\}/g,
      patientAnonId || ""
    );
    const text = BODY_TEMPLATE.replace(
      /\{\{管理ID\}\}/g,
      patientAnonId || ""
    ).replace(/\{\{発行日\}\}/g, issueDate || "");

    const { error: sendError } = await resend.emails.send({
      from: mailFrom,
      to: toEmail,
      subject,
      text,
      attachments: [
        {
          filename: fileName || "AI客観分析レポート.pdf",
          content: pdfData,
        },
      ],
    });

    if (sendError) {
      console.error("Resend Send Error:", {
        resendStatusCode: sendError?.statusCode ?? null,
        resendErrorBody: sendError,
        clinicEmailFound: Boolean(toEmail),
        pdfBase64Length: pdfData?.length ?? null,
      });
      return NextResponse.json(
        { ok: false, error: "メール送信に失敗しました。" },
        { status: 500 }
      );
    }

    // 4. 成功レスポンス
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("SendPdf API Error:", {
      errorMessage: err?.message,
      errorStack: err?.stack,
      resendStatusCode: err?.statusCode ?? null,
      resendErrorBody: err?.body ?? {
        name: err?.name,
        message: err?.message,
        statusCode: err?.statusCode,
      },
      clinicEmailFound: Boolean(toEmail),
      pdfBase64Length: pdfData?.length ?? null,
    });
    return NextResponse.json(
      { ok: false, error: err.message || "送信エラー" },
      { status: 500 }
    );
  }
}
