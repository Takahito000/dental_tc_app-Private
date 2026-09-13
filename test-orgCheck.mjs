// 自費提案 組織力チェック（/check）の判定ロジック検証：
// app/check/org-check-logic.ts を直接 import してテストする
// 対応: 指示書 §10 の T1〜T5（T6/T9 は devサーバ＋headless Chrome、T7/T8 は grep＋curl で別途確認）
import {
  QUESTIONS,
  E1_QUESTION,
  UNKNOWN_LABEL,
  QUESTION_PREAMBLE,
  judgeAxis,
  computeResult,
  TYPE_CONTENTS,
  E1_TRIALS,
  feeBarWidthPct,
  partialAxisLine,
} from "./app/check/org-check-logic.ts";

let pass = 0;
let fail = 0;
const results = [];
const check = (name, cond) => {
  if (cond) {
    pass++;
    results.push(`  PASS  ${name}`);
  } else {
    fail++;
    results.push(`  FAIL  ${name}`);
  }
};

// ---------- 基本構造 ----------
check("設問は8問（Q1〜Q8）", QUESTIONS.length === 8);
check("Q1〜Q4が軸1、Q5〜Q8が軸2", QUESTIONS.slice(0, 4).every((q) => q.axis === 1) && QUESTIONS.slice(4).every((q) => q.axis === 2));
check("Q1のスコアが 0/0/2（1点選択肢なし）", JSON.stringify(QUESTIONS[0].options.map((o) => o.score)) === "[0,0,2]");
check("Q2〜Q8は 0/1/2 の3段階", QUESTIONS.slice(1).every((q) => JSON.stringify(q.options.map((o) => o.score)) === "[0,1,2]"));
check("全設問に第4選択肢用の UNKNOWN_LABEL が定義", UNKNOWN_LABEL === "分からない／この場面がない");
check("固定接頭辞が定義済み", QUESTION_PREAMBLE === "直近1ヶ月の貴院の様子を思い浮かべてお答えください");
check("E1は3選択肢＋分からない（計4）", E1_QUESTION.options.length === 4 && E1_QUESTION.options[3].code === null);
check("E1の新設問文（保険と自費の選択肢・相談件数）", E1_QUESTION.text === "入れ歯や被せ物（クラウン）など、保険と自費の選択肢があり得る症例の相談は、月に何件程度ありますか？");
check("E1に補足文が定義済み", E1_QUESTION.note.includes("提案できた可能性のある場面"));

// ---------- T2: 境界値（4問有効・満点8 → 5点以上で右側） ----------
check("T2: 4点 → 左側（60%未満）", judgeAxis([2, 2, 0, 0]).kind === "left");
check("T2: 5点 → 右側（60%以上）", judgeAxis([2, 2, 1, 0]).kind === "right");
check("T2: 8点 → 右側", judgeAxis([2, 2, 2, 2]).kind === "right");
check("T2: 0点 → 左側", judgeAxis([0, 0, 0, 0]).kind === "left");

// ---------- T3: 除外1問（満点6 → 4点以上で右側） ----------
check("T3: 除外1問・3点 → 左側", judgeAxis([2, 1, null, 0]).kind === "left");
check("T3: 除外1問・4点 → 右側（満点6の60%=3.6→ceil 4）", judgeAxis([2, 2, null, 0]).kind === "right");

// ---------- T4: 除外2問以上 → 判定保留 ----------
check("T4: 除外2問 → pending", judgeAxis([2, 2, null, null]).kind === "pending");
check("T4: 除外3問 → pending", judgeAxis([2, null, null, null]).kind === "pending");
check("T4: 除外4問 → pending", judgeAxis([null, null, null, null]).kind === "pending");

// ---------- T1: 4タイプの合成 ----------
const A1L = { kind: "left", score: 0, max: 8 };
const A1R = { kind: "right", score: 8, max: 8 };
const A2L = { kind: "left", score: 0, max: 8 };
const A2R = { kind: "right", score: 8, max: 8 };
const P = { kind: "pending" };
check("T1: 属人×遠慮 → ①院長抱え込み型", computeResult(A1L, A2L).kind === "type" && computeResult(A1L, A2L).type === 1);
check("T1: 属人×親切 → ②スター依存型", computeResult(A1L, A2R).type === 2);
check("T1: 仕組み×遠慮 → ③型あって空転型", computeResult(A1R, A2L).type === 3);
check("T1: 仕組み×親切 → ④自走型", computeResult(A1R, A2R).type === 4);
check("T1: 4タイプすべてのコンテンツが定義済み", [1, 2, 3, 4].every((t) => TYPE_CONTENTS[t].name && TYPE_CONTENTS[t].scene && TYPE_CONTENTS[t].structure && TYPE_CONTENTS[t].actions.length >= 2));

