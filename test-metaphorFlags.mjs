// test-metaphorFlags.mjs — computeDecision の metaphor_flags 発動条件の検証（§1.1表ベース）
import { readFileSync } from "fs";

const src = readFileSync("app/app/page.tsx", "utf8");

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
    .replace(/:\s*Decision\["sheetMode"\]/g, "")
    .replace(/:\s*FormState\b/g, "")
    .replace(/:\s*Candidate\b/g, "")
    .replace(/:\s*Decision\b/g, "")
    .replace(/:\s*DentureMaterialKey\b/g, "")
    .replace(/:\s*ResolvedPrice\b/g, "")
    .replace(/:\s*ClinicPriceMap\b/g, "")
    .replace(/:\s*string\[\]/g, "")
    .replace(/:\s*string\s*\|\s*null/g, "")
    .replace(/:\s*(string|number|boolean|void)(\[\])?/g, "");

const bundle = [
  "const RELATED_SCRIPTS = " + extractConstSrc("RELATED_SCRIPTS"),
  "const METAPHOR_PRIORITY = " + extractConstSrc("METAPHOR_PRIORITY"),
  "const CANDIDATES = " + extractConstSrc("CANDIDATES"),
  "const formatYen = " + extractArrowSrc("formatYen"),
  "const denturePriceRangeText = " + extractArrowSrc("denturePriceRangeText"),
  "const pricePerDayText = " + extractArrowSrc("pricePerDayText"),
  "const DENTURE_KEY_BY_CANDIDATE = " + extractArrowSrc("DENTURE_KEY_BY_CANDIDATE"),
  "const resolveDenturePrice = " + extractArrowSrc("resolveDenturePrice"),
  extractFunctionSrc("resolveDentureMaterialKey"),
  extractFunctionSrc("computeDecision"),
].join("\n");

const { computeDecision } = new Function(
  stripTypes(bundle) + "\nreturn { computeDecision };",
)();

const base = {
  mode: "denture",
  denture_status: "使っている",
  remaining_teeth: "ほとんどある",
  target_jaw: "上顎",
  defect_site: "前歯部",
  denture_duration: "3年くらい",
  current_denture_complaints: [],
  adjustment_history: "調整して改善した",
  oral_dryness: "普通",
  ridge_mucosa: "しっかり",
  cost_sensitivity: "バランス重視",
  red_flag_words: ["特になし"],
};

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "PASS" : "FAIL") + " " + label);
  console.log("  actual:   " + JSON.stringify(actual));
  if (!ok) {
    console.log("  expected: " + JSON.stringify(expected));
    failures++;
  }
};

// 1. normal＋使用5年＋痛み → 主訴直結 M1/M4/M7 が優先（M4<M7<N2順＝定義順）
check(
  "normal+5年+痛み",
  computeDecision({ ...base, denture_duration: "5年以上", current_denture_complaints: ["痛い"] }).metaphor_flags,
  ["M1", "M4", "M7"],
);

// 2. normal＋無歯顎＋上顎＋外れやすい → M2/M4/N1
check(
  "normal+無歯顎+上顎+外れやすい",
  computeDecision({
    ...base,
    remaining_teeth: "1本もない（無歯顎）",
    current_denture_complaints: ["外れやすい"],
  }).metaphor_flags,
  ["M4", "M2", "N1"],
);

// 3. insurance_first（未使用）→ §1.1表ベース: M3（主訴直結）+ N9（第一候補=弾性樹脂）+ M6（費用）。M4はnormal限定で不発
check(
  "insurance_first（未使用）",
  computeDecision({ ...base, denture_status: "使っていない（初めて）" }).metaphor_flags,
  ["M3", "N9", "M6"],
);

// 4. normal＋痛み＋乾燥 → 主訴直結 M4/M7/N2 が3枚で封鎖（N8=候補説明は落下）
check(
  "normal+痛み+乾燥",
  computeDecision({
    ...base,
    current_denture_complaints: ["痛い"],
    oral_dryness: "乾いている・少ない",
  }).metaphor_flags,
  ["M4", "M7", "N2"],
);

