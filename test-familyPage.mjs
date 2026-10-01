// 家族向け3枚目ページの動作検証（指示書 §4 の T1〜T11）:
// app/app/page.tsx から実際の定数・ロジック関数を抽出してテストする
// （T8 の localStorage 復元・T10 の強制失敗は既存テスト同様、DOM 不要のロジック検証に留める）
import { readFileSync } from "fs";

const src = readFileSync("app/app/page.tsx", "utf8");

// --- 抽出ヘルパー（test-clinicPrices.mjs と同パターン） ---
const extractConstSrc = (name) => {
  const re = new RegExp(`const ${name}(\\s*:\\s*[^=]+)?\\s*=\\s*([\\s\\S]*?);\\n`);
  const m = src.match(re);
  if (!m) throw new Error(`${name} not found`);
  return m[2];
};

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
    end = i + 1;
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
    .replace(/new Map<[^>]*>/g, "new Map")
    .replace(/:\s*Record<[^>]*>/g, "")
    .replace(/:\s*\{[^{}]*\}\[\]/g, "")
    .replace(/:\s*TalkKeywordStep\[\]/g, "")
    .replace(/:\s*React\.CSSProperties/g, "")
    .replace(/:\s*Decision\["sheetMode"\]/g, "")
    .replace(/:\s*ResolvedPrice\b/g, "")
    .replace(/:\s*ClinicPriceMap\b/g, "")
    .replace(/:\s*FormState\b/g, "")
    .replace(/:\s*Candidate\b/g, "")
    .replace(/:\s*Decision\b/g, "")
    .replace(/:\s*DentureMaterialKey\b/g, "")
    .replace(/:\s*string\[\]/g, "")
    .replace(/:\s*string\s*\|\s*null/g, "")
    .replace(/:\s*(string|number|boolean|void)(\[\])?/g, "");

// --- 対象コードをまとめて評価 ---
const bundle = [
  "const FORM_DATA = " + extractConstSrc("FORM_DATA"),
  "const FAMILY_PAGE_STORAGE_KEY = " + extractConstSrc("FAMILY_PAGE_STORAGE_KEY"),
  "const FAMILY_PAGE_DEFAULT_AGE = " + extractConstSrc("FAMILY_PAGE_DEFAULT_AGE"),
  "const FAMILY_PAGE_AGE_OPTIONS = " + extractConstSrc("FAMILY_PAGE_AGE_OPTIONS"),
  "const FAMILY_PAGE_EMPATHY_TEMPLATE = " + extractConstSrc("FAMILY_PAGE_EMPATHY_TEMPLATE"),
  "const FAMILY_PAGE_EMPATHY_FALLBACK = " + extractConstSrc("FAMILY_PAGE_EMPATHY_FALLBACK"),
  "const FAMILY_PAGE_LIFE_LEAD = " + extractConstSrc("FAMILY_PAGE_LIFE_LEAD"),
  "const FAMILY_PAGE_LIFE_NOTE = " + extractConstSrc("FAMILY_PAGE_LIFE_NOTE"),
  "const FAMILY_PAGE_RISK_GRID_HEADING = " + extractConstSrc("FAMILY_PAGE_RISK_GRID_HEADING"),
  "const FAMILY_PAGE_RISK_CARDS = " + extractConstSrc("FAMILY_PAGE_RISK_CARDS"),
  "const FAMILY_PAGE_DAILY_METAPHORS = " + extractConstSrc("FAMILY_PAGE_DAILY_METAPHORS"),
  "const FAMILY_PAGE_MONTHLY_METAPHORS = " + extractConstSrc("FAMILY_PAGE_MONTHLY_METAPHORS"),
  "const FAMILY_PAGE_COST_MINI_NOTE = " + extractConstSrc("FAMILY_PAGE_COST_MINI_NOTE"),
  "const FAMILY_PAGE_COST_NOTE = " + extractConstSrc("FAMILY_PAGE_COST_NOTE"),
  "const FAMILY_PAGE_INSURANCE_BODY = " + extractConstSrc("FAMILY_PAGE_INSURANCE_BODY"),
  "const FAMILY_PAGE_FOOTER_GUIDE = " + extractConstSrc("FAMILY_PAGE_FOOTER_GUIDE"),
  "const FAMILY_PAGE_FOOTER_SOURCES = " + extractConstSrc("FAMILY_PAGE_FOOTER_SOURCES"),
  "const FAMILY_PAGE_AGE_MAP = " + extractConstSrc("FAMILY_PAGE_AGE_MAP"),
  "const FAMILY_PAGE_COST_CARE_TOTAL_VALUE = " + extractConstSrc("FAMILY_PAGE_COST_CARE_TOTAL_VALUE"),
  "const FAMILY_PAGE_TALK_LINE = " + extractConstSrc("FAMILY_PAGE_TALK_LINE"),
  "const FAMILY_PAGE_ERROR_MESSAGE = " + extractConstSrc("FAMILY_PAGE_ERROR_MESSAGE"),
  "const familyPageErrorResetState = " + extractArrowSrc("familyPageErrorResetState"),
  "const resolveFamilyAgeInfo = " + extractArrowSrc("resolveFamilyAgeInfo"),
  "const loadFamilyPageToggle = " + extractArrowSrc("loadFamilyPageToggle"),
  "const saveFamilyPageToggle = " + extractArrowSrc("saveFamilyPageToggle"),
  extractFunctionSrc("buildFamilyPageEmpathyText"),
  extractFunctionSrc("familyPageMetaphorFor"),
  extractFunctionSrc("familyPageTreatmentBarWidth"),
  extractFunctionSrc("applyFamilyPageTalkLine"),
  extractFunctionSrc("shouldShowFamilyPageToggle"),
  // ⑥ の第一候補提示価格一致（T9）用に価格解決経路も同一スコープで束ねる
  // 💡 関連トークスクリプトの発動判定（computeDecision 内の metaphor_flags 参照用）
  "const RELATED_SCRIPTS = " + extractConstSrc("RELATED_SCRIPTS"),
  "const METAPHOR_PRIORITY = " + extractConstSrc("METAPHOR_PRIORITY"),
  "const CANDIDATES = " + extractConstSrc("CANDIDATES"),
  "const formatYen = " + extractArrowSrc("formatYen"),
  "const denturePriceRangeText = " + extractArrowSrc("denturePriceRangeText"),
  "const dentureTableCostText = " + extractArrowSrc("dentureTableCostText"),
  "const pricePerDayText = " + extractArrowSrc("pricePerDayText"),
  "const DENTURE_KEY_BY_CANDIDATE = " + extractArrowSrc("DENTURE_KEY_BY_CANDIDATE"),
  "const resolveDenturePrice = " + extractArrowSrc("resolveDenturePrice"),
  extractFunctionSrc("resolveDentureMaterialKey"),
  extractFunctionSrc("computeDecision"),
].join("\n");

