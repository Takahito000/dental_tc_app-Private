// 医院別価格設定（Phase1）の動作検証：
// app/app/page.tsx から実際の定数・生成関数・判定関数を抽出してテストする
// 対応: 指示書 §8 の T1〜T5, T7, T8（T6/T9 は test-validator.mjs と devサーバ確認でカバー）
import { readFileSync } from "fs";

const src = readFileSync("app/app/page.tsx", "utf8");

// --- 抽出ヘルパー ---
const extractConstSrc = (name) => {
  const re = new RegExp(`const ${name}(\\s*:\\s*[^=]+)?\\s*=\\s*([\\s\\S]*?);\\n`);
  const m = src.match(re);
  if (!m) throw new Error(`${name} not found`);
  return m[2];
};

// アロー関数定数用: `=>` 後がブロックならブレース対応で、式なら `;` まで抽出
const extractArrowSrc = (name) => {
  const start = src.indexOf(`const ${name} =`);
  if (start === -1) throw new Error(`${name} not found`);
  const arrow = src.indexOf("=>", start);
  let i = arrow + 2;
  while (src[i] === " " || src[i] === "\n") i++;
  let end;
  if (src[i] === "{") {
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    end = i + 1; // 本体の閉じブレースの直後
  } else {
    end = src.indexOf(";", arrow);
  }
  return src.slice(src.indexOf("=", start) + 1, end).trim();
};

