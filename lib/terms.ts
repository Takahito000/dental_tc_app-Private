import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// 利用規約 同意ゲート 共通定数・ヘルパー（KC-063）
// - 規約改訂時は CURRENT_TERMS_VERSION を上げる。
//   全トークンが新バージョンに対する未同意扱いになり、再同意ゲートがかかる構造。
// - 同意チェックは必ずサーバ側で行う（クライアント側のみの制御はスキップ可能なため禁止）。
// ============================================================

export const CURRENT_TERMS_VERSION = "1.0";

// kimishikaと同一の問い合わせフォーム（/terms 付則のリンク先）
export const CONTACT_FORM_URL =
  "https://cs-lab2024.notion.site/3facffab5ad0805084a6f7afdbabec14";

/**
 * 医院が現行バージョンの規約に同意済みかをサーバ側で判定する。
 * クエリ失敗（テーブル未作成等）はフェイルセーフで「同意済み」相当（true）を返し、
 * ゲートによって既存利用を妨げない（マイグレーション適用前のデプロイでも動作し続ける）。
 */
export async function hasTermsConsent(
  supabase: SupabaseClient,
  clinicId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("terms_consents")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("tos_version", CURRENT_TERMS_VERSION)
    .limit(1);
  if (error) {
    console.warn(
      "Terms consent check failed (fail-safe: ゲートを通す):",
      error.message
    );
    return true;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * 同意を記録する。同一バージョンへの二重同意は unique (clinic_id, tos_version)
 * により冪等に処理され、既存レコードを採用する。
 */
export async function recordTermsConsent(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ agreedAt: string | null; already: boolean }> {
  const { data, error } = await supabase
    .from("terms_consents")
    .insert({ clinic_id: clinicId, tos_version: CURRENT_TERMS_VERSION })
    .select("agreed_at")
    .single();
  if (!error && data) {
    return { agreedAt: data.agreed_at ?? null, already: false };
  }
  // 一意制約違反（二重押下・再同意）は正常系：既存レコードを採用する
  const { data: existing } = await supabase
    .from("terms_consents")
    .select("agreed_at")
    .eq("clinic_id", clinicId)
    .eq("tos_version", CURRENT_TERMS_VERSION)
    .limit(1);
  const row = Array.isArray(existing) ? existing[0] : null;
  return { agreedAt: row?.agreed_at ?? null, already: true };
}