const api = new Function(
  stripTypes(bundle) +
    "\nreturn { FORM_DATA, FAMILY_PAGE_STORAGE_KEY, FAMILY_PAGE_DEFAULT_AGE, FAMILY_PAGE_AGE_OPTIONS, FAMILY_PAGE_EMPATHY_TEMPLATE, FAMILY_PAGE_EMPATHY_FALLBACK, FAMILY_PAGE_LIFE_LEAD, FAMILY_PAGE_LIFE_NOTE, FAMILY_PAGE_RISK_GRID_HEADING, FAMILY_PAGE_RISK_CARDS, FAMILY_PAGE_DAILY_METAPHORS, FAMILY_PAGE_MONTHLY_METAPHORS, FAMILY_PAGE_COST_MINI_NOTE, FAMILY_PAGE_COST_NOTE, FAMILY_PAGE_INSURANCE_BODY, FAMILY_PAGE_FOOTER_GUIDE, FAMILY_PAGE_FOOTER_SOURCES, FAMILY_PAGE_AGE_MAP, FAMILY_PAGE_COST_CARE_TOTAL_VALUE, FAMILY_PAGE_TALK_LINE, FAMILY_PAGE_ERROR_MESSAGE, familyPageErrorResetState, resolveFamilyAgeInfo, loadFamilyPageToggle, saveFamilyPageToggle, buildFamilyPageEmpathyText, familyPageMetaphorFor, familyPageTreatmentBarWidth, applyFamilyPageTalkLine, shouldShowFamilyPageToggle, CANDIDATES, denturePriceRangeText, dentureTableCostText, pricePerDayText, resolveDenturePrice, resolveDentureMaterialKey, computeDecision };"
)();

// --- テスト用フォーム状態（通常モード：FD・調整不応 → PRECISION） ---
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

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? "PASS" : "FAIL") + ": " + label);
  if (!cond) failures++;
};

// ===== T1: 通常生成（トグルON・70代・情緒価値複数）→ 寄り添い文に選択値が『』連記・行順が並び替わる =====
const t1Emotions = ["家族と食事", "会話を楽しむ"];
const t1Text = api.buildFamilyPageEmpathyText(t1Emotions);
assert(
  t1Text ===
    "患者さまは、『家族と食事』『会話を楽しむ』を大切にしたいとお話しくださいました。\nそのお気持ちを、これから先もずっと叶えていくために、知っておいていただきたいことがあります。",
  "T1: 寄り添い文に選択値が『』連記で入る（お話しくださいました。で改行）: " + t1Text
);
// 70代の人生バー値
const t1Age = api.resolveFamilyAgeInfo("70代");
assert(
  t1Age.representativeAge === 75 &&
    t1Age.remainingYears === 25 &&
    t1Age.healthyYears === 15 &&
    t1Age.careYears === 10,
  "T1: 70代 → 代表75歳・残り25年・健康15年・介護10年"
);
// ===== 差分指示書(2026-09-27) A-1: 「2つの未来」ブロック削除 → 人生バー見出し直下の導入文1行 =====
assert(
  api.FAMILY_PAGE_LIFE_LEAD ===
    "「去年食べたあれが、また食べたい」と笑い合える毎日は、噛めることから生まれます。",
  "A-1: 人生バー直下の導入文が差分指示書どおり: " + api.FAMILY_PAGE_LIFE_LEAD
);
assert(
  !/function\s+familyPageSceneOrder/.test(src) && !/const\s+FAMILY_PAGE_SCENE_ROWS/.test(src),
  "A-1: 並び替えロジック（familyPageSceneOrder・SCENE_ROWS）が削除されている"
);