const extractFunctionSrc = (name) => {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found`);
  let i = src.indexOf("{\n", start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(start, i + 1);
};

const stripTypes = (code) =>
  code
    .replace(/ as const/g, "")
    .replace(/ as string/g, "")
    .replace(/ as DentureMaterialKey/g, "")
    .replace(/ as keyof typeof CROWN_CANDIDATES/g, "")
    .replace(/new Map<[^>]*>/g, "new Map")
    .replace(/:\s*Decision\["sheetMode"\]/g, "")
    .replace(/:\s*CrownCandidate\b/g, "")
    .replace(/:\s*Candidate\b/g, "")
    .replace(/:\s*ResolvedPrice\b/g, "")
    .replace(/:\s*ClinicPriceMap\b/g, "")
    .replace(/:\s*FormState\b/g, "")
    .replace(/:\s*CrownFormState\b/g, "")
    .replace(/:\s*CrownDecision\b/g, "")
    .replace(/:\s*Decision\b/g, "")
    .replace(/:\s*DentureMaterialKey\b/g, "")
    .replace(/:\s*(string|number|boolean)\[\]/g, "")
    .replace(/:\s*string\b/g, "")
    .replace(/:\s*number\b/g, "");

// --- 対象コードをまとめて評価（同一スコープで自由変数を解決）---
// 定数は「const NAME = 値;」形式で束ねる（オブジェクトリテラルが文の先頭だとブロックと解釈されるため）
const bundle = [
  "const CANDIDATES = " + extractConstSrc("CANDIDATES"),
  "const CROWN_CANDIDATES = " + extractConstSrc("CROWN_CANDIDATES"),
  "const formatYen = " + extractArrowSrc("formatYen"),
  "const denturePriceRangeText = " + extractArrowSrc("denturePriceRangeText"),
  "const dentureTableCostText = " + extractArrowSrc("dentureTableCostText"),
  "const crownPriceText = " + extractArrowSrc("crownPriceText"),
  "const pricePerDayText = " + extractArrowSrc("pricePerDayText"),
  "const DENTURE_KEY_BY_CANDIDATE = " + extractArrowSrc("DENTURE_KEY_BY_CANDIDATE"),
  "const CROWN_KEY_BY_CANDIDATE = " + extractArrowSrc("CROWN_KEY_BY_CANDIDATE"),
  "const resolveDenturePrice = " + extractArrowSrc("resolveDenturePrice"),
  "const resolveCrownPrice = " + extractArrowSrc("resolveCrownPrice"),
  extractFunctionSrc("resolveDentureMaterialKey"),
  extractFunctionSrc("computeDecision"),
  extractFunctionSrc("computeCrownDecision"),
].join("\n");

const api = new Function(
  stripTypes(bundle) +
    "\nreturn { CANDIDATES, CROWN_CANDIDATES, denturePriceRangeText, dentureTableCostText, crownPriceText, pricePerDayText, resolveDenturePrice, resolveCrownPrice, resolveDentureMaterialKey, computeDecision, computeCrownDecision };"
)();

// --- テスト用フォーム状態 ---
const dentureBase = {
  mode: "denture",
  denture_status: "使っている",
  remaining_teeth: "ほとんど無い",
  target_jaw: "上顎",
  defect_site: "該当なし（総義歯）",
  current_denture_complaints: [],
  denture_duration: "1〜5年",
  adjustment_history: "調整しても改善しない",
  oral_dryness: "普通",
  ridge_mucosa: "しっかり",
  emotion_drivers: ["家族と食事"],
  expectation_type: "快適なら満足",
  cost_sensitivity: "価値が高ければ許容",
  red_flag_words: ["特になし"],
};
const crownBase = {
  mode: "crown",
  target_site: "前歯（1〜3番）",
  visibility: "よく見える",
  chief_priority: "見た目の自然さ",
  metal_allergy: "特になし",
  bruxism: "特になし",
  has_pain: "特になし",
  cost_sensitivity: "特になし",
  free_memo: "",
};

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? "PASS" : "FAIL") + ": " + label);
  if (!cond) failures++;
};

// ===== T1: 上書きなし（= 医院行なし・未登録トークン）→ デフォルト定数で表示・注入 =====
// 期待: カンマ区切り円表記に統一（確定仕様。既存医院の万表記→円表記変更は了承済み）
const t1_metal = api.computeDecision({
  ...dentureBase,
  remaining_teeth: "少しある", // PD
  current_denture_complaints: ["噛めない"],
});
assert(
  t1_metal.candidatePriceRange === "約250,000〜400,000円（片顎・税込）",
  "T1: METAL_PD デフォルト注入「約250,000〜400,000円（片顎・税込）」: " +
    t1_metal.candidatePriceRange
);
assert(
  t1_metal.pricePerDay === "約178円",
  "T1: METAL_PD デフォルト日割り midPrice 325,000÷1825 → 約178円: " +
    t1_metal.pricePerDay
);

const t1_silicone = api.computeDecision({
  ...dentureBase,
  remaining_teeth: "少しある", // PD
  current_denture_complaints: ["痛い"],
});
assert(
  t1_silicone.candidatePriceRange === "約270,000円（片顎・税込）",
  "T1: SILICONE デフォルト注入「約270,000円（片顎・税込）」（統一フォーマット）: " +
    t1_silicone.candidatePriceRange
);
assert(
  t1_silicone.pricePerDay === "約148円",
  "T1: SILICONE デフォルト日割り 270,000÷1825 → 約148円: " +
    t1_silicone.pricePerDay
);

const t1_precision = api.computeDecision({
  ...dentureBase,
  current_denture_complaints: ["外れやすい"],
});
assert(
  t1_precision.candidatePriceRange === "約330,000〜550,000円（片顎・税込）",
  "T1: PRECISION デフォルト注入「約330,000〜550,000円（片顎・税込）」: " +
    t1_precision.candidatePriceRange
);

const t1_elastic = api.computeDecision({
  ...dentureBase,
  remaining_teeth: "少しある",
  defect_site: "前歯部",
  current_denture_complaints: ["見た目が悪い"],
});
assert(
  t1_elastic.candidatePriceRange === "約150,000円（片顎・税込）",
  "T1: ELASTIC_STANDARD デフォルト注入「約150,000円（片顎・税込）」: " +
    t1_elastic.candidatePriceRange
);

const t1_crown_emax = api.computeCrownDecision(crownBase);
assert(
  t1_crown_emax.candidatePriceRange === "100,000円（税込）",
  "T1: EMAX デフォルト注入「100,000円（税込）」（現行表記と一致）: " +
    t1_crown_emax.candidatePriceRange
);
const t1_crown_fz = api.computeCrownDecision({
  ...crownBase,
  target_site: "小臼歯（4〜5番）",
  chief_priority: "強度・長持ち",
});
assert(
  t1_crown_fz.candidatePriceRange === "95,000円（税込）",
  "T1: FULL_ZIRCONIA デフォルト注入「95,000円（税込）」（現行表記と一致）: " +
    t1_crown_fz.candidatePriceRange
);

// 比較表コスト（生成関数経由・デフォルト）
assert(
  api.dentureTableCostText(api.resolveDenturePrice("ELASTIC_STANDARD", {}), "ELASTIC_STANDARD") ===
    "約150,000円（税込・片額）",
  "T1: 比較表コスト ELASTIC_STANDARD「約150,000円（税込・片額）」"
);
assert(
  api.dentureTableCostText(api.resolveDenturePrice("METAL_PD", {}), "METAL_PD") ===
    "約250,000〜400,000円（税込・片額）",
  "T1: 比較表コスト METAL_PD「約250,000〜400,000円（税込・片額）」"
);
assert(
  api.dentureTableCostText(api.resolveDenturePrice("SILICONE", {}), "SILICONE") ===
    "約270,000円（税込・片額。後付けの場合は別途100,000〜150,000円程度）",
  "T1: 比較表コスト SILICONE（後付け注記は既存文言を維持・数値のみ円表記へ）"
);
assert(
  api.crownPriceText(api.resolveCrownPrice("GOLD", {})) === "180,000円（税込）",
  "T1: 比較表コスト GOLD「180,000円（税込）」"
);

// firstCandidate → 素材キー解決
assert(
  api.resolveDentureMaterialKey(t1_metal.firstCandidate) === "METAL_PD" &&
    api.resolveDentureMaterialKey("金属床（コバルトクロム）総義歯") === "METAL_FD" &&
    api.resolveDentureMaterialKey(t1_silicone.firstCandidate) === "SILICONE" &&
    api.resolveDentureMaterialKey(t1_precision.firstCandidate) === "PRECISION" &&
    api.resolveDentureMaterialKey(t1_elastic.firstCandidate) === "ELASTIC_STANDARD",
  "T1: firstCandidate → 素材キー解決が全候補で正しい"
);

// ===== T2: crown 単一価格（min=NULL, max=121000, FULL_ZIRCONIA）→ 「121,000円（税込）」 =====
const t2Overrides = {
  "crown:FULL_ZIRCONIA": { priceMin: null, priceMax: 121000 },
};
const t2 = api.computeCrownDecision(
  { ...crownBase, target_site: "小臼歯（4〜5番）", chief_priority: "強度・長持ち" },
  t2Overrides
);
assert(
  t2.candidatePriceRange === "121,000円（税込）" &&
    api.crownPriceText(api.resolveCrownPrice("FULL_ZIRCONIA", t2Overrides)) ===
      "121,000円（税込）",
  "T2: crown/FULL_ZIRCONIA 上書き「121,000円（税込）」（注入・比較表が一致）: " +
    t2.candidatePriceRange
);

// ===== T3: crown レンジ（min=100000, max=120000, EMAX）→ 「100,000〜120,000円（税込）」 =====
const t3Overrides = {
  "crown:EMAX": { priceMin: 100000, priceMax: 120000 },
};
const t3 = api.computeCrownDecision(crownBase, t3Overrides);
assert(
  t3.candidatePriceRange === "100,000〜120,000円（税込）" &&
    api.crownPriceText(api.resolveCrownPrice("EMAX", t3Overrides)) ===
      "100,000〜120,000円（税込）",
  "T3: crown/EMAX レンジ上書き「100,000〜120,000円（税込）」（注入・比較表が一致）: " +
    t3.candidatePriceRange
);

// ===== T4: 一部素材のみ医院行あり → 該当素材のみ上書き、他はデフォルト =====
const t4Overrides = {
  "crown:GOLD": { priceMin: null, priceMax: 200000 },
};
const t4_emax = api.computeCrownDecision(crownBase, t4Overrides);
const t4_gold = api.computeCrownDecision(
  {
    ...crownBase,
    target_site: "大臼歯（6〜7番）",
    chief_priority: "強度・長持ち",
  },
  t4Overrides
);
assert(
  t4_emax.candidatePriceRange === "100,000円（税込）" &&
    t4_gold.candidatePriceRange === "200,000円（税込）",
  "T4: GOLD だけ上書き（200,000円）、EMAX はデフォルト（100,000円）維持: " +
    t4_emax.candidatePriceRange +
    " / " +
    t4_gold.candidatePriceRange
);

// ===== T5: 義歯 医院行（max=300000）→ 日割り = priceMax÷1825（Math.round・円単位） =====
const t5Overrides = {
  "denture:SILICONE": { priceMin: null, priceMax: 300000 },
};
const t5 = api.computeDecision(
  {
    ...dentureBase,
    remaining_teeth: "少しある",
    current_denture_complaints: ["痛い"],
  },
  t5Overrides
);
assert(
  t5.candidatePriceRange === "約300,000円（片顎・税込）",
  "T5: SILICONE 上書き注入「約300,000円（片顎・税込）」: " + t5.candidatePriceRange
);
assert(
  t5.pricePerDay === "約164円",
  "T5: 日割り = 300,000÷1825 = 164.38… → Math.round で 約164円（priceMax 基準）: " +
    t5.pricePerDay
);
// レンジ上書きでも日割りは priceMax 一本化（出所ベース。レンジ表記にしない）
const t5bOverrides = {
  "denture:METAL_PD": { priceMin: 200000, priceMax: 300000 },
};
const t5b = api.computeDecision(
  {
    ...dentureBase,
    remaining_teeth: "少しある",
    current_denture_complaints: ["噛めない"],
  },
  t5bOverrides
);
assert(
  t5b.candidatePriceRange === "約200,000〜300,000円（片顎・税込）" &&
    t5b.pricePerDay === "約164円",
  "T5: レンジ上書きも日割りは priceMax÷1825 → 約164円（単一値）: " +
    t5b.candidatePriceRange +
    " / " +
    t5b.pricePerDay
);
// デフォルト素材は midPrice 基準のまま（混在でも出所どおり計算）
const t5c = api.computeDecision(
  {
    ...dentureBase,
    remaining_teeth: "少しある",
    current_denture_complaints: ["噛めない"],
  },
  { "denture:SILICONE": { priceMin: null, priceMax: 300000 } }
);
assert(
  t5c.pricePerDay === "約178円",
  "T5: 上書き対象外の METAL_PD はデフォルト midPrice 基準の約178円を維持: " +
    t5c.pricePerDay
);

// ===== 不正データの扱い: min > max の行は無視してデフォルトにフォールバック =====
const badOverrides = {
  "crown:EMAX": { priceMin: 150000, priceMax: 120000 },
};
const tBad = api.computeCrownDecision(crownBase, badOverrides);
assert(
  tBad.candidatePriceRange === "100,000円（税込）",
  "防御: min>max の不正上書きは無視してデフォルト「100,000円（税込）」: " +
    tBad.candidatePriceRange
);

// ===== T7: crown insurance_first → candidate_price_range 空欄（既存仕様維持。上書きがあっても空欄） =====
const t7 = api.computeCrownDecision(
  { ...crownBase, cost_sensitivity: "費用は抑えたい" },
  t3Overrides
);
assert(
  t7.sheetMode === "insurance_first" &&
    t7.candidatePriceRange === "" &&
    t7.firstCandidate === "",
  "T7: crown insurance_first は candidate_price_range 空欄のまま（医院行があっても変更不要）"
);

// ===== T8: crown careful（has_pain）→ 候補なし出力（既存仕様維持） =====
const t8 = api.computeCrownDecision(
  { ...crownBase, has_pain: "あり" },
  t3Overrides
);
assert(
  t8.sheetMode === "careful" &&
    t8.candidatePriceRange === "" &&
    t8.firstCandidate === "",
  "T8: crown careful は候補なし・金額なしのまま（回帰なし）"
);

// 義歯 cautious も同様
const t8d = api.computeDecision(
  { ...dentureBase, red_flag_words: ["糖尿病"] },
  t5Overrides
);
assert(
  t8d.sheetMode === "cautious" &&
    t8d.candidatePriceRange === "" &&
    t8d.pricePerDay === "",
  "T8: 義歯 cautious は金額なしのまま（回帰なし）"
);

// ===== 判定ロジック本体の回帰: 上書きの有無で第一候補が変わらない =====
assert(
  t1_metal.firstCandidate ===
    api.computeDecision(
      {
        ...dentureBase,
        remaining_teeth: "少しある",
        current_denture_complaints: ["噛めない"],
      },
      { "denture:METAL_PD": { priceMin: 100000, priceMax: 200000 } }
    ).firstCandidate,
  "回帰: 価格上書きが第一候補の選定に影響しない"
);
assert(
  t1_crown_emax.firstCandidate ===
    api.computeCrownDecision(crownBase, t3Overrides).firstCandidate,
  "回帰: crown 価格上書きが第一候補の選定に影響しない"
);

if (failures > 0) {
  console.log(`\n${failures} 件の失敗`);
  process.exit(1);
}
console.log("\n全件 PASS");
