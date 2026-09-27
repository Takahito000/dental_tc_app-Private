// テスト生成の合言葉判定（2026-09-27）
// 担当者名が合言葉と完全一致（trim後）の生成リクエストは、本番テーブル
// （usage_logs / generation_logs）には一切書き込まず、代わりに test_logs に記録する。
// これにより医院向けログ画面（/app/logs）への表示・管理IDの連番消費を防ぐ。
//
// 判定は厳密一致のみ（部分一致・大文字小文字の揺れは許容しない）。
// 誤って本番データが test_logs に流れ、医院のログから消える事故を防ぐため。

// 💡 合言葉はコード定数。通常の入力で絶対に使われない文字列にすること
export const TEST_STAFF_KEYWORD = "##test##";

// 前後の空白を除去したうえで合言葉と完全一致するか
export const isTestStaffName = (name: string) =>
  (name || "").trim() === TEST_STAFF_KEYWORD;