// ===== T2: トグルOFF → 3枚目なし（familyPageVisible = false） =====
const toggleOnVisible = (toggle, sheetMode, firstCandidate) =>
  toggle && api.shouldShowFamilyPageToggle(sheetMode) && Boolean(firstCandidate);
const t2Decision = api.computeDecision(dentureBase);
assert(
  t2Decision.sheetMode === "normal" && t2Decision.firstCandidate !== "",
  "T2前提: 通常モードで第一候補あり（sheetMode=normal）"
);
assert(
  toggleOnVisible(false, t2Decision.sheetMode, t2Decision.firstCandidate) === false,
  "T2: トグルOFF → 3枚目を描画しない"
);
assert(
  toggleOnVisible(true, t2Decision.sheetMode, t2Decision.firstCandidate) === true,
  "T2対: トグルON・通常モード → 3枚目を描画する"
);

// ===== T3: 要注意ワード選択（careful/cautious）→ トグル非表示・3枚目なし =====
const t3Decision = api.computeDecision({
  ...dentureBase,
  red_flag_words: ["絶対に外れない"],
});
assert(
  t3Decision.sheetMode === "cautious" &&
    api.shouldShowFamilyPageToggle(t3Decision.sheetMode) === false &&
    toggleOnVisible(true, t3Decision.sheetMode, t3Decision.firstCandidate) === false,
  "T3: cautious ではトグル非表示・3枚目なし"
);

// ===== T4: 使用状況「使っていない（初めて）」（未使用者）→ 同上 =====
const t4Decision = api.computeDecision({
  ...dentureBase,
  denture_status: "使っていない（初めて）",
  denture_duration: "該当なし（未使用者）",
  adjustment_history: "該当なし（未使用者）",
});
assert(
  t4Decision.sheetMode === "insurance_first" &&
    api.shouldShowFamilyPageToggle(t4Decision.sheetMode) === false &&
    toggleOnVisible(true, t4Decision.sheetMode, t4Decision.firstCandidate) === false,
  "T4: insurance_first（未使用者）ではトグル非表示・3枚目なし"
);

// ===== T5: 情緒価値なし → フォールバック文 =====
assert(
  api.buildFamilyPageEmpathyText([]) === api.FAMILY_PAGE_EMPATHY_FALLBACK &&
    api.FAMILY_PAGE_EMPATHY_FALLBACK ===
      "患者さまがこれからも心地よく過ごしていくために、知っておいていただきたいことがあります。",
  "T5: 未選択時はフォールバック文: " + api.buildFamilyPageEmpathyText([])
);

// ===== T6: 年代「80歳以上」→ バーが5年＋10年で描画 =====
const t6 = api.resolveFamilyAgeInfo("80歳以上");
assert(
  t6.representativeAge === 85 &&
    t6.healthyYears === 5 &&
    t6.careYears === 10 &&
    t6.remainingYears === 15,
  "T6: 80歳以上 → 代表85歳・健康約5年＋介護約10年（合計15年）"
);

// ===== T7: 年代「分からない」→ 仮に75歳の場合・15年＋10年 =====
const t7 = api.resolveFamilyAgeInfo("分からない");
assert(
  t7.representativeAge === 75 && t7.healthyYears === 15 && t7.careYears === 10,
  "T7: 分からない → 「仮に75歳の場合」健康15年＋介護10年"
);
assert(
  api.resolveFamilyAgeInfo("存在しない値").representativeAge === 75,
  "T7: 未定義値も「分からない」（75歳）にフォールバック"
);
assert(
  api.FAMILY_PAGE_DEFAULT_AGE === "分からない" &&
    api.FAMILY_PAGE_AGE_OPTIONS.join(",") === "60代,70代,80歳以上,分からない",
  "T7: デフォルト「分からない」・選択肢が指示書どおり4件"
);

