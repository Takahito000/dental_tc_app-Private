import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ============================================================
// 組織力チェック（/check）の匿名回答ログ保存API
// - 新テーブル org_check_responses へ insert（テーブル作成SQLはユーザー実行）
// - 医院名・個人情報・メールアドレスは一切受け取らない
// - 保存失敗でもフロントの結果表示を妨げない（fire-and-forget）
// ============================================================

const VALID_Q_CODES = [0, 1, 2, null]; // Q1〜Q8: 数値コード（null = 分からない）
const VALID_E1_CODES = ["0", "1", "2", null]; // E1: 文字列コード（null = 分からない）
const Q_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
const VALID_ORG_TYPES = ["1", "2", "3", "4", "partial"];

function isValidQCode(v: unknown): boolean {
  return (VALID_Q_CODES as unknown[]).includes(v === undefined ? null : v);
}

function isValidE1Code(v: unknown): boolean {
  return (VALID_E1_CODES as unknown[]).includes(v === undefined ? null : v);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const answers = body?.answers as Record<string, unknown> | undefined;
  const orgType = (body?.org_type || "").toString();
  const utmSource =
    typeof body?.utm_source === "string" && body.utm_source.trim()
      ? body.utm_source.trim().slice(0, 100)
      : null;

  // バリデーション： q1〜q8 は 0/1/2/null（数値）・e1 は "0"/"1"/"2"/null（文字列）・org_type は規定値のみ
  if (
    !answers ||
    typeof answers !== "object" ||
    !Q_KEYS.every((k) => k in answers && isValidQCode(answers[k])) ||
    !("e1" in answers && isValidE1Code(answers.e1)) ||
    !VALID_ORG_TYPES.includes(orgType)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("org_check_responses").insert({
      answers: {
        ...Q_KEYS.reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = answers[k] === undefined ? null : answers[k];
          return acc;
        }, {}),
        e1: answers.e1 === undefined ? null : answers.e1,
      },
      org_type: orgType,
      utm_source: utmSource,
    });
    if (error) {
      console.error("OrgCheck API Insert Error:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("OrgCheck API Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
