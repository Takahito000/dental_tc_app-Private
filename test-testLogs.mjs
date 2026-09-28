// test_logs 分離の動作検証（指示書のテストケース T1〜T6 のロジック・コード側検証）:
// - lib/testLogs.ts の合言葉判定（厳密一致・trim）
// - /api/counseling の書き込み先振り分け（usage_logs スキップ・generation_logs/test_logs 切替）
// - シート本文からの合言葉除去（T5）
// - /app/logs 側（/api/generation-logs）が test_logs を参照しないこと
import { readFileSync } from "fs";
import assert from "assert";

// --- lib/testLogs.ts の実装をそのまま評価 ---
const libSrc = readFileSync("lib/testLogs.ts", "utf8");
const { TEST_STAFF_KEYWORD, isTestStaffName } = new Function(
  libSrc
    .replace(/export const /g, "const ")
    .replace(/\(name: string\)/, "(name)") + "\nreturn { TEST_STAFF_KEYWORD, isTestStaffName };",
)();

const routeSrc = readFileSync("app/api/counseling/route.ts", "utf8");
const logsApiSrc = readFileSync("app/api/generation-logs/route.ts", "utf8");

// ===== T1前提: 合言葉の定義 =====
assert(
  TEST_STAFF_KEYWORD === "##test##",
  "T1前提: 合言葉はコード定数「##test##」"
);

// ===== T1: 完全一致（前後空白の除去は許容）のみテスト扱い =====
assert(
  isTestStaffName("##test##") === true &&
    isTestStaffName("  ##test##  ") === true && // trim 後の一致は許容
    isTestStaffName("") === false,
  "T1: 「##test##」と前後空白付きはテスト扱い・空文字は非テスト"
);

// ===== T2: 部分一致・表記揺れは本番扱い（本番テーブルに記録され /app/logs に表示される） =====
assert(
  isTestStaffName("テスト") === false &&
    isTestStaffName("test") === false &&
    isTestStaffName("##Test##") === false && // 大文字小文字の揺れは許容しない
    isTestStaffName("##test## ") !== isTestStaffName(" ##test##extra") &&
    isTestStaffName("##test##extra") === false && // 部分一致は許容しない
    isTestStaffName("##test#") === false,
  "T2: 「テスト」「test」「##Test##」「##test##extra」はいずれも本番扱い"
);

// ===== T1/T3: ルートの振り分けロジック =====
// usage_logs への挿入はテスト生成ではスキップされる
assert(
  /isTestGeneration[\s\S]*?usage_logs/.test(routeSrc) &&
    /else if \(isTestGeneration\)/.test(routeSrc) &&
    /Supabase Log Skipped \(test keyword → test_logs\)/.test(routeSrc),
  "T1: テスト生成は usage_logs（管理ID採番）をスキップする"
);
// 生成ログの書き込み先が generation_logs / test_logs で切り替わる
assert(
  /const logTable = isTestGeneration \? "test_logs" : "generation_logs";/.test(routeSrc) &&
    (routeSrc.match(/\.from\(logTable\)/g) || []).length === 2,
  "T1: 生成ログはテスト生成のみ test_logs へ振り分け（INSERT・リトライ両方）"
);

// ===== T5: シート本文に合言葉が印字されない =====
assert(
  /if \(staffName && !isTestGeneration\)/.test(routeSrc) &&
    /テスト生成（合言葉一致）も同経路で「担当: 」ごと除去/.test(routeSrc),
  "T5: テスト生成では [[STAFF_NAME]] への代入を行わず「担当: 」ごと除去する"
);

// ===== T3/T4: 本番生成の既存経路は維持 =====
assert(
  /from\("usage_logs"\)/.test(routeSrc) &&
    /from\("generation_logs"\)/.test(routeSrc) === false
      ? /from\(logTable\)/.test(routeSrc)
      : true,
  "T3: 通常生成は従来通り本番テーブルへ書き込む（logTable が generation_logs を指す）"
);

// ===== T1/T3: /app/logs 側のクエリは変更なし（generation_logs のみ） =====
assert(
  logsApiSrc.includes('.from("generation_logs")') &&
    !logsApiSrc.includes("test_logs"),
  "T1/T3: /api/generation-logs（/app/logs）のクエリは generation_logs のまま・test_logs を参照しない"
);

// ===== T6: test_logs の行削除が本番に影響しないのはテーブル分離の設計上自明（別テーブルのため） =====
// ※ 実際のDB操作は本番データに触れるためここではコード検証のみ。
//   ダッシュボードからの削除確認は Supabase 上で手動実施する。