// ===== T8: トグルの localStorage 復元（年代は復元されない） =====
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
// 初期状態（未保存）→ デフォルトON
assert(
  api.loadFamilyPageToggle() === true,
  "T8: 未保存時はデフォルトONで復元"
);
// ON→再読込→ON
api.saveFamilyPageToggle(true);
assert(
  api.loadFamilyPageToggle() === true && store[api.FAMILY_PAGE_STORAGE_KEY] === "1",
  "T8: トグルON→保存→復元でON"
);
// OFF→再読込→OFF
api.saveFamilyPageToggle(false);
assert(
  api.loadFamilyPageToggle() === false && store[api.FAMILY_PAGE_STORAGE_KEY] === "0",
  "T8: トグルOFF→保存→再読込で前回値（OFF）が復元"
);
// 年代は localStorage 復元しない（保存キー・読み出しが存在しないこと）
assert(
  !src.includes('localStorage.getItem("family_page_age') &&
    !src.includes("FAMILY_PAGE_AGE_STORAGE_KEY"),
  "T8: 年代は localStorage 復元しない（保存キーなし）"
);
// 復元はマウント時1回のみ（初期化直後の読み込みが loadFamilyPageToggle 経由であること）
assert(
  (src.match(/loadFamilyPageToggle\(\)/g) || []).length >= 1 &&
    src.includes("setIncludeFamilyPage(loadFamilyPageToggle())"),
  "T8: マウント時に loadFamilyPageToggle でトグル値を復元"
);

// ===== T9: 費用バーが第一候補の基準価格（1〜2枚目と同ルール: デフォルト=中央値・医院登録=上限値）と一致 =====
// デフォルト（PRECISION・レンジ330,000〜550,000・中央値440,000）→ 中央値 440,000 でバー描画
const t9Decision = api.computeDecision(dentureBase);
const t9Key = api.resolveDentureMaterialKey(t9Decision.firstCandidate);
const t9Price = api.resolveDenturePrice(t9Key, {});
assert(
  t9Key === "PRECISION" && t9Price.priceMax === 550000 && t9Price.midPrice === 440000,
  "T9前提: 第一候補=PRECISION・priceMax=550,000・midPrice=440,000"
);
const t9Base = t9Price.fromClinic ? t9Price.priceMax : t9Price.midPrice;
const t9Width = api.familyPageTreatmentBarWidth(t9Base);
assert(
  t9Base === 440000 &&
    Math.abs(t9Width - (440000 / api.FAMILY_PAGE_COST_CARE_TOTAL_VALUE) * 100) < 1e-9 &&
    api.FAMILY_PAGE_COST_CARE_TOTAL_VALUE === 5420000,
  "T9: バー幅 = 基準価格÷542万円（デフォルト中央値440,000 → 約8.12%）: " + t9Width
);
// 医院登録価格（300,000）→ バー・表記がそちらと一致（上限値ルール）
const t9Clinic = { "denture:PRECISION": { priceMin: null, priceMax: 300000 } };
const t9ClinicPrice = api.resolveDenturePrice(t9Key, t9Clinic);
assert(
  t9ClinicPrice.fromClinic === true &&
    api.dentureTableCostText(t9ClinicPrice, t9Key) === "約300,000円（税込・片額）",
  "T9: 医院登録価格で上段バーの提示額・表記が一致（約300,000円）"
);
const t9ClinicBase = t9ClinicPrice.fromClinic ? t9ClinicPrice.priceMax : t9ClinicPrice.midPrice;
const t9ClinicWidth = api.familyPageTreatmentBarWidth(t9ClinicBase);
assert(
  t9ClinicBase === 300000 &&
    Math.abs(t9ClinicWidth - (300000 / 5420000) * 100) < 1e-9,
  "T9: 医院登録価格300,000 → バー幅 約5.54%: " + t9ClinicWidth
);
// 上限超過は全幅に丸める・0以下は0
assert(
  api.familyPageTreatmentBarWidth(6000000) === 100 &&
    api.familyPageTreatmentBarWidth(0) === 0,
  "T9防御: 542万円超は全幅(100%)・0円は幅0"
);

// ===== T10: 3枚目のレンダリング強制失敗 → 1〜2枚目は維持・エラー通知のみ =====
// ErrorBoundary 論理: レンダリング例外 → hasError 状態へ遷移し通知文のみ表示（1〜2枚目の描画は別ツリーで維持）
assert(
  JSON.stringify(api.familyPageErrorResetState()) === JSON.stringify({ hasError: true }),
  "T10: getDerivedStateFromError → { hasError: true } で隔離状態に遷移"
);
assert(
  api.FAMILY_PAGE_ERROR_MESSAGE === "ご家族向けページの生成に失敗しました",
  "T10: 失敗時の通知文が「ご家族向けページの生成に失敗しました」のみ: " +
    api.FAMILY_PAGE_ERROR_MESSAGE
);
// エラー境界がソース上で 3枚目を包み、1〜2枚目（DenturePatientSheet）の外にあること
const sheetIdx = src.indexOf("const DenturePatientSheet");
const familyIdx = src.indexOf("const FamilyPageSheet");
const boundaryIdx = src.indexOf("class FamilyPageErrorBoundary");
const renderIdx = src.indexOf("<FamilyPageErrorBoundary>");
assert(
  boundaryIdx > 0 && familyIdx > boundaryIdx && renderIdx > familyIdx && sheetIdx > 0 && sheetIdx < renderIdx,
  "T10: ErrorBoundary が FamilyPageSheet を包み、DenturePatientSheet(1〜2枚目)と分離されている"
);

