// 変更C（最小バリデータ）の動作検証：app/api/counseling/route.ts から実装本体を抽出してテストする
import { readFileSync } from "fs";

const src = readFileSync("app/api/counseling/route.ts", "utf8");

const startMarker = "const BANNED_WORDS";
const endMarker = "const validationResult";
const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker);
if (start === -1 || end === -1) throw new Error("validator block not found");
const code = src.slice(start, end);

const jsCode = code
  .replace(/:\s*Set<[^>]*>/g, "")
  .replace(/Set<[^>]*>/g, "Set")
  .replace(/:\s*\{[^}]*\}/g, "")
  .replace(/:\s*(string|number|boolean)(\[\])?/g, "");

// 抽出コードを評価するファクトリ（body/answer を注入。isCrown は mode から導出）
const makeValidator = new Function(
  "body",
  "answer",
  "const isCrown = body.mode === 'crown';\n" +
    jsCode +
    "\nreturn validation;"
);

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? "PASS" : "FAIL") + ": " + label);
  if (!cond) failures++;
};

const baseInputs = {
  mode: "denture",
  candidate_price_range: "約25〜40万円（片顎・税込）",
  price_per_day: "約178円",
};

// V1: 正常系 — 注入値と一致する金額・定性的記述のみ → 検出なし
const v1 = makeValidator(
  baseInputs,
  [
    "弾性樹脂床スタンダードは約25万円（片顎・税込）で、1日あたり約178円です。",
    "保険の入れ歯は保険適用（1〜3割負担）でご利用いただけます。",
    "金属床は約25〜40万円のレンジです。",
  ].join("\n")
);
assert(v1.items.length === 0, "V1: 注入値の金額・定性的記述のみは検出しない");

// V2: 禁止語「仮義歯」
const v2 = makeValidator(baseInputs, "今回は仮義歯ではなく…");
assert(v2.items.some((i) => i.includes("禁止語")), "V2: 禁止語「仮義歯」を検出");

// V3: 禁止語「治療用義歯」「BPS」
const v3 = makeValidator(baseInputs, "治療用義歯・BPSについて");
assert(
  v3.items.filter((i) => i.includes("禁止語")).length === 2,
  "V3: 治療用義歯・BPSを検出: " + JSON.stringify(v3.items)
);

// V4: 注入値にない金額
const v4 = makeValidator(
  baseInputs,
  "費用はおおむね50万円〜60万円かかります。"
);
assert(
  v4.items.filter((i) => i === "金額の混入").length === 2,
  "V4: 注入値にない金額（50万円・60万円）を検出: " + JSON.stringify(v4.matches)
);

// V5: 表の出力（Markdown表）
const v5 = makeValidator(
  baseInputs,
  "比較表:\n| 項目 | 保険 | 自費 |\n| --- | --- | --- |\n| 価格 | 安い | 高い |"
);
assert(v5.items.includes("表の出力"), "V5: Markdown表を検出");

// V6: 表の出力（HTML table）
const v6 = makeValidator(baseInputs, "詳細は<table><tr><td>です</td></tr></table>です");
assert(v6.items.includes("表の出力"), "V6: HTML table を検出");

// V7: 「25万円」表記バリエーション（250000円）は注入値25万円と照合して許可
const v7 = makeValidator(
  baseInputs,
  "費用は250000円（片顎）です。"
);
assert(v7.items.length === 0, "V7: 250000円 は25万円の注入値と照合して許可");

// V8: 全角数字・カンマ区切りの金額も検出
const v8 = makeValidator(baseInputs, "費用は５０万円、別途 1,200円 がかかります。");
assert(
  v8.items.filter((i) => i === "金額の混入").length === 2,
  "V8: 全角数字・カンマ区切りの金額を検出: " + JSON.stringify(v8.matches)
);

// V9: 検出文字列が matches に記録される（ログ記録用）
const v9 = makeValidator(baseInputs, "仮義歯は約99円です\n| a | b |\n<table>");
assert(
  v9.matches.length === v9.items.length && v9.matches.length === 3,
  "V9: 検出項目と検出文字列が対で記録される: " + JSON.stringify(v9)
);

