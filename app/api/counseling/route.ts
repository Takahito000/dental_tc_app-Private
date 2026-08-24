import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. APIキーのクリーンアップ（余分な空白・改行・引用符を完全除去）
    const rawApiKey = process.env.DIFY_API_KEY || "";
    const apiKey = rawApiKey.replace(/[\[\]\(\)'"\s]/g, "").trim();

    // 2. 2重貼り付け等のURL破損を判定し、正しいベースURL（https://.../v1）のみを強制抽出
    const rawEnvUrl = (process.env.DIFY_API_URL || "https://api.dify.ai/v1").replace(/[\[\]\(\)'"\s]/g, "").trim();
    const urlMatch = rawEnvUrl.match(/(https?:\/\/[^\/]+\/v1)/);
    const baseUrl = urlMatch ? urlMatch[1] : "https://api.dify.ai/v1";

    // 送信先URLを生成
    const targetUrl = `${baseUrl}/completion-messages`;

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

    // レポートヘッダー置換用の値を先に確定（衛生士名・発行日）
    const staffName = (body.staffName || body.staff_name || "").toString().trim();
    const issueDate = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    });

    // テキストから患者用シートとトークカンペを抽出
    const patientSheetMatch = answer.match(/===PATIENT_SHEET_START===([\s\S]*?)===PATIENT_SHEET_END===/);
    const talkScriptMatch = answer.match(/===TALK_SCRIPT_START===([\s\S]*?)===TALK_SCRIPT_END===/);

    let patientSheet = patientSheetMatch ? patientSheetMatch[1].trim() : answer;
    const talkScript = talkScriptMatch ? talkScriptMatch[1].trim() : "";

    // ----------------------------------------------------
    // Supabase への利用ログ書き込み処理（遅延初期化）
    // ----------------------------------------------------
    let patientAnonId = "";
    let clinicId: string | null = null;
    try {
      const supabase = getSupabaseAdmin();

      // 💡 アクセストークンから医院を特定し、ログの clinic_id を動的化する
      //    （固定IDのままだと、医院別の利用集計・課金カウント・ヘルススコア監視が全て壊れるため）
      const clinicToken = (body.token || body.access_token || "").toString().trim();
      if (clinicToken) {
        const { data: clinic } = await supabase
          .from("clinics")
          .select("id")
          .eq("access_token", clinicToken)
          .single();
        clinicId = clinic?.id ?? null;
      }

      if (!clinicId) {
        console.warn("Supabase Log Skipped: token未送信または未登録のためログを記録しませんでした");
      } else {
        const { data: logData, error: logError } = await supabase
          .from("usage_logs")
          .insert({
            clinic_id: clinicId,
            staff_name: staffName,
          })
          .select("patient_anon_id")
          .single();

        if (!logError && logData) {
          patientAnonId = logData.patient_anon_id;
          console.log("Supabase Log Created:", patientAnonId, "clinic:", clinicId);
        } else {
          console.warn("Supabase Log Warning:", logError?.message);
        }
      }
    } catch (dbErr) {
      console.error("Supabase Log DB Error:", dbErr);
    }

    // --- レポートヘッダーのプレースホルダーを実値に置換 ---
    // Difyプロンプトが出力する [[STAFF_NAME]] / [[ISSUE_DATE]] / [[PATIENT_ID]] をここで最終差し替えする
    patientSheet = patientSheet.replaceAll("[[ISSUE_DATE]]", issueDate);

    if (staffName) {
      patientSheet = patientSheet.replaceAll("[[STAFF_NAME]]", staffName);
    } else {
      // 衛生士名が未入力の場合は「担当: 」の部分だけを除去する
      // （発行日・管理IDと同じ行に同居しているため、行ごと削除すると道連れになる）
      patientSheet = patientSheet.replace(/担当[:：]\s*\[\[STAFF_NAME\]\][　\s]*/g, "");
    }

    if (patientAnonId) {
      patientSheet = patientSheet.replaceAll("[[PATIENT_ID]]", patientAnonId);
    } else {
      // 採番に失敗した場合は「管理ID: 」の部分だけを除去する
      patientSheet = patientSheet.replace(/管理ID[:：]\s*\[\[PATIENT_ID\]\][　\s]*/g, "");
    }

    // ----------------------------------------------------
    // 💡 生成内容の保存（generation_logs）— 遠隔地の医院でも生成物を後から監修・レビューできるようにする
    //    （無償モニター期間の品質検証・判例収集の基盤。失敗しても生成応答自体は必ず返す）
    // ----------------------------------------------------
    try {
      if (clinicId) {
        const supabase = getSupabaseAdmin();
        // トークンはログに残さない（認証情報の保存を避ける）
        const logInputs = { ...body };
        delete logInputs.token;
        delete logInputs.access_token;
        const { error: genLogError } = await supabase.from("generation_logs").insert({
          clinic_id: clinicId,
          patient_anon_id: patientAnonId || null,
          staff_name: staffName || null,
          inputs: logInputs,
          patient_sheet: patientSheet,
          talk_script: talkScript,
        });
        if (genLogError) {
          console.warn("Generation Log Warning:", genLogError.message);
        } else {
          console.log("Generation Log Created:", patientAnonId, "clinic:", clinicId);
        }
      }
    } catch (genLogErr) {
      console.error("Generation Log Error:", genLogErr);
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