// ===== T11: 情緒価値3つ以上 → 先頭2つ＋「など」 =====
const t11Text = api.buildFamilyPageEmpathyText([
  "家族と食事",
  "見た目・審美",
  "会話を楽しむ",
]);
assert(
  t11Text.startsWith("患者さまは、『家族と食事』『見た目・審美』などを大切に") &&
    !t11Text.includes("『会話を楽しむ』"),
  "T11: 3つ選択 → 先頭2つ＋「など」（3つ目は出さない）: " + t11Text
);
// 1つだけ → 「など」なし・その1つだけ
const t11b = api.buildFamilyPageEmpathyText(["旅行やおでかけ"]);
assert(
  t11b.startsWith("患者さまは、『旅行やおでかけ』を大切に") && !t11b.includes("など"),
  "T11: 1つ選択 → 『』のみ（などなし）: " + t11b
);

// ===== ③ トークカンペ最終ステップへの1文追加（コード定数・cautious では追加しない） =====
const makeSteps = () => [
  { heading: "ステップ1", keywords: ["a"], kokorogamae: null, raw: [], fullText: "持ち帰ってご家族とご相談ください。" },
  { heading: "ステップ2", keywords: ["b"], kokorogamae: null, raw: [], fullText: "次回のご相談をお待ちしています。" },
];
const tNormal = makeSteps();
api.applyFamilyPageTalkLine(tNormal, "denture", "normal");
assert(
  tNormal[1].fullText.endsWith(api.FAMILY_PAGE_TALK_LINE) &&
    api.FAMILY_PAGE_TALK_LINE ===
      "3ページ目はご家族向けの資料です。よろしければ、ご家族と一緒にご覧ください。" &&
    !tNormal[0].fullText.includes("3ページ目"),
  "T-カンペ: 最終ステップの全文へ1文追加（他ステップは変更なし）"
);
const tCautious = makeSteps();
api.applyFamilyPageTalkLine(tCautious, "denture", "cautious");
assert(
  !tCautious[1].fullText.includes("3ページ目"),
  "T-カンペ: cautious モードでは追加しない"
);
const tInsuranceFirst = makeSteps();
api.applyFamilyPageTalkLine(tInsuranceFirst, "denture", "insurance_first");
assert(
  !tInsuranceFirst[1].fullText.includes("3ページ目"),
  "T-カンペ: insurance_first（未使用者・3枚目なし）でも追加しない"
);
const tCrown = makeSteps();
api.applyFamilyPageTalkLine(tCrown, "crown", "standard");
assert(
  !tCrown[1].fullText.includes("3ページ目"),
  "T-カンペ: クラウン版では追加しない（義歯版のみ）"
);
const tEmpty = [];
api.applyFamilyPageTalkLine(tEmpty, "denture", "normal");
assert(tEmpty.length === 0, "T-カンペ: ステップ0件でも例外にならない");