// ===== クラウン側バリデータ =====
const crownBase = {
  mode: "crown",
  candidate_price_range: "約8万円〜15万円（税込）",
  first_candidate: "ジルコニアクラウン",
};

// マトリクス#7: standard で candidate_price_range にない金額をブロック
const c1 = makeValidator(
  { ...crownBase, sheet_mode: "standard" },
  "ジルコニアクラウンは約50万円かかる場合があります。"
);
assert(
  c1.items.filter((i) => i === "金額の混入").length === 1,
  "マトリクス#7: クラウン standard で注入値にない金額(50万円)をブロック: " + JSON.stringify(c1.matches)
);
// 注入値内の金額は許可
const c2 = makeValidator(
  { ...crownBase, sheet_mode: "standard" },
  "ジルコニアクラウンは約8万円〜15万円（税込）です。"
);
assert(c2.items.length === 0, "クラウン standard: 注入値の金額レンジは許可");
// クラウンでは義歯用の禁止語チェックは行わない（今回実装しない）
const c3 = makeValidator(
  { ...crownBase, sheet_mode: "standard" },
  "BPSに関する記述はありません。"
);
assert(
  c3.items.length === 0,
  "クラウン: 禁止語照合は実装しない（BPS でもブロックしない）"
);

// マトリクス#8: standard で Markdown表をブロック（義歯と同一ロジック）
const c4 = makeValidator(
  { ...crownBase, sheet_mode: "standard" },
  "比較:\n| 項目 | 保険 | 自費 |\n| --- | --- | --- |"
);
assert(c4.items.includes("表の出力"), "マトリクス#8: クラウン standard で Markdown表をブロック");

// マトリクス#6: careful で第一候補名・数字の混入をブロック
const c5 = makeValidator(
  { ...crownBase, sheet_mode: "careful" },
  "■ ステップ0\nまずは検査を優先しましょう。ジルコニアクラウンのことは触れません。"
);
assert(
  c5.items.some((i) => i.includes("first_candidate")),
  "マトリクス#6a: careful で first_candidate 名称の混入をブロック"
);
const c6 = makeValidator(
  { ...crownBase, sheet_mode: "careful" },
  "■ ステップ0\n検査は3回必要です。今は痛みの確認を優先しましょう。"
);
assert(
  c6.items.some((i) => i.includes("数字")),
  "マトリクス#6b: careful で数字の混入をブロック: " + JSON.stringify(c6.items)
);
// careful の正常出力（ステップ番号以外に数字・候補名なし）は通過
const c7 = makeValidator(
  { ...crownBase, sheet_mode: "careful" },
  "■ ステップ0／ご案内\n【全文】まずは検査からはじめましょう。痛みのある場合は検査を優先します。"
);
assert(
  c7.items.length === 0,
  "マトリクス#6c: careful の正常出力（ステップ番号のみ）はブロックしない"
);
// careful で表が混入してもブロック（表検出は共通）
const c8 = makeValidator(
  { ...crownBase, sheet_mode: "careful" },
  "■ ステップ0\nまずは検査から。\n| a | b |\n| --- | --- |"
);
assert(c8.items.includes("表の出力"), "クラウン careful: 表の混入もブロック（共通ロジック）");

// candidate_price_range が空の場合：金額らしき表現が一切ないことを要求
const c9 = makeValidator(
  { mode: "crown", candidate_price_range: "", sheet_mode: "standard" },
  "費用は 5000円 です。"
);
assert(
  c9.items.includes("金額の混入"),
  "クラウン: 注入値空の場合、金額らしき表現をブロック"
);
const c10 = makeValidator(
  { mode: "crown", candidate_price_range: "", sheet_mode: "standard" },
  "素材の特徴を説明します。"
);
assert(
  c10.items.length === 0,
  "クラウン: 注入値空＆金額らしき表現なしは許可"
);