// ---------- T4: 部分判定（タイプ名を出さない） ----------
const partial1 = computeResult(A1R, P);
check("T4: 軸1のみ判定可能 → partial（タイプ名なし）", partial1.kind === "partial");
check("T4: partialの表示文（判定可能側）", partialAxisLine(1, A1R) === "仕組み化度のみ判定可能： 仕組み傾向");
check("T4: partialの表示文（保留側）", partialAxisLine(2, P) === "心理抵抗： 観察情報が不足しているため判定保留");
const partial2 = computeResult(P, A2L);
check("T4: 軸2のみ判定可能 → partial", partial2.kind === "partial" && partialAxisLine(2, A2L) === "心理抵抗のみ判定可能： 遠慮傾向");
check("T4: 両軸pending → partial", computeResult(P, P).kind === "partial");

// ---------- T5: E1の3段階 ----------
check("T5: E1=0〜2件 → 年間換算非表示", E1_TRIALS["0"].showYearly === false);
check("T5: E1=0〜2件 → メッセージ（6〜10万円）", E1_TRIALS["0"].message.includes("約6〜10万円"));
check("T5: E1=0〜2件 → バーラベル（円・カンマ・最大表記）", E1_TRIALS["0"].gainLabel === "最大 60,000〜100,000円/月（推定）");
check("T5: E1=3〜5件 → バーラベル（円・カンマ区切り）", E1_TRIALS["1"].gainLabel === "120,000〜200,000円/月（推定）");
check("T5: E1=6件以上 → バーラベル（円・カンマ区切り）", E1_TRIALS["2"].gainLabel === "120,000〜400,000円/月（推定）");
check("T5: バーラベルに万円表記が残っていない", Object.values(E1_TRIALS).every((t) => !t.gainLabel.includes("万円")));
check("T5: E1=3〜5件 → 年間換算表示", E1_TRIALS["1"].showYearly === true);
check("T5: E1=3〜5件 → メッセージ（12〜20万円・回収計算）", E1_TRIALS["1"].message.includes("約12〜20万円/月") && E1_TRIALS["1"].message.includes("0.2〜0.3件"));
check("T5: E1=6件以上 → 年間換算表示", E1_TRIALS["2"].showYearly === true);
check("T5: E1=6件以上 → メッセージ（12〜40万円）", E1_TRIALS["2"].message.includes("約12〜40万円/月"));
check("T5: 月額費用バーの幅（E1=0→40%）", feeBarWidthPct(E1_TRIALS["0"]) === 40);
check("T5: 月額費用バーの幅（E1=1→20%）", feeBarWidthPct(E1_TRIALS["1"]) === 20);
check("T5: 月額費用バーの幅（E1=2→10%）", feeBarWidthPct(E1_TRIALS["2"]) === 10);

// ---------- 定型文の完全性（指示書 §5 どおり・変更禁止） ----------
check("④のみ「現状の運用維持が最適解です…」の文言", TYPE_CONTENTS[4].effectiveness === "現状の運用維持が最適解です。デンピストAIの導入効果は微増と正直にお伝えします" && [1, 2, 3].every((t) => !TYPE_CONTENTS[t].effectiveness.includes("微増と正直")));
check("打ち手①は3件・②は3件・③は3件・④は2件", TYPE_CONTENTS[1].actions.length === 3 && TYPE_CONTENTS[2].actions.length === 3 && TYPE_CONTENTS[3].actions.length === 3 && TYPE_CONTENTS[4].actions.length === 2);
check("課題①〜③は3箇条・④は2箇条", TYPE_CONTENTS[1].issues.length === 3 && TYPE_CONTENTS[2].issues.length === 3 && TYPE_CONTENTS[3].issues.length === 3 && TYPE_CONTENTS[4].issues.length === 2);
check("課題と対応の件数・番号対応が崩れていない", [1, 2, 3, 4].every((t) => TYPE_CONTENTS[t].issues.length === TYPE_CONTENTS[t].actions.length));
check("打ち手が新文言に差し替わり済み（ツール言及・書き起こし不要）", TYPE_CONTENTS[1].actions[0].body.includes("デンピストAIが生成するスタッフ向けカンペ") && TYPE_CONTENTS[2].actions[0].lead.includes("書き起こしは不要") && TYPE_CONTENTS[3].actions[0].lead.includes("道具ではなく心理を扱う") && TYPE_CONTENTS[4].actions[1].body.includes("属人化の保険"));
check("セクション4（橋渡し）がタイプ別に定義", TYPE_CONTENTS[1].bridge.heading === "課題の根っこは、ひとつです" && TYPE_CONTENTS[2].bridge.heading === "課題の根っこは、「見えない型」です" && TYPE_CONTENTS[3].bridge.heading === "課題の根っこは、道具ではなく心理です" && TYPE_CONTENTS[4].bridge.heading === "貴院に、私たちから勧めるものはありません");
check("セクション4のCTA: ①〜③あり・④のみなし", TYPE_CONTENTS[1].bridge.cta !== null && TYPE_CONTENTS[2].bridge.cta !== null && TYPE_CONTENTS[3].bridge.cta !== null && TYPE_CONTENTS[4].bridge.cta === null);

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