// ===== 修正1(2026-09-27→グリッド化): 「約2.4倍」帯バーはカードグリッドに置き換え済み =====
// 💡 帯バー（バー2本・注記）・チップ群は削除。代わりに3列×2行のカードグリッド（6枚）を配置
assert(
  !src.includes("FAMILY_PAGE_RISK_BARS") &&
    !src.includes("FAMILY_PAGE_RISK_CHIP_LEAD") &&
    !src.includes("RISK_VALUE") &&
    !/帯バー直下のチップ群|リスク対比帯カード/.test(src),
  "修正1: 旧帯バー（バー・注記）とチップ群の定数・描画が削除済み"
);
assert(
  api.FAMILY_PAGE_RISK_GRID_HEADING === "噛めない状態が続くと、こんなリスクとつながります" &&
    api.FAMILY_PAGE_RISK_CARDS.length === 6 &&
    api.FAMILY_PAGE_RISK_CARDS[0].title === "介護 約2.4倍" &&
    api.FAMILY_PAGE_RISK_CARDS[0].desc ===
      "お口の機能が低下した方が、新たに介護が必要になるリスク（東京大学・柏スタディ）" &&
    api.FAMILY_PAGE_RISK_CARDS[1].title === "認知症 約1.9倍" &&
    api.FAMILY_PAGE_RISK_CARDS[1].desc ===
      "歯を失い義歯を使っていない方の認知症発症リスク（厚生労働省研究班・JAGES）" &&
    api.FAMILY_PAGE_RISK_CARDS[2].title === "体力の衰え" &&
    api.FAMILY_PAGE_RISK_CARDS[3].title === "栄養の偏り" &&
    api.FAMILY_PAGE_RISK_CARDS[4].title === "孤立" &&
    api.FAMILY_PAGE_RISK_CARDS[5].title === "会話の減少",
  "修正2: カードグリッド見出し・6枚（介護 約2.4倍/認知症 約1.9倍/体力の衰え/栄養の偏り/孤立/会話の減少）が指示どおり"
);
assert(
  /gridTemplateColumns: "repeat\(3, 1fr\)"/.test(src) &&
    /FAMILY_PAGE_RISK_CARDS\.map\(\(card\)/.test(src) &&
    /fontSize: 13,\s*fontWeight: 800,/.test(src) &&
    /color: FAMILY_PAGE_COLORS\.accent,/.test(src) &&
    /color: FAMILY_PAGE_COLORS\.main,/.test(src) &&
    /textAlign: "center",/.test(src) &&
    /gap: 16,/.test(src),
  "修正2: 3列グリッド・タイトル13px太字#B08D4F（6枚統一）・説明#1E4D5C・中央揃え・gap16pxで描画"
);
assert(
  !/fontSize: 26,/.test(src),
  "修正2: 旧26pxタイトルは残っていない（セクション見出し15pxより一段小さい13pxに統一）"
);

// ===== 差分指示書(2026-09-27)→チップ追加で復元: 出所欄にJAGESを復活・東北大学は不要のまま =====
assert(
  api.FAMILY_PAGE_FOOTER_SOURCES.includes("厚生労働科学研究班・JAGES（65歳以上4,425名・4年追跡）") &&
    !api.FAMILY_PAGE_FOOTER_SOURCES.includes("東北大学") &&
    api.FAMILY_PAGE_FOOTER_SOURCES.includes("柏スタディ") &&
    api.FAMILY_PAGE_FOOTER_SOURCES.includes("生命保険文化センター") &&
    api.FAMILY_PAGE_FOOTER_SOURCES.includes("厚生労働省"),
  "A-3: 出所欄は厚生労働省／柏スタディ／JAGES（4,425名・4年追跡）／生命保険文化センター"
);

// ===== 換算カード左右2分割(2026-09-27): 左=ラベル+金額・右=アイコン+比喩・上下中央揃え =====
assert(
  (src.match(/display: "flex",\s*alignItems: "center",\s*gap: 10,/g) || []).length === 2 &&
    (src.match(/flex: 1, textAlign: "center"/g) || []).length === 4 &&
    /color: FAMILY_PAGE_COLORS\.main,\s*marginTop: 17,/.test(src),
  "換算カード: 左右2分割（左=ラベル+金額・右=アイコン+比喩・上下中央揃え）・見出し上部マージン21px"
);

// ===== リスクカードグリッド(2026-09-27): 高さ圧縮（上下7px）・換算カードは11px維持 =====
// 💡 グリッドは1テンプレートを6回描画。グリッド上下7px・換算カード11pxの計3箇所にパディング定義
assert(
  (src.match(/padding: "11px 11px",/g) || []).length === 2 &&
    /padding: "7px 10px",/.test(src) &&
    !src.includes('padding: "9px 11px"'),
  "リスクグリッド: カード上下パディング7pxに圧縮・換算カード11pxは維持（背景色・枠線は非変更）"
);

// ===== 差分指示書(2026-09-27) B-1: 反証ブロック文案の全文差し替え =====
assert(
  api.FAMILY_PAGE_INSURANCE_BODY.length === 2 &&
    api.FAMILY_PAGE_INSURANCE_BODY[0] ===
      "保険の入れ歯は、基本的な機能を回復するものとして、それ自体は正しい選択肢です。\nただし保険の範囲でできるのは、必要最低限の機能回復までです。" &&
    api.FAMILY_PAGE_INSURANCE_BODY[1] ===
      "今よりも快適な毎日のための選択肢として、自費の入れ歯について、一度ご家族でお話し合いいただければ幸いです。",
  "B-1: 反証ブロック文案が差分指示書どおり全文差し替え済み"
);
assert(
  /whiteSpace: "pre-line",/.test(src) &&
    /選択肢です。\\nただし保険の範囲/.test(src),
  "B-1: 保険ブロックは「…それ自体は正しい選択肢です。／ただし保険の範囲…」の位置で改行される（pre-line）"
);

// ===== フッター問いかけ(2026-09-27): 「待つか。／その分岐点は…」で改行・フォント14px（1.2倍は大きすぎたため縮小） =====
assert(
  /待つか。\\nその分岐点は、いまの選択にあります。/.test(src) &&
    /fontSize: 14,\s*fontWeight: 700,/.test(src) &&
    !/fontSize: 15\.6,/.test(src),
  "フッター問いかけ: 「待つか。／その分岐点は…」の位置で改行・14px（15.6pxは廃止）"
);

// ===== 換算カードの金額カンマ区切り(2026-09-27): 1,000円超は formatYen でカンマ表示 =====
assert(
  /約\{formatYen\(dailyAmount\)\}円/.test(src) &&
    /約\{formatYen\(monthlyAmount\)\}円/.test(src),
  "換算カード: 日額・月額は formatYen（1,000円超はカンマ区切り）で表示"
);

// ===== 換算カードのアイコン中央揃え(2026-09-27): display:block + margin:auto =====
assert(
  (src.match(/display: "block",\s*margin: "0 auto",/g) || []).length === 2,
  "換算カード: アイコンが display:block + margin:auto で比喩文言と同じ中央揃え"
);

// ===== 差分指示書(2026-09-27) C-1 / T12: 1日換算の帯域切り替え =====
const dailyCases = [
  [200000, 55, "fr-candy", "ちょっとしたお菓子1個にも満たない金額"], // 20万→約55円/日
  [400000, 110, "fr-juice", "ジュース1本程度"],
  [800000, 219, "fr-coffee", "コーヒー1杯程度"],
  [1500000, 411, "fr-launch", "ランチ1食にも満たない金額"],
];
for (const [price, expectedDaily, icon, text] of dailyCases) {
  const daily = Math.round(price / 3650);
  const meta = api.familyPageMetaphorFor(daily, api.FAMILY_PAGE_DAILY_METAPHORS);
  assert(
    daily === expectedDaily && meta.icon === "/images/" + icon + ".png" && meta.text === text,
    `T12: ${price}円 → 1日約${daily}円・${text}（${icon}）`
  );
}
// 境界値: ちょうど60円/150円/400円は上の帯域（under 未満で照合）
assert(
  api.familyPageMetaphorFor(60, api.FAMILY_PAGE_DAILY_METAPHORS).text === "ジュース1本程度" &&
    api.familyPageMetaphorFor(150, api.FAMILY_PAGE_DAILY_METAPHORS).text === "コーヒー1杯程度" &&
    api.familyPageMetaphorFor(400, api.FAMILY_PAGE_DAILY_METAPHORS).text === "ランチ1食にも満たない金額",
  "T12: 境界値（ちょうど60/150/400円）は上の帯域に入る"
);

// ===== 差分指示書(2026-09-27) C-1 / T13: 月換算の3帯域切り替え =====
const monthlyCases = [
  [300000, 2500, "月のお薬代より少ない金額"],
  [800000, 6667, "月のお薬代程度"],
  [2000000, 16667, "毎月のお薬代に少し足した程度"],
];
for (const [price, expectedMonthly, text] of monthlyCases) {
  const monthly = Math.round(price / 120);
  const meta = api.familyPageMetaphorFor(monthly, api.FAMILY_PAGE_MONTHLY_METAPHORS);
  assert(
    monthly === expectedMonthly && meta.icon === "/images/fr-medicine.png" && meta.text === text,
    `T13: ${price}円 → 月約${monthly}円・${text}`
  );
}

// ===== 差分指示書(2026-09-27) C-1→文言短縮【3】: 費用セクション注記2文が指示どおり =====
assert(
  api.FAMILY_PAGE_COST_MINI_NOTE ===
    "介護が1年早く始まれば、費用は約108万円増えます。（生命保険文化センター・2024年度）" &&
    api.FAMILY_PAGE_COST_NOTE ===
    "※換算は10年使用を仮定した目安です。調整・修理費は別途かかります。",
  "文言短縮【3】: 費用セクションの注記2文が指示どおり"
);

// ===== 文言短縮【1】【5】: 人生バー注記・フッター誘導文が指示どおり =====
assert(
  api.FAMILY_PAGE_LIFE_NOTE ===
    "約10年とは、お子さまが小学生から大学生になるまでの長さです。（厚生労働省・令和4年）" &&
    api.FAMILY_PAGE_FOOTER_GUIDE ===
      "ご家族の皆さま同席でのご相談も承ります。まずは選択肢を知るところから、ご一緒に考えましょう。",
  "文言短縮【1】【5】: 人生バー注記・フッター誘導文が指示どおり"
);

// ===== 差分指示書(2026-09-27) T14: 既存スタイル値が変更されていないこと =====
assert(
  /const sectionTitle[^;]*fontSize: 15/s.test(src) &&
    /fontSize: 14,\s*lineHeight: 1\.6/.test(src) &&
    /fontSize: 13,\s*fontWeight: 800,/.test(src),
  "T14: セクション見出し15px・寄り添い文14px・グリッドタイトル13pxが維持されている"
);

// ===== 修正2(2026-09-27→価格統一): 「今回の治療費」セル削除・2分割化・見出しは基準価格表記に統一 =====
assert(
  !/今回の治療費\s*<\/p>/.test(src.slice(src.indexOf("修正2"), src.indexOf("FAMILY_PAGE_COST_NOTE"))) &&
    /今回の治療費（\$\{formatYen\(miniPrice\)\}円で試算）を10年で使うと…/.test(src),
  "修正2: ミニカードは2分割＋見出し「（基準価格円で試算）」表記に統一済み"
);

// ===== 価格統一修正1: 3枚目の基準価格は1〜2枚目と同ルール（デフォルト=中央値・医院登録=上限値） =====
assert(
  /const basePrice = familyPrice\.fromClinic \? familyPrice\.priceMax : familyPrice\.midPrice/.test(
    src,
  ) &&
    /familyPageTreatmentBarWidth\(basePrice\)/.test(src) &&
    /const miniPrice = basePrice;/.test(src),
  "価格統一修正1: 費用対比バー・換算カードの基準価格が中央値/上限値ルールに統一済み"
);

// ===== 価格統一修正3: 2枚目の日額換算が10年化（pricePerDayText は ÷3650・デフォルト約121円） =====
assert(
  api.pricePerDayText(t9Price) === "約121円" &&
    api.pricePerDayText(t9ClinicPrice) === "約82円" &&
    !src.includes("1825"),
  "価格統一修正3: 2枚目の日額は10年換算（デフォルト440,000÷3650=約121円・医院300,000÷3650=約82円）"
);

// ===== 修正3(2026-09-27): 注記2件は12px（出所・免責はnoteStyle=10.5pxのまま） =====
assert(
  /\.\.\.noteStyle, fontSize: 12, marginTop: 3 \}\}>\s*\{FAMILY_PAGE_COST_MINI_NOTE\}/.test(src) &&
    /\.\.\.noteStyle, fontSize: 12, marginTop: 4 \}\}>\{FAMILY_PAGE_COST_NOTE\}/.test(src),
  "修正3: FAMILY_PAGE_COST_MINI_NOTE・FAMILY_PAGE_COST_NOTE が12pxに引き上げ済み"
);

