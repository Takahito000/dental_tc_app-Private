"use client";

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Building2,
  Sparkles,
  FileText,
  MessageSquare,
  Printer,
  AlertTriangle,
  Send,
} from "lucide-react";

// A4縦 @96dpi: 210mm×297mm ≒ 794×1123px
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

const FORM_DATA = {
  denture_status: ["使っている", "使っていない（初めて）"],
  remaining_teeth: [
    "ほとんどある",
    "少しある",
    "ほとんど無い",
    "1本もない（無歯顎）",
  ],
  target_jaw: ["上顎", "下顎", "両顎"],
  defect_site: [
    "前歯部",
    "小臼歯部",
    "大臼歯部",
    "広範囲（複数部位）",
    "わからない",
    "該当なし（総義歯）",
  ],
  current_denture_complaints: [
    "痛い",
    "外れやすい",
    "噛めない",
    "見た目が悪い",
    "話づらい",
    "その他",
  ],
  denture_duration: [
    "1年未満",
    "1〜5年",
    "5年以上",
    "該当なし（未使用者）",
    "不明",
  ],
  adjustment_history: [
    "調整しても改善しない",
    "作り直したがダメ",
    "ほぼ未調整",
    "該当なし（未使用者）",
  ],
  oral_dryness: ["普通", "乾いている・少ない"],
  ridge_mucosa: ["しっかり", "平坦・やせ・痛みやすい", "不明"],
  emotion_drivers: [
    "家族と食事",
    "見た目・審美",
    "旅行やおでかけ",
    "会話を楽しむ",
    "痛みのない生活",
  ],
  expectation_type: [
    "完璧を求める",
    "快適なら満足",
    "現状よりマシになれば良い",
  ],
  cost_sensitivity: ["費用重視", "価値が高ければ許容", "予算上限なし"],
  red_flag_words: [
    "特になし",
    "シワを消したい",
    "絶対に外れない",
    "何でも噛める",
  ],
  // クラウン版
  crown_target_site: ["前歯（1〜3番）", "小臼歯（4〜5番）", "大臼歯（6〜7番）"],
  crown_visibility: ["よく見える", "あまり見えない", "ほとんど見えない"],
  crown_chief_priority: [
    "見た目の自然さ",
    "強度・長持ち",
    "金属を避けたい",
  ],
  crown_metal_allergy: ["特になし", "あり・疑いあり"],
  crown_bruxism: ["特になし", "あり"],
  crown_has_pain: ["特になし", "あり"],
  crown_cost_sensitivity: ["特になし", "費用は抑えたい"],
};

// 💡 初期フォーム状態（判定関数の型参照のためモジュジュールレベルに切り出し）
const INITIAL_FORM_DATA = {
  mode: "denture" as const,
  // 義歯版
  denture_status: "使っている",
  remaining_teeth: "ほとんど無い",
  target_jaw: "上顎",
  defect_site: "該当なし（総義歯）", // 💡 初期値の残存歯が「ほとんど無い」（FD扱い）のため
  current_denture_complaints: [] as string[],
  denture_duration: "1〜5年",
  adjustment_history: "調整しても改善しない",
  oral_dryness: "普通",
  ridge_mucosa: "しっかり",
  emotion_drivers: ["家族と食事"] as string[],
  expectation_type: "快適なら満足",
  cost_sensitivity: "価値が高ければ許容",
  red_flag_words: ["特になし"] as string[],
  // クラウン版
  target_site: "前歯（1〜3番）",
  visibility: "よく見える",
  chief_priority: "見た目の自然さ",
  metal_allergy: "特になし",
  bruxism: "特になし",
  has_pain: "特になし",
  free_memo: "",
};
type FormStateBase = typeof INITIAL_FORM_DATA;
type FormState = Omit<FormStateBase, "mode"> & {
  mode: "denture" | "crown";
};
type CrownFormState = FormState & { mode: "crown" };

const INITIAL_CROWN_FORM_DATA: CrownFormState = {
  ...INITIAL_FORM_DATA,
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

// ===== 判定テーブル v1.1（2026-08-30 監修者確定） =====
// 💡 分岐・第一候補選定・価格・費用換算はこの関数で確定させ、Difyプロンプトには結果のみ注入する。
//    プロンプト側での再判定は禁止（ハルシネーション防止）。ここを変更したらDifyプロンプトの
//    「システム判定結果」セクションと整合しているか必ず確認すること。
const CANDIDATES = {
  ELASTIC_STANDARD: {
    name: "弾性樹脂床（ノンクラスプデンチャー）スタンダード",
    priceRange: "約15万円（片顎・税込）",
    midPrice: 150000,
  },
  ELASTIC_PREMIUM: {
    name: "弾性樹脂床（ノンクラスプデンチャー）プレミアム",
    priceRange: "約25万円（片顎・税込）",
    midPrice: 250000,
  },
  METAL_PD: {
    name: "金属床（コバルトクロム）部分義歯",
    priceRange: "約25〜40万円（片顎・税込）",
    midPrice: 325000,
  },
  METAL_FD: {
    name: "金属床（コバルトクロム）総義歯",
    priceRange: "約25〜40万円（片顎・税込）",
    midPrice: 325000,
  },
  SILICONE: {
    name: "シリコーン（軟性裏装）付き義歯",
    priceRange:
      "約27万円（義歯本体込・片顎・税込）／既存の入れ歯への後付け加工の場合は約10〜15万円",
    midPrice: 270000,
  },
  PRECISION: {
    name: "精密義歯（オーダーメイド精密型）",
    priceRange: "約33〜55万円（片顎・税込）",
    midPrice: 440000,
  },
} as const;
type Candidate = (typeof CANDIDATES)[keyof typeof CANDIDATES];

// 💡 費用換算: レンジ中央値 ÷ 5年 ÷ 365日（プロンプトには計算させない）
const pricePerDayOf = (c: Candidate) => `約${Math.round(c.midPrice / 1825)}円`;

// ===== Phase 1 固定テキスト（Difyプロンプト v2.1 定型文） =====
// これらの文言はコード側で一元管理し、AI出力に依存しない。

const DISCLAIMER_DENTURE =
  "本シートは一般的な情報提供を目的としたAIによる客観分析であり、診断ではありません。最終的な治療方針は歯科医師にご相談のうえ決定してください。";

const INSURANCE_TEXT_DENTURE =
  "保険の入れ歯は、国の規則で使える素材や製作の工程が定められている、お口の基本的な機能を回復するためのものです。";

const COST_NOTE_DENTURE =
  "※費用は一般的な相場の目安です。医院によって診査・設計の工程が異なり、より精密な工程を行う場合は上振れする傾向があります。また、欠損している歯の数やお口の状態によっても変わりますので、詳しくは医院にご確認ください。";

// note_flags → 固定注記文のマッピング（lower_jaw_metal_caution はAI生成制約としてプロンプト側に残すため含めない）
const NOTE_TEXTS_DENTURE: Record<string, string> = {
  dry_mouth:
    "※お口の乾燥がある場合、素材を問わず痛みが出やすいことがあります。内面にワセリンを塗る等のひと手間で軽減できる場合がありますので、歯科医師にご相談ください。",
  ridge_weak:
    "※顎の土台の形は時間とともに変化しやすいため、完成後も調整やリライン（内面の調整）が継続的に必要になる場合があります。",
  cost_conscious: "まずは保険の入れ歯の調整・作り直しという選択肢もあります。",
  pre_treatment_required:
    "※残っている歯の治療（抜歯や、歯をカットして根を覆う処置など）を行ってからの入れ歯作りとなります。歯の治療の費用と期間は別途かかります。また、残っている歯の状態によっては、保存して部分的な入れ歯にできる可能性も残ります。いずれも歯科医師の検査で判断します。",
  both_jaws_double:
    "なお、これは片顎あたりの目安で、両顎の場合はおおむね2倍となります。",
  ti_option:
    "※金属床には、より軽く金属アレルギーのリスクが低いチタンという選択肢もあります。",
  silicone_maintenance:
    "※シリコーンは経年で硬くなるため、定期的な作り替え（再加工。目安は1〜2年に1回程度）が必要で、その都度費用がかかります。",
};

// 義歯版比較表の自費列コンテンツ（監修者による後日レビュー対象）
const DENTURE_COMPARISON_CONTENTS: Record<string, Record<string, string>> = {
  elastic_standard: {
    purpose: "金属のバネを使わない、見た目に配慮した部分入れ歯",
    material: "弾性樹脂（金属のバネなし）",
    pain_and_loose:
      "歯ぐきに沿う柔らかい素材で固定。金属のバネが歯や歯ぐきに当たらない",
    experience:
      "笑ったときに金属が見えにくく、人前での表情に自信につながる可能性があります",
    visits: "3〜5回程度",
    cost: "約15万円（税込・片額）",
  },
  elastic_premium: {
    purpose: "見た目と強度のバランスを取った部分入れ歯",
    material: "弾性樹脂＋金属の骨格（補強）",
    pain_and_loose: "骨格で強度を確保しつつ、柔らかい素材で固定",
    experience:
      "広い欠損でも見た目と使い心地のバランスを取りやすい可能性があります",
    visits: "4〜6回程度",
    cost: "約25万円（税込・片額）",
  },
  metal: {
    purpose:
      "薄く丈夫な設計で、異物感と温度の伝わりに配慮した入れ歯",
    material: "金属（コバルトクロム等）",
    pain_and_loose: "たわみにくいため、噛んだ力が床全体に分散しやすい",
    experience:
      "食べ物の温度が伝わりやすく、食事の楽しみにつながる可能性があります",
    visits: "4〜6回程度",
    cost: "約25万〜40万円（税込・片額）",
  },
  silicone: {
    purpose: "歯ぐきへの当たりをやわらげることに特化した入れ歯",
    material: "レジン床＋内面にシリコーンのクッション",
    pain_and_loose: "内面のクッションが歯ぐきへの当たりをやわらげる",
    experience:
      "当たりのやわらかさが、食事時の負担感の軽減につながる可能性があります",
    visits: "4〜6回程度",
    cost: "約27万円（税込・片額。後付けの場合は別途10万〜15万円程度）",
  },
  precision: {
    purpose:
      "型取りと噛み合わせの工程に時間をかけ、フィット精度を高める作り方",
    material: "素材ではなく「作り方」の違い（工程を個別に精密化）",
    pain_and_loose: "丁寧な工程により、吸着・フィットの精度を高める",
    experience:
      "吸着・フィットの精度が、外れにくさの実感につながる可能性があります",
    visits: "6〜10回程度",
    cost: "約33万〜55万円（税込・片額）",
  },
};

function resolveDentureTableContent(firstCandidate: string) {
  if (firstCandidate.includes("スタンダード"))
    return DENTURE_COMPARISON_CONTENTS.elastic_standard;
  if (firstCandidate.includes("プレミアム"))
    return DENTURE_COMPARISON_CONTENTS.elastic_premium;
  if (firstCandidate.includes("金属床"))
    return DENTURE_COMPARISON_CONTENTS.metal;
  if (firstCandidate.includes("シリコーン"))
    return DENTURE_COMPARISON_CONTENTS.silicone;
  return DENTURE_COMPARISON_CONTENTS.precision;
}

type Decision = {
  sheetMode: "cautious" | "insurance_first" | "normal";
  firstCandidate: string;
  candidatePriceRange: string;
  pricePerDay: string;
  noteFlags: string[];
};

function computeDecision(f: FormState): Decision {
  // P0: 慎重モード（要注意ワードが1つでもあれば他の全判定より優先）
  if (f.red_flag_words.some((w) => w !== "特になし")) {
    return {
      sheetMode: "cautious",
      firstCandidate: "",
      candidatePriceRange: "",
      pricePerDay: "",
      noteFlags: [],
    };
  }

  // P2: PD/FD判定（「ほとんど無い」は残存歯で支えるPDが現実的に困難なためFD扱い）
  const isPD =
    f.remaining_teeth === "ほとんどある" || f.remaining_teeth === "少しある";
  const complaints = f.current_denture_complaints;
  const dry = f.oral_dryness === "乾いている・少ない";
  const ridgeWeak = f.ridge_mucosa === "平坦・やせ・痛みやすい";
  const adjustFailed =
    f.adjustment_history === "調整しても改善しない" ||
    f.adjustment_history === "作り直したがダメ";
  const narrowDefect =
    f.defect_site === "前歯部" || f.defect_site === "小臼歯部"; // 「わからない」は広範囲扱い（安全側）

  // 共通フラグ（候補に依存しないもの）
  const noteFlags: string[] = [];
  if (dry) noteFlags.push("dry_mouth");
  if (ridgeWeak) noteFlags.push("ridge_weak");
  if (f.cost_sensitivity === "費用重視") noteFlags.push("cost_conscious");
  if (f.remaining_teeth === "ほとんど無い")
    noteFlags.push("pre_treatment_required");
  if (f.target_jaw === "両顎") noteFlags.push("both_jaws_double");

  let sheetMode: Decision["sheetMode"];
  let c: Candidate;

  if (f.denture_status === "使っていない（初めて）") {
    // P1: 未使用者 → 保険ファースト＋「次の一歩」の参考候補
    sheetMode = "insurance_first";
    c = isPD
      ? narrowDefect
        ? CANDIDATES.ELASTIC_STANDARD
        : CANDIDATES.ELASTIC_PREMIUM
      : CANDIDATES.PRECISION;
  } else if (isPD) {
    // P3: 部分床（normal）
    sheetMode = "normal";
    if (complaints.includes("痛い")) {
      c = dry ? CANDIDATES.METAL_PD : CANDIDATES.SILICONE; // 乾燥時はシリコーンを第一候補から除外
    } else if (complaints.includes("見た目が悪い")) {
      c = narrowDefect
        ? CANDIDATES.ELASTIC_STANDARD
        : CANDIDATES.ELASTIC_PREMIUM;
    } else {
      c = CANDIDATES.METAL_PD; // 調整不応・外れ・噛めない・その他のデフォルト
    }
  } else {
    // P4: 総義歯（normal）
    sheetMode = "normal";
    if (adjustFailed) c = CANDIDATES.PRECISION;
    else if (complaints.includes("痛い") || ridgeWeak)
      c = dry ? CANDIDATES.PRECISION : CANDIDATES.SILICONE;
    else if (complaints.includes("外れやすい")) c = CANDIDATES.PRECISION;
    else if (complaints.includes("噛めない") && f.ridge_mucosa === "しっかり")
      c = CANDIDATES.METAL_FD;
    else c = CANDIDATES.PRECISION;
  }

  // 候補依存フラグ
  const isMetal = c === CANDIDATES.METAL_PD || c === CANDIDATES.METAL_FD;
  if (isMetal && f.target_jaw !== "上顎")
    noteFlags.push("lower_jaw_metal_caution");
  if (isMetal && f.cost_sensitivity !== "費用重視") noteFlags.push("ti_option");
  if (c === CANDIDATES.SILICONE) noteFlags.push("silicone_maintenance");

  return {
    sheetMode,
    firstCandidate: c.name,
    candidatePriceRange: c.priceRange,
    pricePerDay: pricePerDayOf(c),
    noteFlags,
  };
}

const LOADING_STEPS = [
  "患者様のお悩み・口腔条件を解析中...",
  "適合する義歯素材・設計プランを選定中...",
  "A4提案シート＆トークカンペを作成中...",
];

type SheetSection = { heading: string; body: string };

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePatientSheet(raw: string) {
  // コード側で固定表示する定型文・表をAI出力から除去（二重出力防止）
  let bodyOnly = raw.replace(/本シートは一般的な情報提供[\s\S]*$/, "");

  // 旧フォーマットの見出し・発行日行が本文に混入しないよう、先頭のメタ行を除去
  const sanitizedLines: string[] = [];
  let skippingLeading = true;
  for (const line of bodyOnly.split("\n")) {
    if (skippingLeading) {
      const t = line.trim().replace(/^#+\s*/, "");
      if (t.startsWith("【") || /^発行日[：:]/.test(t) || t === "") {
        continue;
      }
      skippingLeading = false;
    }
    sanitizedLines.push(line);
  }
  bodyOnly = sanitizedLines.join("\n");

  // HTMLテーブルブロックを除去
  bodyOnly = bodyOnly.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, "");
  // Markdownテーブルブロック（| 列を含む連続行）を除去
  bodyOnly = bodyOnly.replace(/(?:\n\|[^\n]*\|[^\n]*)+/g, "");

  // 保険説明の定型文を除去
  bodyOnly = bodyOnly.replace(
    /保険の入れ歯は、国の規則で使える素材や製作の工程が定められている、お口の基本的な機能を回復するためのものです。/g,
    "",
  );

  // 費用注記を除去
  bodyOnly = bodyOnly.replace(
    /※費用は一般的な相場の目安です[\s\S]*?医院にご確認ください。/g,
    "",
  );

  // note_flags に対応する固定注記文を除去（lower_jaw_metal_caution はAI生成制約のため含めない）
  Object.values(NOTE_TEXTS_DENTURE).forEach((text) => {
    if (!text) return;
    bodyOnly = bodyOnly.replace(new RegExp(escapeRegExp(text), "g"), "");
  });

  const sectionRegex = /■\s*(.+)\n([\s\S]*?)(?=\n■\s|$)/g;
  const sections: SheetSection[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(bodyOnly)) !== null) {
    sections.push({ heading: m[1].trim(), body: m[2].trim() });
  }
  return { sections, disclaimer: DISCLAIMER_DENTURE };
}