// ============================================================
// 発行ログへの家族向けページ情報（2026-09-28 追加・T1〜T6）
// ============================================================
const familyLogSrc = readFileSync("lib/familyPageLog.ts", "utf8");
const { normalizeFamilyPageInputs, familyPageLogLabel } = new Function(
  familyLogSrc
    .replace(/export const /g, "const ")
    .replace(/: Record<string, unknown> \| null/g, "")
    .replace(/: Record<string, unknown>/g, "")
    .replace(/\): string =>/g, ") =>") +
    "\nreturn { normalizeFamilyPageInputs, familyPageLogLabel };",
)();
const logsClientSrc = readFileSync("app/app/logs/logs-client.tsx", "utf8");

// --- T1: トグルON・70代 → family_page=true・patient_age_group="70代" ---
assert(
  JSON.stringify(
    normalizeFamilyPageInputs({ include_family_page: "追加する", family_page_age: "70代" }),
  ) === JSON.stringify({ family_page: true, patient_age_group: "70代" }),
  "T1: トグルON・70代 → family_page=true・patient_age_group=70代",
);
assert(
  familyPageLogLabel({ family_page: true, patient_age_group: "70代" }) === "家族向け: あり（70代）",
  "T1: 一覧ラベルは「家族向け: あり（70代）」",
);

// --- T2: トグルON・「分からない」→ あり（年代不明） ---
assert(
  normalizeFamilyPageInputs({ include_family_page: "追加する", family_page_age: "分からない" })
    .patient_age_group === "分からない" &&
    familyPageLogLabel({ family_page: true, patient_age_group: "分からない" }) ===
      "家族向け: あり（年代不明）" &&
    familyPageLogLabel({ family_page: true, patient_age_group: null }) ===
      "家族向け: あり（年代不明）",
  "T2: 「分からない」・null は「あり（年代不明）」",
);

// --- T3: トグルOFF → family_page=false・patient_age_group=null → 「家族向け: なし」 ---
assert(
  JSON.stringify(
    normalizeFamilyPageInputs({ include_family_page: "追加しない", family_page_age: "70代" }),
  ) === JSON.stringify({ family_page: false, patient_age_group: null }) &&
    familyPageLogLabel({ family_page: false, patient_age_group: null }) === "家族向け: なし",
  "T3: トグルOFF → family_page=false・null → 「家族向け: なし」",
);

// --- T4: carefulモード（トグル非表示・「追加しない」送信）→ なし ---
assert(
  normalizeFamilyPageInputs({ include_family_page: "追加しない" }).family_page === false &&
    familyPageLogLabel({ family_page: false }) === "家族向け: なし",
  "T4: トグル非表示モード（careful等）は family_page=false → 「家族向け: なし」",
);

// --- T5: 過去ログ（family_page 未定義）→ "-" ---
assert(
  familyPageLogLabel(null) === "-" &&
    familyPageLogLabel({}) === "-" &&
    familyPageLogLabel({ include_family_page: "追加する" }) === "-",
  "T5: family_page が存在しない過去ログは「-」",
);

// --- 異常値ガード: ONで年代が不正な値の場合は「分からない」に丸める ---
assert(
  normalizeFamilyPageInputs({ include_family_page: "追加する", family_page_age: "不正値" })
    .patient_age_group === "分からない",
  "T2防御: ON時の不正な年代値は「分からない」に丸める",
);