// ===== 視認性【6】: セクション間マージン（フッター問いかけ14px化の高さ増を各マージンから均等に減らして調整） =====
assert(
  /marginTop: 8,/.test(src) &&
    (src.match(/marginTop: 17/g) || []).length === 5 &&
    /marginBottom: 14,/.test(src),
  "視認性【6】: マージンは8px/17px・marginBottom14pxに均等調整済み（フッター増加分を各セクション間マージンで吸収）"
);

// ===== 視認性【7】: 4セクション見出しに #B08D4F の縦棒（幅4px）が付く（リスクブロック見出しを含む） =====
assert(
  (src.match(/alignSelf: "stretch",/g) || []).length === 4 &&
    (src.match(/width: 4,/g) || []).length === 4,
  "視認性【7】: 人生バー・リスクブロック・費用対比・保険ブロックの見出しに縦棒が統一付与済み"
);

// ===== 視認性【8】: 換算カードの上下パディングは+20%の11px（リスクグリッド6枚も同パディングで統一） =====
assert(
  !src.includes('padding: "9px 11px"'),
  "視認性【8】: 上下パディング9pxは残っていない（換算カード・グリッドとも11px）"
);

// ===== 禁止語チェック: 家族向けページのコード定数ブロックに禁止語が混入しない =====
const BANNED_WORDS = ["治療用義歯", "仮義歯", "BPS"];
const familyBlockStart = src.indexOf("===== 家族向け3枚目ページ");
const familyBlockEnd = src.indexOf("type Decision");
const familySheetStart = src.indexOf("const FamilyPageSheet");
const familySheetEnd = src.indexOf("return (\n    <main");
const region =
  src.slice(familyBlockStart, familyBlockEnd) +
  src.slice(familySheetStart, familySheetEnd);
