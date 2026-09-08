import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. APIキーのクリーンアップ（余分な空白・改行・引用符を完全除去）
    const isCrown = body.mode === "crown";
    const rawApiKey =
      (isCrown ? process.env.DIFY_API_KEY_CROWN : process.env.DIFY_API_KEY) || "";
    const apiKey = rawApiKey.replace(/[\[\]\(\)'"\s]/g, "").trim();

    // 2. 2重貼り付け等のURL破損を判定し、正しいベースURL（https://.../v1）のみを強制抽出
    const rawEnvUrl = (process.env.DIFY_API_URL || "https://api.dify.ai/v1").replace(/[\[\]\(\)'"\s]/g, "").trim();
    const urlMatch = rawEnvUrl.match(/(https?:\/\/[^\/]+\/v1)/);
    const baseUrl = urlMatch ? urlMatch[1] : "https://api.dify.ai/v1";

    // 送信先URLを生成
    const targetUrl = `${baseUrl}/completion-messages`;

    if (!apiKey) {
      const keyName = isCrown ? "DIFY_API_KEY_CROWN" : "DIFY_API_KEY";
      return NextResponse.json(
        { success: false, error: `${keyName} が設定されていません。` },
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

    // ----------------------------------------------------
    // 💡 変更C：最小バリデータ — AI生テキスト全体を正規表現で決定的検証（AI自己チェックは見逃しうるため）
    //    義歯側: 1)禁止語 2)注入値以外の金額 3)表の出力
    //    クラウン側: 1)金額照合（candidate_price_range の数字のみ許可）2)表の出力 3)carefulモード混入検出
    //    （クラウンの禁止語照合は文脈依存による誤検出リスクのため今回実装しない）
    //    検出時も生成応答自体は返すが、クライアントは結果を表示しない（validation フィールドで通知。
    //    自動再生成は行わず、既存の生成ボタンで再生成を促す）
    // ----------------------------------------------------
    const BANNED_WORDS = ["治療用義歯", "仮義歯", "BPS"];
    const MONEY_RE = /([0-9０-９][0-9０-９,\.]*)\s*(万)?円/g;

    const toHalfWidth = (s: string) =>
      s.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
    const parseNum = (s: string): number =>
      parseFloat(toHalfWidth(s).replace(/,/g, ""));

    const validation: { items: string[]; matches: string[] } = {
      items: [],
      matches: [],
    };

    if (!isCrown) {
      // ===== 義歯側 =====
      // 注入値（candidate_price_range / price_per_day）に含まれる数字の許可集合。
      // 「25万円」と「250000円」の表記違いを許すため、元の数字と×10000 の両方を登録する。
      // 「保険適用（1〜3割負担）」等の定性的記述は「円」を伴わないため金額正規表現に一致しない（許可扱い）。
      const allowedMoney = new Set<number>();
      for (const src of [body.candidate_price_range, body.price_per_day]) {
        const str = (src || "").toString();
        for (const m of str.matchAll(/[0-9０-９][0-9０-９,\.]*/g)) {
          const n = parseNum(m[0]);
          if (!Number.isNaN(n)) {
            allowedMoney.add(n);
            allowedMoney.add(n * 10000);
          }
        }
      }

      // 1. 禁止語
      for (const w of BANNED_WORDS) {
        if (answer.includes(w)) {
          validation.items.push(`禁止語: ${w}`);
          validation.matches.push(w);
        }
      }

      // 2. 金額の混入（注入値と一致しない数字を含む金額表現はすべて禁止）
      for (const m of answer.matchAll(MONEY_RE)) {
        const n = parseNum(m[1]);
        if (Number.isNaN(n)) continue;
        if (!allowedMoney.has(n) && !allowedMoney.has(n * 10000)) {
          validation.items.push("金額の混入");
          validation.matches.push(m[0]);
        }
      }
    } else {
      // ===== クラウン側 =====
      // 構造番号（「ステップ1」等）の除外。①金額照合・③careful混入検出で共用する
      // （カンペの構造番号は毎回出力されるため、金額・数字の判定前に必ず除外する）
      const stripStepLabels = (text: string) =>
        text.replace(/ステップ\s*[0-9０-９]+/g, "");
      const answerWoSteps = stripStepLabels(answer);

      // 金額らしき表現の検出対象（半角・全角・カンマ区切り・漢数字＋「円/万円」）。
      // 「5年間」等の金額でない数字は対象外（将来の正当な非金額数字による誤検出を防ぐため）
      const MONEY_LIKE_RE = /([0-9０-９一二三四五六七八九][0-9０-９,\.一二三四五六七八九]*)\s*(万)?円/g;

      // 金額照合用の許可集合（単一変数 candidate_price_range のみ）
      const allowedMoney = new Set<number>();
      const priceStr = (body.candidate_price_range || "").toString();
      for (const m of priceStr.matchAll(/[0-9０-９][0-9０-９,\.]*/g)) {
        const n = parseNum(m[0]);
        if (!Number.isNaN(n)) {
          allowedMoney.add(n);
          allowedMoney.add(n * 10000);
        }
      }

      const isCarefulMode = (body.sheet_mode || "").toString() === "careful";

      if (isCarefulMode) {
        // 3. carefulモード混入検出（最重要）:
        //    クラウン版プロンプトの絶対条件「careful時は候補提示・費用数字は一切出力しない」を
        //    コードで強制する。破られると痛みのある患者への検査優先案内が崩れるためブロック。
        const firstCandidate = (body.first_candidate || "").toString().trim();
        if (firstCandidate && answer.includes(firstCandidate)) {
          validation.items.push("careful混入: first_candidate");
          validation.matches.push(firstCandidate);
        }
        // 価格とみなせる表現全般をカバーするため、数字そのものの出現をブロック対象にする。
        // 構造番号（ステップN）は stripStepLabels で除外済み。
        const digitMatch = answerWoSteps.match(/[0-9０-９]/);
        if (digitMatch) {
          validation.items.push("careful混入: 数字");
          validation.matches.push(digitMatch[0]);
        }
      } else if (allowedMoney.size === 0) {
        // 金額注入なしの場合：金額らしき表現が一切ないことを要求する
        // （「ステップ1〜4」等の構造番号や「5年間」等の非金額数字は除外済みのため許可される）
        const moneyMatch = answerWoSteps.match(new RegExp(MONEY_LIKE_RE.source));
        if (moneyMatch) {
          validation.items.push("金額の混入");
          validation.matches.push(moneyMatch[0]);
        }
      } else {
        // 1. 金額照合（candidate_price_range に含まれない数字の金額表現はすべて禁止）
        for (const m of answerWoSteps.matchAll(MONEY_LIKE_RE)) {
          const token = m[1];
          if (/[一二三四五六七八九]/.test(token)) {
            // 漢数字の金額は数値化せず、注入値文字列との照合のみで判定する
            if (!priceStr.includes(token)) {
              validation.items.push("金額の混入");
              validation.matches.push(m[0]);
            }
            continue;
          }
          const n = parseNum(token);
          if (Number.isNaN(n)) continue;
          if (!allowedMoney.has(n) && !allowedMoney.has(n * 10000)) {
            validation.items.push("金額の混入");
            validation.matches.push(m[0]);
          }
        }
      }
    }

    // 表の出力は義歯・クラウン共通（Markdown表：1行に「|」が2つ以上、または <table> タグ）
    if (
      answer.split("\n").some((l) => (l.match(/\|/g)?.length || 0) >= 2) ||
      /<table[\s>]/i.test(answer)
    ) {
      validation.items.push("表の出力");
      validation.matches.push("markdown/html table");
    }

    const validationResult =
      validation.items.length > 0 ? validation : null;

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
        const generationLogBase = {
          clinic_id: clinicId,
          patient_anon_id: patientAnonId || null,
          staff_name: staffName || null,
          inputs: logInputs,
          patient_sheet: patientSheet,
          talk_script: talkScript,
        };
        const { error: genLogError } = await supabase
          .from("generation_logs")
          .insert({
            ...generationLogBase,
            // 💡 変更C：バリデータ検出時は「検出項目・検出文字列」を記録し、運用で頻度監視できるようにする
            ...(validationResult ? { validation_flags: validationResult } : {}),
          });
        if (genLogError) {
          console.warn("Generation Log Warning:", genLogError.message);
          if (validationResult) {
            // validation_flags カラム未作成等の場合でも、ベース記録だけは残す
            const { error: retryError } = await supabase
              .from("generation_logs")
              .insert(generationLogBase);
            if (retryError) {
              console.warn("Generation Log Retry Warning:", retryError.message);
            }
          }
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
      // 💡 変更C：バリデータの検出結果（検出なしは null）。クライアントは検出時に結果表示をブロックする
      validation: validationResult,
    });
  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "サーバー内部エラー" },
      { status: 500 }
    );
  }
}