const renderInline = (text: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-ink">$1</strong>')
    .replace(/\n/g, "<br/>");

// 💡 モデル出力の見出しに含まれる絵文字（🌟🧭⚠💸等）は表示時に除去する（parse済みデータは変更しない）
const stripEmoji = (s: string) =>
  s
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu,
      "",
    )
    .trim();

// 💡 トークカンペのインライン装飾（全文表示・フォールバック表示で共通利用）
const renderTalkInline = (text: string) =>
  text
    .replace(
      /### (.*)/g,
      '<h3 class="font-bold text-amber-900 border-b border-amber-200 pb-1 mt-4 mb-2 text-sm">$1</h3>',
    )
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="bg-amber-100 px-1 rounded">$1</strong>',
    );

// 💡 トークカンペ要点表示用パーサー（2026-08-25 表記フォーマット変更対応）
// Dify 2号機の「■ ステップ名／【キーワード】／【心構え】／【全文】」形式を解析する。
// 【キーワード】を1つも含まない旧形式の生成結果は null を返し、全文表示にフォールバックする。
// 【キーワード】を持たないステップ����ステップ0の注意書き等）は raw を保持し、要点表示でも全文を見せる（安全警告を隠さない）。
type TalkKeywordStep = {
  heading: string;
  keywords: string[];
  kokorogamae: string | null;
  raw: string[];
  // 💡 全文ビュー用：見出し・【キーワード】・【心構え】行を除き、【全文】マーカーを剥がした本文
  fullText: string;
};

function parseTalkKeywords(
  raw: string,
): { preamble: string; steps: TalkKeywordStep[] } | null {
  if (!raw.includes("【キーワード】")) return null;
  const lines = raw.split("\n");
  const steps: TalkKeywordStep[] = [];
  const preambleLines: string[] = [];
  let current: TalkKeywordStep | null = null;
  const finishStep = (s: TalkKeywordStep): TalkKeywordStep => ({
    ...s,
    fullText: s.raw
      .slice(1)
      .filter((l) => {
        const lt = l.trim();
        return !lt.startsWith("【キーワード】") && !lt.startsWith("【心構え】");
      })
      .join("\n")
      .replace("【全文】", "")
      .trim(),
  });
  for (const line of lines) {
    const t = line.trim();
    if (/^■\s*ステップ/.test(t)) {
      if (current) steps.push(finishStep(current));
      current = {
        heading: t.replace(/^■\s*/, ""),
        keywords: [],
        kokorogamae: null,
        raw: [line],
        fullText: "",
      };
    } else if (current) {
      current.raw.push(line);
      if (t.startsWith("【キーワード】")) {
        current.keywords = t
          .replace("【キーワード】", "")
          .split("／")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (t.startsWith("【心構え】")) {
        current.kokorogamae = t.replace("【心構え】", "").trim();
      }
      // 【全文】行とその本文は要点表示では使わず、raw から fullText を構築する
    } else {
      preambleLines.push(line);
    }
  }
  if (current) steps.push(finishStep(current));
  return { preamble: preambleLines.join("\n").trim(), steps };
}

const TABLE_COL_WIDTHS = {
  col1: "18%",
  col2: "37%",
  col3: "45%",
};

const cleanTableHtml = (html: string) => {
  let cleaned = html
    .replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, "")
    .replace(/<col[^>]*>/gi, "")
    .replace(
      /\s(style|width|height|bgcolor|border|cellpadding|cellspacing)="[^"]*"/gi,
      "",
    );

  const colgroupHtml = `<colgroup><col style="width: ${TABLE_COL_WIDTHS.col1};"><col style="width: ${TABLE_COL_WIDTHS.col2};"><col style="width: ${TABLE_COL_WIDTHS.col3};"></colgroup>`;

  cleaned = cleaned.replace(
    /<table[^>]*>/gi,
    `<table class="cmp-table">${colgroupHtml}`,
  );

  // 💡 モデルがデータ行（1列目の行見出しなど）にも <th> を使うと全セルが紺色化する事故への対策：
  //    見出しは先頭の <tr> のみとし、2行目以降の <th> はすべて <td> に変換してからスタイルを適用する
  //    （先読み (?=[\s>]) で <thead> 等の別タグを誤って書き換えないようにする）
  const rowParts = cleaned.split(/(<\/tr>)/gi);
  for (let i = 2; i < rowParts.length; i += 2) {
    rowParts[i] = rowParts[i]
      .replace(/<th(?=[\s>])/gi, "<td")
      .replace(/<\/th>/gi, "</td>");
  }
  // 💡 「第一候補：〜」の列見出しをバッジ化する（先頭行のみ。2行目以降は上の工程で th→td 矯正済み）
  rowParts[0] = rowParts[0].replace(
    /第一候補[：:]/,
    '<span class="badge-rec">第一候補</span><br/>',
  );
  cleaned = rowParts.join("");

  // 💡 th/td への class 付与は廃止。スタイルは globals.css の .cmp-table に集約する

  return cleaned;
};