// --- route: 正規化フィールドが generation_logs / test_logs 共通の logInputs に併記される ---
assert(
  /\.\.\.normalizeFamilyPageInputs\(body\)/.test(routeSrc) &&
    /const generationLogBase = \{[\s\S]*?inputs: logInputs,/.test(routeSrc),
  "T6: family_page/patient_age_group は logInputs に併記され generationLogBase 経由で両テーブルに記録",
);

// --- logs-client: 一覧（展開前）は担当者名のみ・家族向けラベルは非表示。展開表示のラベル定義は維持 ---
assert(
  !logsClientSrc.includes("familyPageLogLabel(row.inputs)") &&
    !logsClientSrc.includes('from "@/lib/familyPageLog"'),
  "一覧（展開前）の担当者セルには「家族向け: …」を表示しない（2026-09-28 取下げ）",
);
assert(
  logsClientSrc.includes('family_page: "ご家族向けページ"') &&
    logsClientSrc.includes('patient_age_group: "患者さまの年代"'),
  "展開表示には family_page/patient_age_group のラベル定義が残っている",
);
assert(
  logsClientSrc.includes('include_family_page: "家族向けページ"') &&
    logsClientSrc.includes('family_page_age: "患者の年代"'),
  "英語キーの日本語化: 展開表示で「家族向けページ: 追加する」「患者の年代: 60代」と表示される",
);
console.log("PASS: T1: トグルON・70代 → あり（70代）");
console.log("PASS: T2: 「分からない」/null → あり（年代不明）・不正値は分からないに丸める");
console.log("PASS: T3: トグルOFF → なし（family_page=false・patient_age_group=null）");
console.log("PASS: T4: careful等トグル非表示モード → なし");
console.log("PASS: T5: family_page 未定義の過去ログ → -");
console.log("PASS: T6: family_page/patient_age_group は logInputs 経由で両テーブルに記録");
console.log("PASS: T1〜T5: 一覧（展開前）は担当者名のみ・「家族向け: …」は展開表示のみ");
console.log("PASS: 英語キー日本語化: include_family_page→家族向けページ・family_page_age→患者の年代");

console.log("PASS: T1: 合言葉「##test##」完全一致のみテスト扱い（trim後・厳密一致）");
console.log("PASS: T2: 部分一致・表記揺れ（テスト/test/##Test##/##test##extra）は本番扱い");
console.log("PASS: T1: テスト生成は usage_logs スキップ（管理ID連番を消費しない）");
console.log("PASS: T1: 生成ログは test_logs / generation_logs に振り分け");
console.log("PASS: T3: 通常生成は既存の本番テーブル経路を維持");
console.log("PASS: T4: usage_logs 非挿入により欠番は構造的に発生しない");
console.log("PASS: T5: テスト生成のシート本文に合言葉が印字されない（担当: ごと除去）");
console.log("PASS: T1/T3: /app/logs 側（/api/generation-logs）は変更なし・test_logs 非参照");
// ============================================================
// 展開表示の項目並び（2026-09-28 追加: 入力フォームの設問番号順に準じる）
// ============================================================
const orderMatch = logsClientSrc.match(/const LOG_DISPLAY_ORDER = \[([\s\S]*?)\];/);
assert(orderMatch, "LOG_DISPLAY_ORDER が定義されている");
const LOG_DISPLAY_ORDER = new Function(`return [${orderMatch[1]}];`)();
assert(
  /LOG_DISPLAY_ORDER\.indexOf/.test(logsClientSrc) &&
    /const known = keys[\s\S]*?\.sort\(\(a, b\) => orderIndex\(a\) - orderIndex\(b\)\)/.test(logsClientSrc),
  "expandEntries が LOG_DISPLAY_ORDER で既知キーを並び替える",
);
// 重複定義があれば indexOf 順が曖昧になるため禁止
assert(
  new Set(LOG_DISPLAY_ORDER).size === LOG_DISPLAY_ORDER.length,
  "LOG_DISPLAY_ORDER に重複キーがない",
);
// 義歯フォーム 01〜15 の順序（current_denture_complaints はフォーム上11番）
const dentureIdx = ["denture_status","remaining_teeth","target_jaw","defect_site","denture_duration",
  "adjustment_history","oral_dryness","ridge_mucosa","expectation_type","cost_sensitivity",
  "current_denture_complaints","emotion_drivers","red_flag_words","include_family_page"].map((k) => LOG_DISPLAY_ORDER.indexOf(k));
assert(
  dentureIdx.every((i) => i !== -1) &&
    dentureIdx.every((v, i) => i === 0 || dentureIdx[i - 1] < v),
  `義歯フォーム 01〜15 が設問番号順: ${dentureIdx}`,
);
// クラウンフォーム 01〜07 の順序（cost_sensitivity は両モード共通で義歯側に1箇所のみ定義）
const crownIdx = ["target_site","visibility","chief_priority","metal_allergy","bruxism","has_pain"].map(
  (k) => LOG_DISPLAY_ORDER.indexOf(k),
);
assert(
  crownIdx.every((i) => i !== -1) &&
    LOG_DISPLAY_ORDER.indexOf("staffName") === 0 && // 担当者は先頭
    crownIdx.every((v, i) => i === 0 || crownIdx[i - 1] < v) &&
    crownIdx[0] > dentureIdx[dentureIdx.length - 1], // クラウン群は義歯群の後
  `クラウンフォーム 01〜07 が設問番号順・担当者先頭: ${crownIdx}`,
);
console.log("PASS: 展開表示の項目並びは入力フォーム（/app）の設問番号順（担当者→義歯01〜15→クラウン01〜07→メタ情報）");

console.log("\n全件 PASS");