// ===== C2誤検出の回帰：構造番号・非金額数字は許可、金額はブロック =====
// クラウン insurance_first＋注入値空で、数字が「ステップ1〜4」のみの出力は通過する
const r1 = makeValidator(
  { mode: "crown", candidate_price_range: "", sheet_mode: "insurance_first" },
  "■ ステップ1: オープニング\nこんにちは。\n■ ステップ2: 素材の説明\n保険の被せ物について。\n■ ステップ3: 次の一歩\n検査からはじめましょう。\n■ ステップ4: クロージング\nご不明点はお尋ねください。"
);
assert(
  r1.items.length === 0,
  "回帰1: クラウンinsurance_firstでステップ1〜4のみの出力は通過する: " + JSON.stringify(r1.items)
);
// 「5年間」等の金額でない数字も許可される
const r2 = makeValidator(
  { mode: "crown", candidate_price_range: "", sheet_mode: "standard" },
  "保証期間は5年間です。■ ステップ1: 説明"
);
assert(
  r2.items.length === 0,
  "回帰2: 「5年間」等の非金額数字は許可される（誤検出しない）"
);
// 漢数字の金額も検出対象（注入値にない金額はブロック）
const r3 = makeValidator(
  { ...crownBase, sheet_mode: "standard" },
  "治療費は五万円です。"
);
assert(
  r3.items.includes("金額の混入"),
  "回帰3: 漢数字の金額（注入値にない）をブロック: " + JSON.stringify(r3.matches)
);
// 全角・カンマ区切りの金額も検出対象
const r4 = makeValidator(
  { mode: "crown", candidate_price_range: "", sheet_mode: "standard" },
  "別途 1,200円 の費用がかかります。"
);
assert(
  r4.items.includes("金額の混入"),
  "回帰4: カンマ区切りの金額をブロック: " + JSON.stringify(r4.matches)
);

// ===== 医院別価格（Phase1）T9: 新フォーマット注入時の照合 =====
// デフォルトの新フォーマット注入（カンマ区切り円表記）: AI出力が注入値と一致すればPASS
const t9DentureBase = {
  mode: "denture",
  candidate_price_range: "約250,000〜400,000円（片顎・税込）",
  price_per_day: "約178円",
};
const t9a = makeValidator(
  t9DentureBase,
  "金属床は約25万円〜40万円（片顎・税込）で、1日あたり約178円です。"
);
assert(
  t9a.items.length === 0,
  "T9a: 義歯新フォーマット注入で、万円表記のAI出力（25万・40万・178円）は照合して許可"
);
const t9b = makeValidator(
  t9DentureBase,
  "費用は50万円です。"
);
assert(
  t9b.items.some((i) => i === "金額の混入"),
  "T9b: 義歯新フォーマット注入で、創作金額（50万円）はブロック"
);
// crown 医院価格注入（単一・レンジ）: 一致すればPASS、創作はブロック
const t9c = makeValidator(
  { mode: "crown", candidate_price_range: "121,000円（税込）", sheet_mode: "standard" },
  "フルジルコニアは121,000円（税込）です。"
);
assert(
  t9c.items.length === 0,
  "T9c: crown 単一価格注入（121,000円）と一致するAI出力は許可"
);
const t9d = makeValidator(
  { mode: "crown", candidate_price_range: "121,000円（税込）", sheet_mode: "standard" },
  "フルジルコニアは130,000円（税込）です。"
);
assert(
  t9d.items.some((i) => i === "金額の混入"),
  "T9d: crown 単一価格注入と一致しない金額（130,000円）はブロック"
);
const t9e = makeValidator(
  { mode: "crown", candidate_price_range: "100,000〜120,000円（税込）", sheet_mode: "standard" },
  "e.maxは10万円〜12万円（税込）のレンジです。"
);
assert(
  t9e.items.length === 0,
  "T9e: crown レンジ注入（100,000〜120,000円）と万円表記で一致するAI出力は許可"
);
const t9f = makeValidator(
  { mode: "crown", candidate_price_range: "100,000〜120,000円（税込）", sheet_mode: "standard" },
  "e.maxは15万円です。"
);
assert(
  t9f.items.some((i) => i === "金額の混入"),
  "T9f: crown レンジ注入と一致しない金額（15万円）はブロック"
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);