// 5. cautious（要注意ワード） → 空配列
check(
  "cautious（要注意ワード）",
  computeDecision({ ...base, red_flag_words: ["嚥下困難"] }).metaphor_flags,
  [],
);

// 6. 費用重視で cost_conscious → M4（主訴直結級ではないがnormal必発）+ N8（第一候補=金属床）+ M6
check(
  "normal+費用重視",
  computeDecision({ ...base, cost_sensitivity: "費用重視" }).metaphor_flags,
  ["M4", "N8", "M6"],
);

// 7. 金属床第一候補 → N8も発動するが主訴直結M1/M4と同優先のM2が前で3枚封鎖（§1.3の「1ステップあたり最大3枚」ではなく全体的な3件上限）
check(
  "normal+噛めない+歯槽しっかり（N8は4件目で落下）",
  computeDecision({
    ...base,
    remaining_teeth: "1本もない（無歯顎）",
    defect_site: "前歯部",
    current_denture_complaints: ["噛めない"],
    adjustment_history: "調整して改善した",
  }).metaphor_flags,
  ["M1", "M4", "M2"],
);

// ===== §8追加指示: P4分岐修正（上顎へのシリコーン分岐）=====
// firstCandidate・価格レンジ・metaphor_flagsを同時に検証する
const checkDecision = (label, input, expected) => {
  const d = computeDecision(input);
  const actual = {
    firstCandidate: d.firstCandidate,
    priceRange: d.candidatePriceRange,
    flags: d.metaphor_flags,
  };
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "PASS" : "FAIL") + " " + label);
  console.log("  actual:   " + JSON.stringify(actual));
  if (!ok) {
    console.log("  expected: " + JSON.stringify(expected));
    failures++;
  }
};

const fdBase = {
  ...base,
  remaining_teeth: "1本もない（無歯顎）",
  current_denture_complaints: ["痛い"],
  adjustment_history: "調整して改善した",
};

// 新規1: normal＋FD＋上顎＋痛み＋乾燥なし → 精密義歯（シリコーンでない）。N1連動・価格レンジも精密の33万〜55万
checkDecision(
  "P4修正: normal+FD+上顎+痛み+乾燥なし → 精密義歯",
  { ...fdBase, target_jaw: "上顎" },
  {
    firstCandidate: "精密義歯（オーダーメイド精密型）",
    priceRange: "約330,000〜550,000円（片顎・税込）",
    flags: ["M4", "M7", "M2"], // 無歯顎+上顎/両顎でM2も発動し定義順でN1の前に並ぶ
  },
);

// 新規2: normal＋FD＋下顎＋痛み＋乾燥なし → シリコーン付き義歯（従来どおり）。約270,000円注入経路も維持
checkDecision(
  "P4修正: normal+FD+下顎+痛み+乾燥なし → シリコーン（従来どおり）",
  { ...fdBase, target_jaw: "下顎" },
  {
    firstCandidate: "シリコーン（軟性裏装）付き義歯",
    priceRange: "約270,000円（片顎・税込）",
    flags: ["M4", "M7"],
  },
);

// 新規3: normal＋FD＋両顎＋痛み＋乾燥なし → 精密義歯（安全側）
checkDecision(
  "P4修正: normal+FD+両顎+痛み+乾燥なし → 精密義歯（安全側）",
  { ...fdBase, target_jaw: "両顎" },
  {
    firstCandidate: "精密義歯（オーダーメイド精密型）",
    priceRange: "約330,000〜550,000円（片顎・税込）",
    flags: ["M4", "M7", "M2"], // 無歯顎+上顎/両顎でM2も発動し定義順でN1の前に並ぶ
  },
);

// 回帰: 乾燥あり時は精密義歯のまま変わらない（下顎でも乾燥ならシリコーンを第一候補から除外）
checkDecision(
  "P4修正: normal+FD+下顎+痛み+乾燥あり → 精密義歯（従来どおり）",
  { ...fdBase, target_jaw: "下顎", oral_dryness: "乾いている・少ない" },
  {
    firstCandidate: "精密義歯（オーダーメイド精密型）",
    priceRange: "約330,000〜550,000円（片顎・税込）",
    flags: ["M4", "M7", "N2"],
  },
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
