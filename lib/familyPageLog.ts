// 発行ログへの「ご家族向けページ」情報の正規化と一覧表示ラベル（2026-09-28）
// - 生成リクエストの include_family_page（"追加する"/"追加しない"）と family_page_age を
//   generation_logs / test_logs の inputs（JSON）へ family_page（真偽値）・patient_age_group（年代）として記録する
// - /app/logs の一覧行では「家族向け: あり（70代）」等のラベルとして表示する

// 💡 年代選択の許容値（生成画面の FAMILY_PAGE_AGE_OPTIONS と同一。以外の値は「分からない」に丸める）
export const FAMILY_PAGE_AGE_OPTIONS = ["60代", "70代", "80歳以上", "分からない"];

// 生成リクエストボディから inputs 保存用の正規化フィールドを作る。
// トグル非表示モード（careful・未使用者モード）は「追加しない」が送信されるため family_page=false になる。
export const normalizeFamilyPageInputs = (body: Record<string, unknown>) => {
  const familyPageOn = body.include_family_page === "追加する";
  const ageRaw = (body.family_page_age || "").toString();
  return {
    family_page: familyPageOn,
    patient_age_group: familyPageOn
      ? FAMILY_PAGE_AGE_OPTIONS.includes(ageRaw)
        ? ageRaw
        : "分からない"
      : null,
  };
};

// 発行ログ一覧（/app/logs）の行内ラベル。
// family_page が存在しない過去ログは "-" を返す。
export const familyPageLogLabel = (
  inputs: Record<string, unknown> | null,
): string => {
  if (!inputs || typeof inputs.family_page === "undefined") return "-";
  if (inputs.family_page !== true) return "家族向け: なし";
  const age = (inputs.patient_age_group || "").toString();
  return age && age !== "分からない"
    ? `家族向け: あり（${age}）`
    : "家族向け: あり（年代不明）";
};