// ===== 義歯版 コード固定比較表コンポーネント =====
// AI生成の比較表に代わり、コード側から固定文言でレンダリングする。
// 列構成：項目／保険の入れ歯（レジン床）／first_candidate の名称
// 各セル文言は監修者による後日レビュー対象。
function DentureComparisonTable({
  firstCandidate,
  sheetMode,
}: {
  firstCandidate: string;
  sheetMode: Decision["sheetMode"];
}) {
  const badgeLabel = sheetMode === "insurance_first" ? "参考候補" : "第一候補";
  const content = resolveDentureTableContent(firstCandidate);

  const rows = [
    {
      item: "主な目的",
      insurance: "国の規則に基づく、基本的な咀嚼・発音機能の回復",
      self: content.purpose,
    },
    {
      item: "使用素材",
      insurance: "レジン（プラスチック）床",
      self: content.material,
    },
    {
      item: "痛み・外れへの配慮",
      insurance: "標準的な設計。装着後の調整で対応",
      self: content.pain_and_loose,
    },
    {
      item: "得られる体験・変化",
      insurance:
        "費用を抑えながら、食事や会話の基本的な機能を取り戻すことにつながります",
      self: content.experience,
    },
    {
      item: "想定通院回数（レンジ）",
      insurance: "3〜5回程度",
      self: content.visits,
    },
    {
      item: "費用（レンジ）",
      insurance: "保険適用（1〜3割負担）",
      self: content.cost,
    },
  ];

  return (
    <table className="cmp-table">
      <colgroup>
        <col style={{ width: TABLE_COL_WIDTHS.col1 }} />
        <col style={{ width: TABLE_COL_WIDTHS.col2 }} />
        <col style={{ width: TABLE_COL_WIDTHS.col3 }} />
      </colgroup>
      <thead>
        <tr>
          <th>項目</th>
          <th>保険の入れ歯（レジン床）</th>
          <th>
            <span className="badge-rec">{badgeLabel}</span>
            <br />
            {firstCandidate}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.item}>
            <td>{row.item}</td>
            <td>{row.insurance}</td>
            <td>{row.self}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ===== クラウン版 固定テキスト・判定テーブル =====

const CROWN_CANDIDATES = {
  FULL_ZIRCONIA: {
    name: "フルジルコニア",
    price: "95,000円（税込）",
  },
  EMAX: {
    name: "e.max（ガラスセラミック）",
    price: "100,000円（税込）",
  },
  ZIRCONIA_CERAMIC: {
    name: "ジルコニアセラミック",
    price: "145,000円（税込）",
  },
  GOLD: {
    name: "ゴールド",
    price: "180,000円（税込）",
  },
} as const;

type CrownCandidate =
  (typeof CROWN_CANDIDATES)[keyof typeof CROWN_CANDIDATES];

const INSURANCE_TEXT_CROWN =
  "保険の被せ物は、国の規則で使える素材や製作の工程が定められている、歯の基本的な機能を回復するためのものです。費用を抑えながら、しっかりとした治療を受けることができます。";

const DISCLAIMER_CROWN =
  "※本シートはAIが素材選びの一般的な情報を整理した目安です。治療内容・適合する素材の最終判断は、検査のうえ歯科医師が行います。";

const NOTE_TEXTS_CROWN: Record<string, string> = {
  core_note:
    "※土台（コア）の作り直しが必要な場合は、別途1万〜1.5万円程度かかることがあります。",
  gold_price_note:
    "※ゴールドの価格は金の相場により変動します。お見積もり時にご確認ください。",
  metal_free_only:
    "※金属アレルギーのご申告があるため、今回は金属を使わない素材のみをご案内しています。",
  doctor_check_bruxism:
    "※歯ぎしり・食いしばりのご申告があります。素材の最終判断は歯科医師の確認が必要です。必要に応じて就寝時のマウスピース（ナイトガード）のご案内もできます。",
};

type CrownDecision = {
  sheetMode: "careful" | "insurance_first" | "standard";
  firstCandidate: string;
  candidatePriceRange: string;
  noteFlags: string[];
};

// 💡 クラウン版判定ロジック（Phase 2）
function computeCrownDecision(f: CrownFormState): CrownDecision {
  // P0: 痛み・違和感あり → 慎重モード（第一候補なし）
  if (f.has_pain !== "特になし") {
    return {
      sheetMode: "careful",
      firstCandidate: "",
      candidatePriceRange: "",
      noteFlags: [],
    };
  }

  // core_note はクラウン版では全件に付す（土台の有無が未入力のため安全側）
  const noteFlags: string[] = ["core_note"];

  // P1: 金属アレルギー → 金属素材を候補・比較表から除外
  const metalFreeOnly = f.metal_allergy !== "特になし";
  if (metalFreeOnly) noteFlags.push("metal_free_only");

  // P2: 歯ぎしり・食いしばり
  if (f.bruxism !== "特になし") noteFlags.push("doctor_check_bruxism");

  // cost_sensitivity = 費用は抑えたい → 保険ファースト
  if (f.cost_sensitivity === "費用は抑えたい") {
    return {
      sheetMode: "insurance_first",
      firstCandidate: "",
      candidatePriceRange: "",
      noteFlags,
    };
  }

  let c: CrownCandidate;

  if (f.target_site === "前歯（1〜3番）") {
    if (f.chief_priority === "強度・長持ち") {
      c = CROWN_CANDIDATES.ZIRCONIA_CERAMIC;
    } else {
      // 見た目の自然さ / 金属を避けたい
      c = CROWN_CANDIDATES.EMAX;
    }
  } else if (f.target_site === "小臼歯（4〜5番）") {
    if (f.chief_priority === "見た目の自然さ") {
      c = CROWN_CANDIDATES.EMAX;
    } else {
      // 強度・長持ち / 金属を避けたい
      c = CROWN_CANDIDATES.FULL_ZIRCONIA;
    }
  } else {
    // 大臼歯（6〜7番）
    if (f.chief_priority === "見た目の自然さ") {
      c = CROWN_CANDIDATES.ZIRCONIA_CERAMIC;
    } else if (f.chief_priority === "金属を避けたい" || metalFreeOnly) {
      c = CROWN_CANDIDATES.FULL_ZIRCONIA;
    } else {
      // 強度・長持ち
      if (f.bruxism === "特になし") {
        c = CROWN_CANDIDATES.GOLD;
      } else {
        c = CROWN_CANDIDATES.FULL_ZIRCONIA;
      }
    }
  }

  if (c === CROWN_CANDIDATES.GOLD) noteFlags.push("gold_price_note");

  return {
    sheetMode: "standard",
    firstCandidate: c.name,
    candidatePriceRange: c.price,
    noteFlags,
  };
}

// ===== クラウン版 コード固定比較表コンポーネント =====
const CROWN_INSURANCE_ROWS: Record<
  CrownFormState["target_site"],
  Array<{
    name: string;
    appearance: string;
    strength: string;
    cost: string;
    hygiene: string;
    conditionalNote?: string;
  }>
> = {
  "前歯（1〜3番）": [
    {
      name: "硬質レジン前歯冠",
      appearance: "白いが経年で変色する傾向がある",
      strength: "摩耗・変色が起こりやすい傾向がある",
      cost: "3割負担で数千円程度",
      hygiene: "表面に汚れがつきやすい傾向がある",
    },
  ],
  "小臼歯（4〜5番）": [
    {
      name: "CAD/CAM冠（条件付き）",
      appearance: "白い（単色）",
      strength: "強い力で摩耗・破折する場合がある",
      cost: "3割負担で数千円程度",
      hygiene: "標準的",
      conditionalNote: "※条件付き",
    },
  ],
  "大臼歯（6〜7番）": [
    {
      name: "CAD/CAM冠（白い素材）",
      appearance: "白い（単色）",
      strength: "強い力で摩耗・破折する場合がある",
      cost: "3割負担で数千円程度",
      hygiene: "標準的",
    },
    {
      name: "金属冠（銀歯）",
      appearance: "金属色（銀色）",
      strength: "高い（割れにくい）",
      cost: "3割負担で数千円程度",
      hygiene: "経年で適合が低下する場合がある",
    },
  ],
};

const CROWN_SELF_ROWS = [
  {
    key: "FULL_ZIRCONIA",
    name: CROWN_CANDIDATES.FULL_ZIRCONIA.name,
    appearance: "白い。奥歯でも自然な色合いに仕上がりやすい",
    strength: "硬く、割れにくい素材。咬む力が強い方にも選ばれやすい",
    cost: CROWN_CANDIDATES.FULL_ZIRCONIA.price,
    hygiene: "表面に汚れがつきにくく、お手入れがしやすい傾向がある",
  },
  {
    key: "EMAX",
    name: CROWN_CANDIDATES.EMAX.name,
    appearance: "光の透け方が自然で、前歯に近い仕上がりになりやすい",
    strength: "適度な強度。前歯・小臼歯向け",
    cost: CROWN_CANDIDATES.EMAX.price,
    hygiene: "滑らかな表面で、汚れがつきにくい傾向がある",
  },
  {
    key: "ZIRCONIA_CERAMIC",
    name: CROWN_CANDIDATES.ZIRCONIA_CERAMIC.name,
    appearance: "白さと透明感のバランス。自然な歯のような仕上がり",
    strength: "強度と審美性のバランスが取れた素材",
    cost: CROWN_CANDIDATES.ZIRCONIA_CERAMIC.price,
    hygiene: "表面が滑らかで、お手入れがしやすい傾向がある",
  },
  {
    key: "GOLD",
    name: CROWN_CANDIDATES.GOLD.name,
    appearance: "金属色（金色）",
    strength: "適合性が高く、長期的に安定しやすい",
    cost: CROWN_CANDIDATES.GOLD.price,
    hygiene: "表面が滑らかで、細菌の付着が少ない傾向がある",
  },
];

const CROWN_TABLE_COL_WIDTHS = {
  col1: "18%",
  col2: "20%",
  col3: "20%",
  col4: "22%",
  col5: "20%",
};

function CrownComparisonTable({
  firstCandidate,
  sheetMode,
  targetSite,
  metalFreeOnly,
}: {
  firstCandidate: string;
  sheetMode: CrownDecision["sheetMode"];
  targetSite: CrownFormState["target_site"];
  metalFreeOnly: boolean;
}) {
  const insuranceRows = CROWN_INSURANCE_ROWS[targetSite].filter(
    (r) => !metalFreeOnly || r.name !== "金属冠（銀歯）",
  );
  const selfRows = CROWN_SELF_ROWS.filter(
    (r) => !metalFreeOnly || r.key !== "GOLD",
  );

  const headerLabels = [
    "項目",
    "見た目",
    "強度・耐久性",
    "1本あたり費用（目安）",
    "予防・衛生面",
  ];

  return (
    <table className="cmp-table">
      <colgroup>
        <col style={{ width: CROWN_TABLE_COL_WIDTHS.col1 }} />
        <col style={{ width: CROWN_TABLE_COL_WIDTHS.col2 }} />
        <col style={{ width: CROWN_TABLE_COL_WIDTHS.col3 }} />
        <col style={{ width: CROWN_TABLE_COL_WIDTHS.col4 }} />
        <col style={{ width: CROWN_TABLE_COL_WIDTHS.col5 }} />
      </colgroup>
      <thead>
        <tr>
          {headerLabels.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {insuranceRows.map((row) => (
          <tr key={row.name}>
            <td>
              {sheetMode === "insurance_first" && (
                <span className="badge-rec">参考候補</span>
              )}
              {sheetMode === "insurance_first" && <br />}
              {row.name}
              {row.conditionalNote && (
                <span className="block text-[10px] text-ink-soft mt-1">
                  {row.conditionalNote}
                </span>
              )}
            </td>
            <td>{row.appearance}</td>
            <td>{row.strength}</td>
            <td>{row.cost}</td>
            <td>{row.hygiene}</td>
          </tr>
        ))}
        {selfRows.map((row) => {
          const isFirst = firstCandidate === row.name;
          return (
            <tr key={row.name} className={isFirst ? "bg-accent-tint/30" : ""}>
              <td>
                {isFirst && <span className="badge-rec">第一候補</span>}
                {isFirst && <br />}
                {row.name}
              </td>
              <td>{row.appearance}</td>
              <td>{row.strength}</td>
              <td>{row.cost}</td>
              <td>{row.hygiene}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// 💡 エラーの日本語化分類（ユーザーには「見出し＋行動」、サポートには「スクショで読める診断行」を見せる）
type ClassifiedError = {
  kind: "congestion" | "timeout" | "config" | "network" | "other";
  kindLabel: string;
  headline: string;
  guidance: string;
  code: string;
};

function classifyError(raw: string): ClassifiedError {
  const code = raw.match(/\b(\d{3})\b/)?.[1] || "-";
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return {
      kind: "congestion",
      kindLabel: "サーバー混雑",
      headline: "AIサーバーが混雑しています",
      guidance: "数分おいてから、もう一度「生成」ボタンを押してください。",
      code,
    };
  }
  if (/504|timeout|timed out|deadline/i.test(raw)) {
    return {
      kind: "timeout",
      kindLabel: "タイムアウト",
      headline: "生成に時間がかか�����います",
      guidance: "もう一度お試しください。",
      code,
    };
  }
  if (/401|403|認証|API key|access_token/i.test(raw)) {
    return {
      kind: "config",
      kindLabel: "接続設定",
      headline: "接続設定に問題があります",
      guidance: "サポートへご連絡ください（利用���院の設定を確認します）。",
      code,
    };
  }
  if (/通信|network|fetch/i.test(raw)) {
    return {
      kind: "network",
      kindLabel: "通信",
      headline: "通信エラーが発生しました",
      guidance: "ネットワーク環境を確認のうえ、もう一度お試しください。",
      code,
    };
  }
  // 既に日本語で書かれた案内（トークン未登録等）はそのまま見せる
  return {
    kind: "other",
    kindLabel: "その他",
    headline: raw,
    guidance: "",
    code,
  };
}

// ===== 義歯版 入力フォームコンポーネント =====
function DentureForm({
  formData,
  handleSelect,
  handleMultiSelect,
}: {
  formData: FormState;
  handleSelect: (key: string, value: string) => void;
  handleMultiSelect: (
    key: "current_denture_complaints" | "emotion_drivers" | "red_flag_words",
    value: string,
  ) => void;
}) {
  return (
    <div className="text-xs">
      {/* 1. 入れ歯の使用状況 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">01</span>
          入れ歯の使用状況
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.denture_status.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("denture_status", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                formData.denture_status === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 残っている歯 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">02</span>
          残っている歯
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {FORM_DATA.remaining_teeth.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("remaining_teeth", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                formData.remaining_teeth === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 対象の顎 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">03</span>
          対象の顎
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.target_jaw.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("target_jaw", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                formData.target_jaw === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 4. 欠損部位（総義歯扱いの場合は「該当なし（総義歯）」に固定される） */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">04</span>
          欠損部位
        </label>
        <select
          value={formData.defect_site}
          onChange={(e) => handleSelect("defect_site", e.target.value)}
          className="w-full p-2.5 border rounded-lg bg-white border-line text-base shadow-xs focus:border-accent focus:outline-none transition"
        >
          {FORM_DATA.defect_site
            .filter((d) =>
              formData.remaining_teeth === "ほとんど無い" ||
              formData.remaining_teeth === "1本もない（無歯顎）"
                ? d === "該当なし（総義歯）"
                : d !== "該当なし（総義歯）",
            )
            .map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
        </select>
      </div>

      {/* 5. 使用年数 & 6. 調整履歴 */}
      <div className="grid grid-cols-2 gap-x-5 border-b border-line">
        <div className="py-3.5">
          <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
            <span className="font-serif-jp text-gold mr-1.5">05</span>
            現義歯の使用年数
          </label>
          <select
            value={formData.denture_duration}
            onChange={(e) =>
              handleSelect("denture_duration", e.target.value)
            }
            className="w-full p-2.5 border rounded-lg bg-white border-line text-base shadow-xs focus:border-accent focus:outline-none transition"
          >
            {FORM_DATA.denture_duration
              .filter((d) =>
                formData.denture_status === "使っていない（初めて）"
                  ? d === "該当なし（未使用者）"
                  : d !== "該当なし（未使用者）",
              )
              .map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
          </select>
        </div>
        <div className="py-3.5">
          <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
            <span className="font-serif-jp text-gold mr-1.5">06</span>
            調整・履歴
          </label>
          <select
            value={formData.adjustment_history}
            onChange={(e) =>
              handleSelect("adjustment_history", e.target.value)
            }
            className="w-full p-2.5 border rounded-lg bg-white border-line text-base shadow-xs focus:border-accent focus:outline-none transition"
          >
            {FORM_DATA.adjustment_history
              .filter((h) =>
                formData.denture_status === "使っていない（初めて）"
                  ? h === "該当なし（未使用者）"
                  : h !== "該当なし（未使用者）",
              )
              .map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* 7. 口の乾き & 8. 顎堤・粘膜の状態 */}
      <div className="grid grid-cols-2 gap-x-5 border-b border-line">
        <div className="py-3.5">
          <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
            <span className="font-serif-jp text-gold mr-1.5">07</span>
            口の乾き・唾液
          </label>
          <select
            value={formData.oral_dryness}
            onChange={(e) => handleSelect("oral_dryness", e.target.value)}
            className="w-full p-2.5 border rounded-lg bg-white border-line text-base shadow-xs focus:border-accent focus:outline-none transition"
          >
            {FORM_DATA.oral_dryness.map((od) => (
              <option key={od} value={od}>
                {od}
              </option>
            ))}
          </select>
        </div>
        <div className="py-3.5">
          <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
            <span className="font-serif-jp text-gold mr-1.5">08</span>
            顎堤・粘膜の状態
          </label>
          <select
            value={formData.ridge_mucosa}
            onChange={(e) => handleSelect("ridge_mucosa", e.target.value)}
            className="w-full p-2.5 border rounded-lg bg-white border-line text-base shadow-xs focus:border-accent focus:outline-none transition"
          >
            {FORM_DATA.ridge_mucosa.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 9. 期待値タイプ */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">09</span>
          期待値タイプ
        </label>
        <select
          value={formData.expectation_type}
          onChange={(e) =>
            handleSelect("expectation_type", e.target.value)
          }
          className="w-full p-2.5 border rounded-lg bg-white border-line text-base shadow-xs focus:border-accent focus:outline-none transition"
        >
          {FORM_DATA.expectation_type.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
      </div>

      {/* 10. 費用感度 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">10</span>
          費用感度
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.cost_sensitivity.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("cost_sensitivity", item)}
              className={`flex-1 py-2.5 px-1 min-h-[44px] rounded-lg border font-medium transition text-center text-[11px] ${
                formData.cost_sensitivity === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 11. 現義歯の主な不満 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">11</span>
          現義歯の主な不満（複数可）
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FORM_DATA.current_denture_complaints.map((item) => {
            const isActive =
              formData.current_denture_complaints.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() =>
                  handleMultiSelect("current_denture_complaints", item)
                }
                className={`py-2 px-3 min-h-[44px] rounded-md border text-xs transition ${
                  isActive
                    ? "bg-accent-tint text-accent border-accent font-bold"
                    : "bg-white text-ink border-line hover:border-accent"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* 12. 追求したい情緒価値 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">12</span>
          追求したい情緒価値（複数可）
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FORM_DATA.emotion_drivers.map((item) => {
            const isActive = formData.emotion_drivers.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleMultiSelect("emotion_drivers", item)}
                className={`py-2 px-3 min-h-[44px] rounded-md border text-xs transition ${
                  isActive
                    ? "bg-accent-tint text-accent border-accent font-bold"
                    : "bg-white text-ink border-line hover:border-accent"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* 13. 要注意ワード */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">13</span>
          要注意ワード（慎重モード）
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FORM_DATA.red_flag_words.map((item) => {
            const isActive = formData.red_flag_words.includes(item);
            const isRose = item !== "特になし";
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleMultiSelect("red_flag_words", item)}
                className={`py-2 px-3 min-h-[44px] rounded-md border text-xs transition ${
                  isActive
                    ? isRose
                      ? "bg-rose-50 text-rose-700 border-rose-600 font-bold shadow-sm"
                      : "bg-accent-tint text-accent border-accent font-bold"
                    : "bg-white text-ink border-line hover:border-accent"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* 14. 現場メモ */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">14</span>
          現場メモ（任意）
        </label>
        <input
          type="text"
          value={formData.free_memo}
          onChange={(e) =>
            handleSelect("free_memo", e.target.value)
          }
          placeholder="家族の同席希望、持病など"
          className="w-full p-2.5 border border-line rounded-lg bg-white text-base shadow-xs focus:border-accent focus:outline-none transition"
        />
      </div>
    </div>
  );
}

// ===== クラウン版 入力フォームコンポーネント =====
function CrownForm({
  formData,
  handleSelect,
}: {
  formData: CrownFormState;
  handleSelect: (key: string, value: string) => void;
}) {
  return (
    <div className="text-xs space-y-0">
      {/* 1. 被せ物の部位 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">01</span>
          被せ物の部位
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_target_site.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("target_site", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center text-xs ${
                formData.target_site === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 笑ったときの見え方 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">02</span>
          笑ったときの見え方
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_visibility.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("visibility", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center text-xs ${
                formData.visibility === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 患者さまが重視していること */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">03</span>
          患者さまが重視していること
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_chief_priority.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("chief_priority", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center text-xs ${
                formData.chief_priority === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 4. 金属アレルギーの有無 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">04</span>
          金属アレルギーの有無
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_metal_allergy.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("metal_allergy", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                formData.metal_allergy === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 5. 歯ぎしり・食いしばり */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">05</span>
          歯ぎしり・食いしばり
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_bruxism.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("bruxism", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                formData.bruxism === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 6. 痛み・違和感の有無（検査案内モード） */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">06</span>
          痛み・違和感の有無（検査案内モード）
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_has_pain.map((item) => {
            const isRose = item === "あり";
            const isActive = formData.has_pain === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleSelect("has_pain", item)}
                className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                  isActive
                    ? isRose
                      ? "bg-rose-50 text-rose-700 border-rose-600 font-bold shadow-sm"
                      : "bg-accent-tint text-accent border-accent font-bold"
                    : "bg-white text-ink border-line hover:border-accent"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. 費用へのご意向 */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">07</span>
          費用へのご意向
        </label>
        <div className="flex gap-1.5">
          {FORM_DATA.crown_cost_sensitivity.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect("cost_sensitivity", item)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                formData.cost_sensitivity === item
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 8. 現場メモ */}
      <div className="py-3.5 border-b border-line">
        <label className="block font-bold mb-1.5 text-ink text-sm tracking-wide">
          <span className="font-serif-jp text-gold mr-1.5">08</span>
          現場メモ（任意）
        </label>
        <input
          type="text"
          value={formData.free_memo}
          onChange={(e) => handleSelect("free_memo", e.target.value)}
          placeholder="患者様のご希望・気になる点など（患者情報は入れない）"
          className="w-full p-2.5 border border-line rounded-lg bg-white text-base shadow-xs focus:border-accent focus:outline-none transition"
        />
      </div>
    </div>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);

  // 💡 トークン・医院情報・衛生士名の管理
  const [token, setToken] = useState("");
  const [clinicName, setClinicName] = useState("");
  // 💡 セミナーデモ用トークンかどうか（true の間はメール送信を無効化する）
  const [isDemo, setIsDemo] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [isStandalone, setIsStandalone] = useState(true); // PWA判定（初期true=バナー非表示。マウント後に実判定）

  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_DATA);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<{
    patientSheet: string;
    talkScript: string;
  } | null>(null);
  // 💡 生成時に発番される管理ID（医院へ送信のメール本文で使用するため保持する）
  const [patientAnonId, setPatientAnonId] = useState("");
  const [activeTab, setActiveTab] = useState<"patient" | "talk">("patient");
  // 💡 トークカンペの表示モード。チェアサイドで一瞥できる「要点」を初期値にし、学習・時間がある時は「全文」に切替
  const [talkView, setTalkView] = useState<"keyword" | "full">("keyword");
  const [error, setError] = useState<string | null>(null);
  // 💡 エラー発生時刻（スクショ診断用に表示するため記録）
  const [errorAt, setErrorAt] = useState<number | null>(null);
  const showError = (raw: string | null) => {
    setError(raw);
    setErrorAt(raw ? Date.now() : null);
  };
  const [sending, setSending] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    setMounted(true);
    console.log("[BUILD] 2026-08-31 crown-mode-phase2");

    // 1. ?t= パラメータまたは localStorage からトークンをロード
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("t");
    const savedToken = localStorage.getItem("clinic_access_token");
    // 💡 iOSのホーム画面追加（PWA）はSafariとlocalStorageを共有しないため、Cookie経由でもトークンを引き継ぐ
    const cookieToken =
      document.cookie.match(/(?:^|;\s*)clinic_access_token=([^;]*)/)?.[1] || "";

    const activeToken =
      urlToken || savedToken || decodeURIComponent(cookieToken) || "";
    if (activeToken) {
      setToken(activeToken);
      localStorage.setItem("clinic_access_token", activeToken);
      // 💡 PWA引き継ぎ用Cookie（1年有効。Safariで?t=付きURLを一度開けばPWA側でも認識される）
      document.cookie = `clinic_access_token=${encodeURIComponent(activeToken)}; max-age=31536000; path=/; SameSite=Lax; Secure`;

      // 💡 トークンから正式な医院名を引く（患者向けシートに「接続中 (token)」等の
      //    内部表記を絶対に出さないため、解決できた場合のみ state に正式名を入れる）
      const cachedName = localStorage.getItem("clinic_name") || "";
      if (cachedName) setClinicName(cachedName);
      // デモフラグもキャッシュから即時復元（フェッチ完了前の一瞬の誤表示を防ぐ）
      if (localStorage.getItem("clinic_is_demo") === "1") setIsDemo(true);

      fetch(`/api/clinic?t=${encodeURIComponent(activeToken)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.name) {
            setClinicName(d.name);
            localStorage.setItem("clinic_name", d.name);
            const demo = d.is_demo === true;
            setIsDemo(demo);
            if (demo) localStorage.setItem("clinic_is_demo", "1");
            else localStorage.removeItem("clinic_is_demo");
          } else {
            // 未登録トークン：シートには医院名を出さない（画面の接続状況バーで警告表示）
            setClinicName("");
            localStorage.removeItem("clinic_name");
            setIsDemo(false);
            localStorage.removeItem("clinic_is_demo");
          }
        })
        .catch(() => {
          setClinicName("");
          setIsDemo(false);
        });
    } else {
      setClinicName(""); // トークンなし：シートには医院名を出さない
      setIsDemo(false);
    }

    // 2. 担当衛生士名を localStorage から復元
    const savedStaff = localStorage.getItem("staff_name") || "";
    setStaffName(savedStaff);

    // 3. PWA（ホーム画面追加済み）かどうかを判定。未追加なら案内バナーを出す
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true,
    );
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (!previewAreaRef.current) return;
      const availableWidth = previewAreaRef.current.clientWidth - 32;
      setFitScale(Math.min(1, availableWidth / A4_WIDTH_PX));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [result, activeTab]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) =>
          prev < LOADING_STEPS.length - 1 ? prev + 1 : prev,
        );
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (!mounted) return null;

  const handleSelect = (key: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      // 💡 未使用者を選んだら、使用年数・調整履歴は自動で「該当なし（未使用者）」に揃える（Dify定義との整合）
      if (key === "denture_status") {
        if (value === "使っていない（初めて）") {
          next.denture_duration = "該当なし（未使用者）";
          next.adjustment_history = "該当なし（未使用者）";
          // 💡 未使用者に現義歯の不満は存在しないため、選択を自動で空にする
          next.current_denture_complaints = [];
        } else {
          if (next.denture_duration === "該当なし（未使用者）")
            next.denture_duration = "1〜5年";
          if (next.adjustment_history === "該当なし（未使用者）")
            next.adjustment_history = "調整しても改善しない";
        }
      }
      // 💡 総義歯扱い（ほとんど無い／無歯顎）を選んだら欠損部位を「該当なし（総義歯）」に固定（Dify定義との整合）
      if (key === "remaining_teeth") {
        const fd = value === "ほとんど無い" || value === "1本もない（無歯顎）";
        if (fd) next.defect_site = "該当なし（総義歯）";
        else if (next.defect_site === "該当なし（総義歯）")
          next.defect_site = "前歯部";
      }
      return next;
    });
  };

  const handleMultiSelect = (
    key: "current_denture_complaints" | "emotion_drivers" | "red_flag_words",
    value: string,
  ) => {
    setFormData((prev) => {
      const list = prev[key];
      if (value === "特になし") return { ...prev, [key]: ["特になし"] };
      const filteredList = list.filter((item) => item !== "特になし");
      const newList = filteredList.includes(value)
        ? filteredList.filter((item) => item !== value)
        : [...filteredList, value];
      return { ...prev, [key]: newList.length === 0 ? ["特になし"] : newList };
    });
  };

  const handleGenerate = async () => {
    // 💡 未登録トークン・医院未設定では生成を実行しない（ボタン非活性の保険として二重防御）
    if (!(token && clinicName)) {
      showError(
        "医院の接続が確認できません（トークン未登録または未設定）。右上の接続状況を確認してください。",
      );
      return;
    }
    setLoading(true);
    showError(null);
    setResult(null);

    // 💡 判定テーブルで候補・価格・換算・フラグを確定（AIには結果のみ渡す）
    const decision =
      formData.mode === "crown"
        ? computeCrownDecision(formData as CrownFormState)
        : computeDecision(formData);

    const basePayload = {
      mode: formData.mode,
      free_memo: formData.free_memo || "特になし",
      sheet_mode: decision.sheetMode,
      first_candidate: decision.firstCandidate,
      candidate_price_range: decision.candidatePriceRange,
      note_flags:
        decision.noteFlags.length > 0 ? decision.noteFlags.join(", ") : "なし",
      staffName: staffName.trim(), // 👈 レポートの「担当」欄用（/api/counseling 側で [[STAFF_NAME]] をこの値に置換する）
      token: token, // 👈 医院特定用（usage_logs の clinic_id を動的化するため）
    };

    const payload =
      formData.mode === "crown"
        ? {
            ...basePayload,
            target_site: formData.target_site,
            visibility: formData.visibility,
            chief_priority: formData.chief_priority,
            metal_allergy: formData.metal_allergy,
            bruxism: formData.bruxism,
            has_pain: formData.has_pain,
            cost_sensitivity: formData.cost_sensitivity,
          }
        : {
            ...basePayload,
            denture_status: formData.denture_status,
            remaining_teeth: formData.remaining_teeth,
            target_jaw: formData.target_jaw,
            defect_site: formData.defect_site,
            current_denture_complaints:
              formData.current_denture_complaints.join(", "),
            denture_duration: formData.denture_duration,
            adjustment_history: formData.adjustment_history,
            oral_dryness: formData.oral_dryness,
            ridge_mucosa: formData.ridge_mucosa,
            emotion_drivers: formData.emotion_drivers.join(", "),
            expectation_type: formData.expectation_type,
            cost_sensitivity: formData.cost_sensitivity,
            red_flag_words: formData.red_flag_words.join(", "),
            price_per_day: (decision as Decision).pricePerDay,
          };

    try {
      const res = await fetch("/api/counseling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResult({
          patientSheet: data.patientSheet,
          talkScript: data.talkScript,
        });
        setPatientAnonId(data.patientAnonId || "");
      } else {
        showError("AI生成エラー: " + (data.error || "通信エラー"));
      }
    } catch {
      showError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const buildSheetPdfBlob = async (): Promise<Blob | null> => {
    const { toJpeg } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");

    const originalScale = fitScale;
    setFitScale(1);

    // DOMのレイアウト更新を待つ
    // ※「PDFで開く」は新タブがフォーカスを奪うため元タブがバックグラウンド化し、
    //   requestAnimationFrame が停止して永久に解決しない事故が起きる。
    //   setTimeout はバックグラウンドでも発火するため併用し、必ず先に進める。
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      setTimeout(() => resolve(), 300); // フォーカスが外れても300msで必ず進む保険
    });

    const pages = document.querySelectorAll(".sheet-page-portrait");
    if (pages.length === 0) {
      setFitScale(originalScale);
      return null;
    }

    const pdf = new jsPDF("p", "mm", "a4");

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i] as HTMLElement;

      const dataUrl = await toJpeg(pageEl, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          margin: "0",
        },
      });

      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297);
    }

    setFitScale(originalScale);
    return pdf.output("blob");
  };

  // 💡 「A4印刷」ボタン：実績済みのPDF生成エンジンでA4ぴったりのPDFを作り、新しいタブで開く
  //    【重要】新タブを「先に」開く方式は、フォーカスを奪われた元タブがバックグラウンド化し、
  //    生成処理（html-to-image内部のタイマー系処理を含む）が停止する不具合があった。
  //    そのため「フォーカスのある元タブで生成を完了させてから、最後にタブを開く」順序に変更。
  //    ポップアップがブロックされた場合はPDFダウンロードに自動フォールバックする。
  const handleOpenPrintPdf = async () => {
    setPrintingPdf(true);
    try {
      const pdfBlob = await buildSheetPdfBlob(); // ← 元タブがフォーカスを持つ間に生成を完結させる
      if (!pdfBlob) {
        alert("PDF化する領域が見つかりません。先にシートを生成してください。");
        return;
      }
      const url = URL.createObjectURL(pdfBlob);
      const win = window.open(url, "_blank");
      if (!win) {
        // ポップアップブロック時はダウンロードにフォールバック
        const a = document.createElement("a");
        a.href = url;
        a.download = "counseling-sheet.pdf";
        a.click();
        alert(
          "新しいタブがブロックされたため、PDFをダウンロードしました。ダウンロードしたPDFを開いて印刷してください。",
        );
      }
    } catch (err: any) {
      alert("PDF生成でエラーが発生しました。詳細: " + err.message);
    } finally {
      setPrintingPdf(false);
    }
  };

  // 💡 動的トークンと衛生士名を伴う送信処理（Resend 経由の自前メール送信）
  const handleSendPrint = async () => {
    if (!token) {
      alert(
        "医院トークンが未設定です。?t=トークン 付きURLからアクセスしてください。",
      );
      return;
    }
    // 💡 デモトークンからのメール送信は拒否（ボタン非表示の保険として二重防御）
    if (isDemo) {
      alert("デモ版ではメール送信はご利用いただけません。");
      return;
    }

    setSending(true);
    try {
      const pdfBlob = await buildSheetPdfBlob();
      if (!pdfBlob) {
        alert("PDF化する領域が見つかりません。");
        setSending(false);
        return;
      }

      const currentStaff = staffName.trim() || "担当衛生士";
      localStorage.setItem("staff_name", currentStaff);

      // PDF Blob を base64 に変換
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const pdfData = btoa(binary);

      // ファイル名用の日付（YYYYMMDD / 日本時間）
      const now = new Date();
      const dateForFilename = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const fileName = `AI客観分析レポート_${dateForFilename}_${patientAnonId || ""}.pdf`;

      const res = await fetch("/api/send-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfData,
          accessToken: token,
          fileName,
          patientAnonId: patientAnonId || "",
          issueDate: new Date().toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Tokyo",
          }),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        alert("医院の登録メールアドレス宛に送信しました");
      } else {
        alert("送信に失敗しました。時間をおいて再度お試しください");
      }
    } catch (err: any) {
      alert("送信に失敗しました。時間をおいて再度お試しください");
    } finally {
      setSending(false);
    }
  };

  const cleanClinicName = clinicName.replace(/様$/, "");

  // 💡 判定結果はレンダリング・崩れ検知の両方で使うためここで確定
  const decision =
    formData.mode === "crown"
      ? computeCrownDecision(formData as CrownFormState)
      : computeDecision(formData);

  // 💡 カンペが新フォーマット（【キーワード】併記）かどうか。旧形式の生成結果では切替ボタン自体を出さない
  const talkKeywordAvailable = result
    ? result.talkScript.includes("【キーワード】")
    : false;

  // 💡 生成結果の構造異常を検知（表示崩れの自救導線。再生成で治るケースをユーザーが判断できるようにする）
  const resultSuspicious = (() => {
    if (!result) return false;
    const talkBroken = !result.talkScript || !result.talkScript.includes("■");
    // 💡 慎重モード（要注意ワードが選択されている／痛み・違和感あり）では比較表を出さないのが正しい動作のため、表の欠落は異常とみなさない
    const carefulInput =
      decision.sheetMode === "cautious" || decision.sheetMode === "careful";
    // 💡 Phase1: 比較表はコード固定で表示するため、AI出力に <table> が含まれていなくても異常ではない
    //    crown の insurance_first も比較表を出すため、firstCandidate が空でも異常ではない
    const tableMissing =
      (decision.sheetMode === "normal" || decision.sheetMode === "standard") &&
      !decision.firstCandidate;
    return talkBroken || tableMissing;
  })();

  // 💡 A4から内容がはみ出した時だけ中身を自動縮小（高齢者向けの大きめ文字は維持し、はみ出し分だけ縮める）
  const fitContentToA4 = (el: HTMLDivElement | null) => {
    if (!el) return;
    el.style.zoom = "1";
    const available = A4_HEIGHT_PX - 91; // 上下の余白（12mm≒45px×2）を差し引いた利用可能な高さ
    const measured = el.scrollHeight;
    if (measured > available) {
      el.style.zoom = String(Math.max(0.7, available / measured));
    }
  };

  const A4PageWrapper = ({
    children,
    isLast,
  }: {
    children: React.ReactNode;
    isLast?: boolean;
  }) => (
    <div
      className="print-wrapper"
      style={{ width: A4_WIDTH_PX * fitScale, height: A4_HEIGHT_PX * fitScale }}
    >
      <div
        className={`sheet-page-portrait bg-paper shadow-md flex flex-col relative ${
          isLast ? "print:break-after-auto" : "print:break-after-page"
        }`}
        style={{
          width: `${A4_WIDTH_PX}px`,
          height: `${A4_HEIGHT_PX}px`,
          transform: `scale(${fitScale})`,
          transformOrigin: "top left",
          padding: "12mm",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          ref={fitContentToA4}
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // ===== 義歯版 A4患者シートコンポーネント =====
  const DenturePatientSheet = () => {
    const d = decision as Decision;
    const sheet = parsePatientSheet(result!.patientSheet);
    const intro = sheet.sections.find((s) => s.heading.includes("悩み"));
    // 💡 慎重モードでは「知っておいていただきたいこと」がこの枠に入る（比較表・おすすめを出さない代わりの本文セクション）
    // 💡 insurance_firstモードの見出しは「次の一歩の参考」になるため振り分けに含める
    const recommend = sheet.sections.find(
      (s) =>
        s.heading.includes("おすすめ") ||
        s.heading.includes("知っておいて") ||
        s.heading.includes("次の一歩"),
    );
    const tableSection = sheet.sections.find((s) => s.body.includes("<table"));
    // 💡 慎重モードでは「次のステップについて」がこの枠に入る（2ページ目の描画条件を満たす役割も兼ねる）
    const prosCons = sheet.sections.find(
      (s) =>
        s.heading.includes("良い点") ||
        s.heading.includes("注意点") ||
        s.heading.includes("次のステップ"),
    );
    const costSection = sheet.sections.find((s) =>
      s.heading.includes("費用"),
    );
    // 💡 「ご家族向けのまとめ」はどの枠にも合致せず非表示になっていたため追加（2026-08-30 修正）
    const familySection = sheet.sections.find((s) =>
      s.heading.includes("ご家族"),
    );

    // 💡 シートのタイトルはモデル出力を使わずフロントで固定する（2026-08-27 確定仕様）。
    //    慎重モードは「比較」を行わないため、実態に合わせてタイトルを分岐する。
    const isCarefulMode = d.sheetMode === "cautious";
    const sheetTitle = isCarefulMode
      ? "【AI客観分析レポート】ご希望の整理と次のステップ"
      : "【AI客観分析レポート】お口の治療選択肢の比較";

    const issueDate = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    });

    // 💡 セクション見出し（デザイン刷新案A）: 明朝体＋小さな色面マーカー＋下罫線。アイコン・青バーは廃止
    const SectionHead = ({
      children,
      gold,
      bare,
    }: {
      children: React.ReactNode;
      gold?: boolean;
      bare?: boolean;
    }) => (
      <div
        className={`flex items-center gap-2 ${bare ? "mb-2" : "border-b border-line pb-1.5 mb-2.5"}`}
      >
        <span
          className={`inline-block h-3 w-3 shrink-0 ${gold ? "bg-gold" : "bg-accent"}`}
        />
        <span className="font-serif-jp text-[15px] font-bold text-ink tracking-wide">
          {children}
        </span>
      </div>
    );

    // Phase 1: 費用ブロックに挿入する注記を組み立てる
    const costNotes = [
      ...(d.noteFlags.includes("cost_conscious")
        ? [NOTE_TEXTS_DENTURE.cost_conscious]
        : []),
      COST_NOTE_DENTURE,
      ...(d.noteFlags.includes("both_jaws_double")
        ? [NOTE_TEXTS_DENTURE.both_jaws_double]
        : []),
    ];

    // Phase 1: 一般注記ブロックに表示する注記（費用ブロック用は除外）
    const displayNoteFlags = d.noteFlags.filter(
      (flag) => flag !== "cost_conscious" && flag !== "both_jaws_double",
    );
    const noteItems = displayNoteFlags
      .map((flag) => NOTE_TEXTS_DENTURE[flag])
      .filter((text): text is string => !!text);

    const Header = () => (
      <div className="flex items-end justify-between gap-6 border-b-[1.5px] border-b-ink pb-3 mb-5">
        <div>
          <h1 className="font-serif-jp text-[15px] font-bold tracking-wide text-ink whitespace-nowrap">
            {sheetTitle}
          </h1>
          <div className="text-[8px] tracking-[0.3em] text-accent font-bold mt-1">
            AI OBJECTIVE ANALYSIS
          </div>
        </div>
        <div className="text-right text-[10.5px] leading-relaxed shrink-0 text-ink-soft">
          {cleanClinicName && (
            <div className="font-bold text-ink text-[11px]">{cleanClinicName}</div>
          )}
          <div className="text-[9px] mt-0.5 space-y-0.5">
            <div>発行日: {issueDate}</div>
            {staffName.trim() && <div>担当: {staffName.trim()}</div>}
            {patientAnonId && <div>管理ID: {patientAnonId}</div>}
          </div>
        </div>
      </div>
    );

    const Footer = () => (
      <div className="mt-auto border-t border-line pt-2 text-center text-[10px] text-ink-soft leading-relaxed">
        {DISCLAIMER_DENTURE}
      </div>
    );

    // 💡 比較表がないシート（慎重モード）は内容が1ページに収まるため単ページで描画する（2ページ目が余白だらけになるのを防ぐ）
    //    Phase1: 比較表はコード固定で表示するため、AI出力の tableSection 有無では判定しない
    const singlePageSheet = isCarefulMode;

    return (
      <>
        {/* PAGE 1 */}
        <A4PageWrapper isLast={singlePageSheet}>
          <Header />
          {intro && (
            <div
              className="text-[13px] leading-[2] text-ink mb-5"
              dangerouslySetInnerHTML={{
                __html: renderInline(intro.body),
              }}
            />
          )}
          {recommend && (
            <div className="bg-tint border-l-[3px] border-l-gold px-5 py-4 mb-5">
              <SectionHead gold bare>
                {stripEmoji(recommend.heading)}
              </SectionHead>
              <div
                className="text-[13px] leading-[2] text-ink"
                dangerouslySetInnerHTML={{
                  __html: renderInline(recommend.body),
                }}
              />
            </div>
          )}
          {/* Phase 1: 保険説明はコード固定文を必ず表示 */}
          {!isCarefulMode && (
            <div className="text-[13px] leading-[2] text-ink mb-5">
              {INSURANCE_TEXT_DENTURE}
            </div>
          )}
          {/* Phase 1: 比較表はAI出力に依存せずコード固定コンポーネントでレンダリング */}
          {!isCarefulMode && d.firstCandidate && (
            <div className="mb-5">
              <SectionHead>選択肢の比較</SectionHead>
              <DentureComparisonTable
                firstCandidate={d.firstCandidate}
                sheetMode={d.sheetMode}
              />
            </div>
          )}
          {/* Phase 1: 注記フラグに対応する固定注記をコード側で表示 */}
          {!isCarefulMode && noteItems.length > 0 && (
            <div className="mb-5">
              <SectionHead>注記</SectionHead>
              <ul className="list-disc pl-5 text-[13px] leading-[2] text-ink space-y-1">
                {noteItems.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {singlePageSheet && prosCons && (
            <div className="mb-5">
              <SectionHead>{stripEmoji(prosCons.heading)}</SectionHead>
              <div
                className="text-[13px] leading-[2] text-ink"
                dangerouslySetInnerHTML={{
                  __html: renderInline(prosCons.body),
                }}
              />
            </div>
          )}
          <Footer />
        </A4PageWrapper>

        {/* PAGE 2 */}
        {!singlePageSheet && (prosCons || costSection || familySection) && (
          <A4PageWrapper isLast>
            <Header />
            <div className="grid grid-cols-1 gap-6">
              {prosCons && (
                <div>
                  <SectionHead>{stripEmoji(prosCons.heading)}</SectionHead>
                  <div
                    className="text-[13px] leading-[2] text-ink"
                    dangerouslySetInnerHTML={{
                      __html: renderInline(prosCons.body),
                    }}
                  />
                </div>
              )}
              {costSection && (
                <div>
                  <SectionHead gold>{stripEmoji(costSection.heading)}</SectionHead>
                  <div className="border border-line px-5 py-4">
                    <div
                      className="text-[13px] leading-[2] text-ink"
                      dangerouslySetInnerHTML={{
                        __html: renderInline(costSection.body),
                      }}
                    />
                    {/* Phase 1: 費用ブロック末尾に固定の費用注記・両顎注記を、冒頭には費用重視注記を表示 */}
                    {costNotes.length > 0 && (
                      <div className="mt-3 text-[13px] leading-[2] text-ink border-t border-line pt-3 space-y-1">
                        {costNotes.map((note, i) => (
                          <p key={i}>{note}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {familySection && (
                <div>
                  <SectionHead>{stripEmoji(familySection.heading)}</SectionHead>
                  <div
                    className="text-[13px] leading-[2] text-ink"
                    dangerouslySetInnerHTML={{
                      __html: renderInline(familySection.body),
                    }}
                  />
                </div>
              )}
            </div>
            <Footer />
          </A4PageWrapper>
        )}
      </>
    );
  };

  // ===== クラウン版 A4患者シートコンポーネント =====
  const CrownPatientSheet = () => {
    const d = decision as CrownDecision;
    const sheet = parsePatientSheet(result!.patientSheet);

    // 💡 careful モードと通常モードで抽出する見出しを分ける
    const intro = sheet.sections.find(
      (s) => s.heading.includes("悩み") || s.heading.includes("お気持ち"),
    );
    const recommend = sheet.sections.find(
      (s) =>
        s.heading.includes("おすすめ") ||
        s.heading.includes("知っておいて") ||
        s.heading.includes("次の一歩"),
    );
    const prosCons = sheet.sections.find(
      (s) =>
        s.heading.includes("良い点") ||
        s.heading.includes("注意点") ||
        s.heading.includes("次のステップ"),
    );
    const costSection = sheet.sections.find((s) => s.heading.includes("費用"));

    // 💡 careful モードの4ブロックをすべて拾う（find では後半が落ちるため filter）
    const careSections = sheet.sections.filter(
      (s) =>
        s.heading.includes("お気持ち") ||
        s.heading.includes("検査") ||
        s.heading.includes("理由") ||
        s.heading.includes("流れ") ||
        s.heading.includes("素材選び") ||
        s.heading.includes("後回し"),
    );

    const isCarefulMode = d.sheetMode === "careful";
    const sheetTitle = isCarefulMode
      ? "【AI客観分析レポート】ご希望の整理と次のステップ"
      : "【AI客観分析レポート】被せ物素材の比較";

    const SectionHead = ({
      children,
      gold,
      bare,
    }: {
      children: React.ReactNode;
      gold?: boolean;
      bare?: boolean;
    }) => (
      <div
        className={`flex items-center gap-2 ${bare ? "mb-2" : "border-b border-line pb-1.5 mb-2.5"}`}
      >
        <span
          className={`inline-block h-3 w-3 shrink-0 ${gold ? "bg-gold" : "bg-accent"}`}
        />
        <span className="font-serif-jp text-[15px] font-bold text-ink tracking-wide">
          {children}
        </span>
      </div>
    );

    const noteItems = d.noteFlags
      .map((flag) => NOTE_TEXTS_CROWN[flag])
      .filter((text): text is string => !!text);

    // 💡 ヘッダー情報はプレースホルダではなくコード側で確定（義歯版と同じ構成）
    const issueDate = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    });

    const Header = () => (
      <div className="flex items-end justify-between gap-6 border-b-[1.5px] border-b-ink pb-3 mb-5">
        <div>
          <h1 className="font-serif-jp text-[15px] font-bold tracking-wide text-ink whitespace-nowrap">
            {sheetTitle}
          </h1>
          <div className="text-[8px] tracking-[0.3em] text-accent font-bold mt-1">
            AI OBJECTIVE ANALYSIS
          </div>
        </div>
        <div className="text-right text-[10.5px] leading-relaxed shrink-0 text-ink-soft">
          {cleanClinicName && (
            <div className="font-bold text-ink text-[11px]">
              {cleanClinicName}
            </div>
          )}
          <div className="text-[9px] mt-0.5 space-y-0.5">
            <div>発行日: {issueDate}</div>
            {staffName.trim() && <div>担当: {staffName.trim()}</div>}
            {patientAnonId && <div>管理ID: {patientAnonId}</div>}
          </div>
        </div>
      </div>
    );

    const Footer = () => (
      <div className="mt-auto border-t border-line pt-2 text-center text-[10px] text-ink-soft leading-relaxed">
        {DISCLAIMER_CROWN}
      </div>
    );

    const singlePageSheet = isCarefulMode;
    const f = formData as CrownFormState;

    return (
      <>
        {/* PAGE 1 */}
        <A4PageWrapper isLast={singlePageSheet}>
          <Header />
          {/* 💡 careful モードは一見して分かるバナーを表示 */}
          {isCarefulMode && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-5 py-4 mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <h2 className="font-bold text-rose-800 text-[15px]">
                  まずは検査をご案内しています
                </h2>
              </div>
            </div>
          )}
          {isCarefulMode ? (
            // 💡 careful モードは AI からの4ブロックをすべて強調表示
            <div className="space-y-4 mb-5">
              {careSections.map((s, i) => (
                <div
                  key={i}
                  className="bg-tint border-l-[3px] border-l-gold px-5 py-4"
                >
                  <SectionHead gold bare>
                    {stripEmoji(s.heading)}
                  </SectionHead>
                  <div
                    className="text-[13px] leading-[2] text-ink"
                    dangerouslySetInnerHTML={{
                      __html: renderInline(s.body),
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              {intro && (
                <div
                  className="text-[13px] leading-[2] text-ink mb-5"
                  dangerouslySetInnerHTML={{
                    __html: renderInline(intro.body),
                  }}
                />
              )}
              {recommend && (
                <div className="bg-tint border-l-[3px] border-l-gold px-5 py-4 mb-5">
                  <SectionHead gold bare>
                    {stripEmoji(recommend.heading)}
                  </SectionHead>
                  <div
                    className="text-[13px] leading-[2] text-ink"
                    dangerouslySetInnerHTML={{
                      __html: renderInline(recommend.body),
                    }}
                  />
                </div>
              )}
            </>
          )}
          {/* Phase 2: 保険説明はコード固定文を必ず表示 */}
          {!isCarefulMode && (
            <div className="text-[13px] leading-[2] text-ink mb-5">
              {INSURANCE_TEXT_CROWN}
            </div>
          )}
          {/* Phase 2: 比較表はAI出力に依存せずコード固定コンポーネントでレンダリング */}
          {!isCarefulMode && (
            <div className="mb-5">
              <SectionHead>選択肢の比較</SectionHead>
              <CrownComparisonTable
                firstCandidate={d.firstCandidate}
                sheetMode={d.sheetMode}
                targetSite={f.target_site}
                metalFreeOnly={f.metal_allergy !== "特になし"}
              />
            </div>
          )}
          {/* Phase 2: 注記フラグに対応する固定注記をコード側で表示 */}
          {!isCarefulMode && noteItems.length > 0 && (
            <div className="mb-5">
              <SectionHead>注記</SectionHead>
              <ul className="list-disc pl-5 text-[13px] leading-[2] text-ink space-y-1">
                {noteItems.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {!isCarefulMode && singlePageSheet && prosCons && (
            <div className="mb-5">
              <SectionHead>{stripEmoji(prosCons.heading)}</SectionHead>
              <div
                className="text-[13px] leading-[2] text-ink"
                dangerouslySetInnerHTML={{
                  __html: renderInline(prosCons.body),
                }}
              />
            </div>
          )}
          <Footer />
        </A4PageWrapper>

        {/* PAGE 2 */}
        {!singlePageSheet && (prosCons || costSection) && (
          <A4PageWrapper isLast>
            <Header />
            <div className="grid grid-cols-1 gap-6">
              {!isCarefulMode && prosCons && (
                <div>
                  <SectionHead>{stripEmoji(prosCons.heading)}</SectionHead>
                  <div
                    className="text-[13px] leading-[2] text-ink"
                    dangerouslySetInnerHTML={{
                      __html: renderInline(prosCons.body),
                    }}
                  />
                </div>
              )}
              {costSection && (
                <div>
                  <SectionHead gold>
                    {stripEmoji(costSection.heading)}
                  </SectionHead>
                  <div className="border border-line px-5 py-4">
                    <div
                      className="text-[13px] leading-[2] text-ink"
                      dangerouslySetInnerHTML={{
                        __html: renderInline(costSection.body),
                      }}
                    />
                    {noteItems.length > 0 && (
                      <div className="mt-3 text-[13px] leading-[2] text-ink border-t border-line pt-3 space-y-1">
                        {noteItems.map((note, i) => (
                          <p key={i}>{note}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Footer />
          </A4PageWrapper>
        )}
      </>
    );
  };

  return (
    <main className="min-h-screen bg-bg font-sans text-ink">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .sheet-page-portrait table {
          table-layout: fixed !important;
          width: 100% !important;
        }

        .sheet-page-portrait {
          width: 100%;
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          background-color: #fdfcf9;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }

          html, body, main, .app-layout, .print-area {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .print-wrapper {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          .sheet-page-portrait {
            transform: none !important;
            width: 210mm !important;
            height: auto !important;
            min-height: 297mm !important;
            padding: 12mm !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-wrapper:last-child .sheet-page-portrait,
          .sheet-page-portrait:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `,
        }}
      />

      <header className="no-print bg-paper border-b-[1.5px] border-b-ink text-ink py-3.5 px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-icon.png"
              alt="デンピストAI"
              className="h-9 w-9 rounded-lg"
            />
            <div>
              <h1 className="font-serif-jp text-base font-bold tracking-wider">
                デンピストAI
              </h1>
              <p className="text-[9px] tracking-[0.2em] text-ink-soft hidden sm:block">
                DENPIST AI
              </p>
            </div>
          </div>
          {/* 💡 医院名はこの接続状況ピルに集約（旧ヘッダーバッジ・フォーム見出しバッジ���重複表示を廃止）。「衛生士モード」表記は他モードがある誤解を招くため廃止。担当衛生士名はシートの「担当」に印字されるためモバイルでも表示必須 */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 border ${
                token && clinicName
                  ? "bg-accent-tint border-accent"
                  : "bg-rose-50 border-rose-300"
              }`}
            >
              <Building2
                className={`h-4 w-4 ${token && clinicName ? "text-accent" : "text-rose-600"}`}
              />
              <span
                className={`text-xs font-bold ${token && clinicName ? "text-accent" : "text-rose-700"}`}
              >
                {token
                  ? clinicName
                    ? `接続OK: ${clinicName}${isDemo ? "（デモ）" : ""}`
                    : "トークン未登録"
                  : "医院未設定"}
              </span>
            </div>
            <input
              type="text"
              value={staffName}
              onChange={(e) => {
                setStaffName(e.target.value);
                localStorage.setItem("staff_name", e.target.value);
              }}
              placeholder="担当衛生士名"
              title="シートの「担当」に印字されます"
              className="bg-white border border-line rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink w-24 sm:w-32 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </header>

      {/* 📱 PWA案内バナー（ホーム画面未追加かつ医院接続済みの時だけ表示。印刷・PDFには含まれない） */}
      {!isStandalone && token && (
        <div className="no-print max-w-[1600px] mx-auto px-4 md:px-6 pt-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 shadow-xs">
            📱 <b>この画面のまま「ホーム画面に追加」</b>
            すると、次回からアイコン1タップで医院モードのまま起動できます（iPhone:
            共有ボタン →「ホーム画面に追加」／ Android: メニュー
            →「ホーム画面に追加」）
          </div>
        </div>
      )}

      <div className="app-layout mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[400px_1fr]">
        <section className="no-print space-y-3 h-fit">
          <div className="px-1 pt-1">
            <h2 className="text-xs font-bold tracking-[0.14em] text-ink-soft">
              患者条件の入力
            </h2>
          </div>

          {/* Phase 2: 義歯／クラウン モード切替タブ */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setFormData(INITIAL_FORM_DATA)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center text-sm ${
                formData.mode === "denture"
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              入れ歯
            </button>
            <button
              type="button"
              onClick={() => setFormData(INITIAL_CROWN_FORM_DATA)}
              className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center text-sm ${
                formData.mode === "crown"
                  ? "bg-accent-tint text-accent border-accent font-bold"
                  : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              被せ物（β版）
            </button>
          </div>

          {formData.mode === "denture" ? (
            <DentureForm
              formData={formData}
              handleSelect={handleSelect}
              handleMultiSelect={handleMultiSelect}
            />
          ) : (
            <CrownForm
              formData={formData as CrownFormState}
              handleSelect={handleSelect}
            />
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !(token && clinicName)}
            className="w-full py-4 bg-ink hover:bg-accent text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-base tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <span className="flex items-center gap-2 animate-pulse">
                <Sparkles size={18} /> {LOADING_STEPS[loadingStep]}
              </span>
            ) : (
              <>
                <FileText size={18} /> カウンセリングシート生成
              </>
            )}
          </button>
          {decision.sheetMode === "cautious" && (
            <p className="no-print mt-2 text-xs text-rose-600 font-bold text-center">
              要注意ワードがあるため、慎重モードで生成されます
            </p>
          )}
          {decision.sheetMode === "careful" && (
            <p className="no-print mt-2 text-xs text-rose-600 font-bold text-center">
              痛みのご申告があるため、検査案内モードで生成されます
            </p>
          )}
          {!(token && clinicName) && (
            <p className="no-print mt-2 text-xs text-rose-600 font-bold text-center">
              ⚠️
              医院の接続が確認できないため生成できません（右上の接続状況を確認してください）
            </p>
          )}
          {/* 💡 表示崩れの自救導線：スマホではこの直下にレポートが来るためここに常設。構造異常を検知した時は強調表示に切替 */}
          {resultSuspicious ? (
            <p className="no-print mt-2 text-xs font-bold text-center text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
              ⚠️
              この結果は表示が崩れている可能性があります。「生成」をもう一度押すと改善します
            </p>
          ) : (
            <p className="no-print mt-2 text-[11px] text-ink-soft text-center">
              内容や表示が正しくない場合は、もう一度「生成」を押してください（同じ条件で生成し直されます）
            </p>
          )}
        </section>

        {/* 右カラム：プレビュー */}
        <section
          aria-label="プレビュー領域"
          className="print-area h-full flex flex-col"
        >
          {error &&
            (() => {
              const ce = classifyError(error);
              // 分類不能（既に日本語化済みの案内）は従来表示のまま
              if (ce.kind === "other") {
                return (
                  <div className="no-print mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
                    {ce.headline}
                  </div>
                );
              }
              const at = errorAt
                ? new Date(errorAt).toLocaleString("ja-JP", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div className="no-print mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle size={15} /> {ce.headline}
                  </p>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    {ce.guidance}
                    繰り返し失敗する場合は、この画面のスクリーンショットをサポートへお送りください。
                  </p>
                  <p className="text-[11px] text-rose-400 mt-1.5 font-mono">
                    コード: {ce.code} ／ 種別: {ce.kindLabel}
                    {at ? ` ／ 発生: ${at}` : ""}
                  </p>
                </div>
              );
            })()}

          {result ? (
            <div className="bg-paper p-5 rounded-2xl border border-line flex flex-col h-full">
              <div className="no-print flex justify-between items-center border-b pb-3 mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("patient")}
                    className={`py-2 px-3 sm:px-4 min-h-[44px] justify-center font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === "patient"
                        ? "text-accent border-b-2 border-accent"
                        : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
                    }`}
                  >
                    <FileText size={16} />{" "}
                    <span className="hidden sm:inline">
                      A4提案シート (患者用)
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("talk")}
                    className={`py-2 px-3 sm:px-4 min-h-[44px] justify-center font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === "talk"
                        ? "text-amber-700 border-b-2 border-amber-500"
                        : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
                    }`}
                  >
                    <MessageSquare size={16} />{" "}
                    <span className="hidden sm:inline">
                      トークカンペ (画面専用)
                    </span>
                  </button>
                </div>

                {activeTab === "patient" && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenPrintPdf}
                      disabled={printingPdf}
                      className="py-2 px-4 min-h-[44px] justify-center bg-white border border-line text-ink hover:bg-bg font-bold rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Printer size={16} />{" "}
                      <span className="hidden sm:inline">
                        {printingPdf ? "PDF生成中..." : "A4印刷（PDFで開く）"}
                      </span>
                    </button>
                    {isDemo ? (
                      <span className="py-2 px-3 min-h-[44px] flex items-center text-[11px] font-bold text-ink-soft bg-bg border border-line rounded-lg">
                        デモ版：メール送信は利用できません
                      </span>
                    ) : (
                      <button
                        onClick={handleSendPrint}
                        disabled={sending}
                        className="py-2 px-4 min-h-[44px] justify-center bg-accent hover:bg-ink text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send size={16} />{" "}
                        <span className="hidden sm:inline">
                          {sending ? "送信中..." : "印刷（医院へ送信）"}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* 💡 カンペ表示切替（チェアサイド=要点／学習=全文）。患者タブの印刷ボタンと対称の位置。新フォーマットの生成結果でのみ表示 */}
                {activeTab === "talk" && talkKeywordAvailable && (
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => setTalkView("keyword")}
                      className={`py-2 px-3 min-h-[44px] rounded-lg border text-xs font-bold transition ${talkView === "keyword" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                    >
                      要点
                    </button>
                    <button
                      onClick={() => setTalkView("full")}
                      className={`py-2 px-4 min-h-[44px] rounded-lg border text-xs font-bold transition ${talkView === "full" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                    >
                      全文
                    </button>
                  </div>
                )}
              </div>

              <div
                ref={previewAreaRef}
                className="flex-1 overflow-auto bg-bg p-4 rounded-xl border border-line flex flex-col items-center gap-6"
              >
                {activeTab === "patient" &&
                  (formData.mode === "denture" ? (
                    <DenturePatientSheet />
                  ) : (
                    <CrownPatientSheet />
                  ))}

                {/* トークカンペ（要点⇄全文 切替対応） */}
                {activeTab === "talk" &&
                  (() => {
                    // 💡 マーカー文字列ではなく、パース結果のステップ配列の有無で表示判定（マーカーは API 側で除去済みのため）
                    const parsed = parseTalkKeywords(result.talkScript);
                    if (!parsed || parsed.steps.length === 0) return null;
                    const kwData = talkView === "keyword" ? parsed : null;
                    return (
                      <div className="no-print bg-amber-50/80 p-5 rounded-xl border border-amber-200 w-full max-w-3xl">
                        <div className="bg-amber-100 text-amber-900 p-3 rounded-lg text-xs font-bold flex items-center gap-2 mb-4 border border-amber-300">
                          <AlertTriangle size={16} />{" "}
                          患者様には見せないでください（衛生士専用トークガイド））
                        </div>
                        {kwData ? (
                          <div className="space-y-3">
                            {kwData.preamble && (
                              <div
                                className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                  __html: renderTalkInline(kwData.preamble),
                                }}
                              />
                            )}
                            {kwData.steps.map((step, i) => (
                              <div
                                key={i}
                                className="bg-white rounded-lg border border-amber-200 p-3 shadow-xs"
                              >
                                <h3 className="font-bold text-amber-900 text-sm mb-2">
                                  {step.heading}
                                </h3>
                                {step.keywords.length > 0 ? (
                                  <ul className="space-y-1.5">
                                    {step.keywords.map((kw, j) => (
                                      <li
                                        key={j}
                                        className="text-sm font-bold text-slate-800 flex items-start gap-1.5 leading-snug"
                                      >
                                        <span className="text-amber-500 shrink-0">
                                          ◆
                                        </span>
                                        <span>{kw}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div
                                    className="text-xs leading-relaxed text-slate-700 space-y-4 whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                      __html: renderTalkInline(step.fullText),
                                    }}
                                  />
                                )}
                                {step.kokorogamae && (
                                  <div className="mt-2.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-2.5 leading-relaxed font-medium">
                                    💡 {step.kokorogamae}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : parsed ? (
                          <div className="space-y-3">
                            {parsed.preamble && (
                              <div
                                className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                  __html: renderTalkInline(parsed.preamble),
                                }}
                              />
                            )}
                            {parsed.steps.map((step, i) => (
                              <div
                                key={i}
                                className="bg-white rounded-lg border border-amber-200 p-3.5 shadow-xs"
                              >
                                <h3 className="font-bold text-amber-900 text-sm border-b border-amber-200 pb-1.5 mb-2">
                                  {step.heading}
                                </h3>
                                {step.keywords.length > 0 && (
                                  <div className="text-[11px] text-slate-500 mb-2">
                                    <span className="font-bold text-amber-700">
                                      キーワード：
                                    </span>
                                    {step.keywords.join("／")}
                                  </div>
                                )}
                                {step.kokorogamae && (
                                  <div className="mb-2.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-2.5 leading-relaxed font-medium">
                                    💡 {step.kokorogamae}
                                  </div>
                                )}
                                {step.fullText && (
                                  <div
                                    className="text-[13px] leading-loose text-slate-700 whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                      __html: renderTalkInline(step.fullText),
                                    }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            className="text-xs leading-relaxed text-slate-700 space-y-4 whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: renderTalkInline(result.talkScript),
                            }}
                          />
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>
          ) : (
            <div className="no-print flex-1 flex flex-col items-center justify-center text-ink-soft gap-3 border-2 border-dashed border-line rounded-xl bg-paper p-8">
              <FileText size={48} className="opacity-20 text-slate-600" />
              <p className="text-xs font-medium text-slate-500">
                条件を選択して「カウンセリングシート生成」を押してください
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