const bannedFound = BANNED_WORDS.filter((w) => region.includes(w));
assert(
  bannedFound.length === 0,
  "禁止語: 家族向けページの定数・描画コードに禁止語なし" +
    (bannedFound.length ? "（検出: " + bannedFound.join(",") + "）" : "")
);

// ===== 寄り添い文の『…』太字強調（描画コードに split+strong ロジックが存在すること） =====
assert(
  /empathyParts\.map/.test(src) &&
    /split\(\/\(『\[\^』\]\*』\)\/g\)/.test(src) &&
    /<strong/.test(src.slice(familySheetStart, familySheetEnd)),
  "T-強調: 寄り添い文の『…』部分が strong で太字強調される"
);

// ===== 配色定数が指示書どおりであること =====
const colorBlock = extractConstSrc("FAMILY_PAGE_COLORS");
assert(
  colorBlock.includes('main: "#1E4D5C"') &&
    colorBlock.includes('accent: "#B08D4F"') &&
    colorBlock.includes('inverted: "#FDFCF9"') &&
    colorBlock.includes('lightBg: "#FAF7F0"'),
  "配色: #1E4D5C / #B08D4F / #FDFCF9 / #FAF7F0 が指示書どおり"
);

if (failures > 0) {
  console.log(`\n${failures} 件の失敗`);
  process.exit(1);
}
console.log("\n全件 PASS");
