// 変更A/Bの動作検証：app/app/page.tsx から実際の定数・関数を抽出してテストする
import { readFileSync } from "fs";

const src = readFileSync("app/app/page.tsx", "utf8");

// --- 抽出ヘルパー ---
const extractConst = (name) => {
  const re = new RegExp(`const ${name}(\\s*:\\s*[^=]+)?\\s*=\\s*([\\s\\S]*?);\\n`, "");
  const m = src.match(re);
  if (!m) throw new Error(`${name} not found`);
  return eval(`(${m[2]})`);
};

const extractFunction = (name) => {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found`);
  // ブレース対応で本体末尾を探す（本体は必ず「{改行」で始まる。戻り値の型の { と区別するため）
  let i = src.indexOf("{\n", start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const raw = src.slice(start, i + 1);
  // TypeScriptの型注釈を取り除いてJavaScriptとして評価する
  const code = raw
    .replace(/:\s*Record<[^>]*>/g, "")
    .replace(/:\s*"[^"]*"(\s*\|\s*"[^"]*")+/g, "") // "a" | "b" リテラルunion
    .replace(/:\s*string\[\]\s*\|\s*null/g, "")
    .replace(/:\s*(string|number|boolean)(\[\])?/g, "")
    .replace(/:\s*TalkKeywordStep\s*\|\s*null/g, "")
    .replace(/:\s*TalkKeywordStep(\[\])?/g, "")
    .replace(/\)\s*:\s*\{[^}]*\}\s*\|\s*null/g, ")");
  return eval(`(${code})`);
};

const TALK_MINDSET_LINE = extractConst("TALK_MINDSET_LINE");
const TALK_MINDSET_LINE_CROWN = extractConst("TALK_MINDSET_LINE_CROWN");
const SHEET_OPENER = extractConst("SHEET_OPENER");
const SHEET_FIXED_HEADINGS = extractConst("SHEET_FIXED_HEADINGS");
const applySheetOpener = extractFunction("applySheetOpener");
const resolveSheetHeadings = extractFunction("resolveSheetHeadings");
const parseTalkKeywords = extractFunction("parseTalkKeywords");

// parsePatientSheet も実ファイルから抽出（内部の自由変数は呼出時に注入）
const parseSheetSrc = (() => {
  const start = src.indexOf("function parsePatientSheet(");
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
})();
const parseSheet = (raw) => {
  // TypeScript型注釈を除去してから評価
  const js = parseSheetSrc
    .replace(/:\s*SheetSection(\[\])?/g, "")
    .replace(/:\s*RegExpExecArray\s*\|\s*null/g, "")
    .replace(/:\s*(string|number|boolean)(\[\])?/g, "");
  const fn = new Function(
    "raw",
    "escapeRegExp",
    "DISCLAIMER_DENTURE",
    "NOTE_TEXTS_DENTURE",
    `return (${js})(raw)`,
  );
  return fn(
    raw,
    extractFunction("escapeRegExp"),
    extractConst("DISCLAIMER_DENTURE"),
    extractConst("NOTE_TEXTS_DENTURE"),
  );
};

// コンポーネント側の headingOf と同等の表示解決ロジック（フォールバック含む）
const stripEmoji = (s) =>
  s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "")
    .trim();
const makeHeadingOf = (sections, appMode, sheetMode) => {
  const fixed = resolveSheetHeadings(appMode, sheetMode, sections.length);
  return (s) => {
    const idx = sections.indexOf(s);
    return (fixed && fixed[idx]) || stripEmoji(s.heading);
  };
};

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? "PASS" : "FAIL") + ": " + label);
  if (!cond) failures++;
};

// ===== 変更A: 【心構え】固定文言 =====
const rawV242 = `■ ステップ1／オープニング
【キーワード】笑顔／挨拶／信頼
【心構え】患者様のペースに合わせて話しかける
【全文】こんにちは。

■ ステップ2／現状確認
【キーワード】悩み／生活
【心構え】聞く姿勢を大切にする
【全文】どのようなことでお悩みですか？`;

const parsed = parseTalkKeywords(rawV242);
assert(
  parsed.steps[0].kokorogamae ===
    TALK_MINDSET_LINE.replace(/^【心構え】/, ""),
  "A1: ステップ1のkokorogamaeがコード定数に置き換わる（旧AI出力の【心構え】でない）"
);
assert(
  parsed.steps[0].kokorogamae !== "患者様のペースに合わせて話しかける",
  "A2: 旧プロンプト出力の【心構え】が二重表示されない（上書きされる）"
);
assert(
  parsed.steps[0].fullText.includes("【心構え】") === false,
  "A3: fullTextから【心構え】行が除去されている"
);
assert(
  parsed.steps[1].kokorogamae === "聞く姿勢を大切にする",
  "A4: ステップ2以降のkokorogamaeはAI出力のまま維持"
);

// v2.5（【心構え】なし）でも定数が入る
const rawV25 = `■ ステップ1／オープニング
【キーワード】笑顔／挨拶／信頼
【全文】こんにちは。`;
const parsed25 = parseTalkKeywords(rawV25);
assert(
  parsed25.steps[0].kokorogamae ===
    TALK_MINDSET_LINE.replace(/^【心構え】/, ""),
  "A5: v2.5出力（【心構え】なし）でもステップ1に定数が挿入される"
);

// ===== 変更B: 書き出し定型文のコード結合 =====
const bodyFresh = "弾性樹脂床（ノンクラスプデンチャー）スタンダードは、見た目の境界線が目立ちにくい素材です。";
assert(
  applySheetOpener(bodyFresh, "normal") ===
    SHEET_OPENER.normal + bodyFresh,
  "B1: normalモードで定型文が本文先頭に前置される"
);
assert(
  applySheetOpener(bodyFresh, "insurance_first") ===
    SHEET_OPENER.insurance_first + bodyFresh,
  "B2: insurance_firstモードで定型文が本文先頭に前置される"
);
assert(
  applySheetOpener(bodyFresh, "cautious") === bodyFresh,
  "B3: cautiousモードでは定型文を付けない"
);
assert(
  applySheetOpener(bodyFresh, "careful") === bodyFresh,
  "B4: careful（クラウン）モードでも定型文を付けない"
);
// 後方互換: AI出力が既に定型文で始まっている場合は除去してから結合（二重表示防止）
const bodyLegacy =
  SHEET_OPENER.normal +
  "\n" +
  "弾性樹脂床スタンダードは、見た目の境界線が目立ちにくい素材です。";
const combined = applySheetOpener(bodyLegacy, "normal");
assert(
  combined === SHEET_OPENER.normal + "弾性樹脂床スタンダードは、見た目の境界線が目立ちにくい素材です。",
  "B5: 旧出力が定型文で始まっていても二重にならない"
);
assert(
  (combined.match(/現在のお悩みに対応する具体的な選択肢として、/g) || [])
    .length === 1,
  "B6: 定型文がちょうど1回だけ含まれる"
);

// ===== 変更1：applySheetOpener は義歯フロー専用 =====
// マトリクス#3: クラウン insurance_first でも義歯用書き出し文が混入しない
assert(
  applySheetOpener(bodyFresh, "insurance_first", "crown") === bodyFresh,
  "C1(マトリクス#3): クラウン insurance_first では書き出し文を適用しない"
);
assert(
  applySheetOpener(bodyFresh, "normal", "crown") === bodyFresh,
  "C2: クラウン normal でも書き出し文を適用しない"
);
assert(
  applySheetOpener(bodyFresh, "careful", "crown") === bodyFresh,
  "C3: クラウン careful でも書き出し文を適用しない"
);
// 義歯経路の現行動作は変更なし（デフォルト引数）
assert(
  applySheetOpener(bodyFresh, "normal") === SHEET_OPENER.normal + bodyFresh,
  "C4: 義歯経路（既定）では従来どおり定型文が挿入される"
);

// ===== 変更3：クラウン用【心構え】 =====
// マトリクス#4: クラウン standard でクラウン用【心構え】がステップ1に挿入され、AI出力の【心構え】と二重にならない
const rawCrownStd = `■ ステップ1／オープニング
【キーワード】笑顔／挨拶／信頼
【心構え】AIが出力した旧心構え
【全文】こんにちは。

■ ステップ2／説明
【キーワード】素材／価格
【全文】素材について説明します。`;
const parsedCrownStd = parseTalkKeywords(rawCrownStd, "crown", "standard");
assert(
  parsedCrownStd.steps[0].kokorogamae ===
    TALK_MINDSET_LINE_CROWN.replace(/^【心構え】/, ""),
  "C5(マトリクス#4): クラウン standard でクラウン用【心構え】が挿入される"
);
assert(
  parsedCrownStd.steps[0].kokorogamae !== "AIが出力した旧心構え",
  "C6: 旧プロンプト出力の【心構え】と二重表示にならない"
);
assert(
  parsedCrownStd.steps[0].fullText.includes("【心構え】") === false,
  "C7: fullTextから【心構え】行が除去されている"
);

// マトリクス#5: クラウン careful では【心構え】を挿入しない（誤出力は除去のみ）
const rawCrownCareful = `■ ステップ0／注意書き
【キーワード】検査／優先
【心構え】AIが誤って出力した心構え
【全文】まずは検査からはじめましょう。`;
const parsedCrownCareful = parseTalkKeywords(rawCrownCareful, "crown", "careful");
assert(
  parsedCrownCareful.steps[0].kokorogamae === null,
  "C8(マトリクス#5): クラウン careful では【心構え】が挿入されず、AI誤出力も除去される"
);
assert(
  parsedCrownCareful.steps[0].fullText.includes("【心構え】") === false,
  "C9: carefulモードのfullTextにも【心構え】行が残存しない"
);
// クラウン careful で【心構え】を持たない正常出力も維持される
const rawCrownCarefulClean = `■ ステップ0／注意書き
【キーワード】検査／優先
【全文】まずは検査からはじめましょう。`;
const parsedClean = parseTalkKeywords(rawCrownCarefulClean, "crown", "careful");
assert(
  parsedClean.steps[0].kokorogamae === null &&
    parsedClean.steps.length === 1,
  "C10: クラウン careful（【心構え】なし）のステップ0のみ出力が維持される"
);

// 義歯側の現行動作は変更なし（careful でも従来どおり挿入＝前回実装の維持）
const parsedDentureCautious = parseTalkKeywords(rawV25, "denture", "cautious");
assert(
  parsedDentureCautious.steps[0].kokorogamae ===
    TALK_MINDSET_LINE.replace(/^【心構え】/, ""),
  "C11: 義歯 cautious でも従来どおり【心構え】が挿入される（変更なし）"
);

// ===== 変更4：シート内セクション見出しのコード化 =====
// 実際のAI出力（■行＋本文）を想定したシートテキスト
const dentureCautiousSheet = `■ 今のお悩みへの共感
入れ歯が合わずにお困りのことと思います。
■ 知っておいていただきたいこと
保険と自費には素材の違いがあります。
■ 次のステップについて
まずは歯科医師の検査からはじめましょう。`;
const dentureNormalSheet = `■ お悩みの整理（保険／自費の両論併記）
日常生活でお困りの様子をうかがっています。
■ おすすめの選択肢
弾性樹脂床が第一候補です。
■ それぞれの良い点・注意点
保険は手頃、自費は快適です。
■ 費用の目安
約25万円です。
■ ご家族へ
ご家族にも説明しやすい内容です。`;
const dentureInsuranceFirstSheet = `■ 今のお悩みと目指す暮らし
使い心地の改善を目指します。
■ 次の一歩の参考
将来の選択肢として自費も検討できます。
■ それぞれの良い点・注意点
保険は手頃です。
■ 費用の考え方
保険は1〜3割負担です。
■ ご家族向けのまとめ
ご家族向けのまとめ文です。`;
const crownCarefulSheet = `■ 今のお気持ちへ
痛みが気になるお気持ち、よくわかります。
■ 検査を先にすすめる理由
痛みのある場合は検査が先です。
■ これからの流れ
検査後に素材の相談をします。
■ 素材選びはあとで大丈夫です
今は素材を決める必要はありません。`;
const crownInsuranceFirstSheet = `■ 導入文
被せ物の素材について整理します。
■ 保険の被せ物について
保険の被せ物という選択肢があります。
■ 自費の素材（参考）
参考までに自費の素材もご紹介します。`;
const crownStandardSheet = `■ 被せ物の素材の選択肢
保険と自費の素材があります。
■ 第一候補のご案内
ジルコニアクラウンをご案内します。
■ 次の一歩
検査からはじめましょう。`;

// マトリクス#1: 義歯 cautious — 漏洩見出し「今のお悩みへの共感」が表示されない
{
  const sections = parseSheet(dentureCautiousSheet).sections;
  const headingOf = makeHeadingOf(sections, "denture", "cautious");
  const displayed = sections.map(headingOf);
  assert(
    JSON.stringify(displayed) ===
      JSON.stringify(SHEET_FIXED_HEADINGS.denture.cautious),
    "マトリクス#1: 義歯cautiousの3見出しが固定文言に置き換わる（今のお悩みへの共感 非表示）: " +
      JSON.stringify(displayed)
  );
}

// マトリクス#2: 義歯 normal — 括弧書き等が混入しない
{
  const sections = parseSheet(dentureNormalSheet).sections;
  const headingOf = makeHeadingOf(sections, "denture", "normal");
  const displayed = sections.map(headingOf);
  assert(
    JSON.stringify(displayed) ===
      JSON.stringify(SHEET_FIXED_HEADINGS.denture.normal),
    "マトリクス#2: 義歯normalの5見出しが固定文言になる（括弧書き混入なし）: " +
      JSON.stringify(displayed)
  );
}

// マトリクス#3: 義歯 insurance_first — 2番目が「次の一歩の参考」＋書き出し定型文の挿入位置は維持
{
  const sections = parseSheet(dentureInsuranceFirstSheet).sections;
  const headingOf = makeHeadingOf(sections, "denture", "insurance_first");
  assert(
    headingOf(sections[1]) === "次の一歩の参考",
    "マトリクス#3a: 2番目の見出しが「次の一歩の参考」になる"
  );
  // 書き出し定型文は見出し行の直後（本文先頭）に挿入される現行動作が維持される
  const bodyWithOpener = applySheetOpener(
    sections[1].body,
    "insurance_first",
    "denture",
  );
  assert(
    bodyWithOpener.startsWith(SHEET_OPENER.insurance_first),
    "マトリクス#3b: 書き出し定型文が本文先頭（見出し直後）に挿入される"
  );
}

// マトリクス#4: クラウン careful — 4見出しが固定文言に
{
  const sections = parseSheet(crownCarefulSheet).sections;
  const headingOf = makeHeadingOf(sections, "crown", "careful");
  const displayed = sections.map(headingOf);
  assert(
    JSON.stringify(displayed) === JSON.stringify(SHEET_FIXED_HEADINGS.crown.careful),
    "マトリクス#4: クラウンcarefulの4見出しが固定文言になる: " + JSON.stringify(displayed)
  );
}

// マトリクス#5: クラウン insurance_first — 先頭が「被せ物の素材の選択肢について」（導入文 非表示）
{
  const sections = parseSheet(crownInsuranceFirstSheet).sections;
  const headingOf = makeHeadingOf(sections, "crown", "insurance_first");
  assert(
    headingOf(sections[0]) === "被せ物の素材の選択肢について",
    "マトリクス#5: 先頭見出しが「被せ物の素材の選択肢について」になる（導入文 非表示）"
  );
}

// マトリクス#6: クラウン standard — 3見出しが固定文言に
{
  const sections = parseSheet(crownStandardSheet).sections;
  const headingOf = makeHeadingOf(sections, "crown", "standard");
  const displayed = sections.map(headingOf);
  assert(
    JSON.stringify(displayed) === JSON.stringify(SHEET_FIXED_HEADINGS.crown.standard),
    "マトリクス#6: クラウンstandardの3見出しが固定文言になる: " + JSON.stringify(displayed)
  );
}

// マトリクス#7: 件数不一致 → フォールバック（AI出力そのまま＋warn）
{
  const sections = parseSheet(dentureNormalSheet).sections; // 5件
  let warned = false;
  const origWarn = console.warn;
  console.warn = () => {
    warned = true;
  };
  const fixed = resolveSheetHeadings("crown", "standard", sections.length); // crown standard は3件
  console.warn = origWarn;
  assert(fixed === null, "マトリクス#7a: 件数不一致で null（フォールバック）が返る");
  assert(warned, "マトリクス#7b: 件数不一致で console.warn が発火する");
  const headingOf = makeHeadingOf(sections, "crown", "standard");
  assert(
    headingOf(sections[0]) === "お悩みの整理（保険／自費の両論併記）",
    "マトリクス#7c: フォールバック時はAI出力見出しがそのまま表示される"
  );
}

// マトリクス#8: TALK_SCRIPTの「■ ステップN:」行は変更されない
{
  const rawTalk = `■ ステップ1: オープニング
【キーワード】笑顔／挨拶
【全文】こんにちは。`;
  const parsed = parseTalkKeywords(rawTalk, "crown", "standard");
  assert(
    parsed.steps[0].heading === "ステップ1: オープニング",
    "マトリクス#8: トークカンペのステップ見出しは変更されない: " + parsed.steps[0].heading
  );
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
