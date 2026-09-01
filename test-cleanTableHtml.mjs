// test-cleanTableHtml.mjs — cleanTableHtml の単体テスト（2026-08-27 design-refresh-A）
// 使い方: node test-cleanTableHtml.mjs app/page.tsx
// page.tsx から TABLE_COL_WIDTHS と cleanTableHtml を抽出して実際のコードを検証する
import { readFileSync } from "fs";

const path = process.argv[2] || "app/page.tsx";
const src = readFileSync(path, "utf8");
const start = src.indexOf("const TABLE_COL_WIDTHS");
const endMarker = "const cleanTableHtml";
const fnStart = src.indexOf(endMarker);
// 関数の終端は "return cleaned;\n};" （cleanTableHtml 固有）
const fnEnd = src.indexOf("return cleaned;", fnStart);
if (start < 0 || fnStart < 0 || fnEnd < 0) {
  console.error("FAIL: 関数の抽出に失敗（マーカーが見つからない）");
  process.exit(1);
}
let code = src.slice(start, fnEnd)
code = code.replace('(html: string)', '(html)') + 'return cleaned;\n};\nreturn { cleanTableHtml };';
const { cleanTableHtml } = new Function(code)();

let failed = 0;
const check = (label, cond) => {
  console.log((cond ? "PASS" : "FAIL") + " " + label);
  if (!cond) failed++;
};

// モデル出力を模した入力（thead なし・2行目以降にも th・属性汚染・col 幅汚染あり）
const messy =
  '<table border="1" style="width:100%"><colgroup><col style="width:30%"><col style="width:35%"><col style="width:35%"></colgroup>' +
  "<tr><th>比較項目</th><th>保険の入れ歯（総義歯）</th><th>第一候補：金属床義歯（総義歯）</th></tr>" +
  "<tr><th>主な目的</th><td>A</td><td>B</td></tr>" +
  '<tr><td bgcolor="#eee">費用（目安）</td><td>C</td><td>D</td></tr></table>';

const out = cleanTableHtml(messy);

check("table に cmp-table が付与される", out.includes('<table class="cmp-table">'));
check("colgroup が 18%/37%/45% で再挿入される",
  out.includes("width: 18%") && out.includes("width: 37%") && out.includes("width: 45%"));
check("元の colgroup/col/属性汚染が除去される",
  !out.includes('width:30%') && !out.includes("bgcolor") && !out.includes('border="1"'));
check("先頭行に th が3つ残る", (out.match(/<th/g) || []).length === 3);
check("2行目以降の th が td に矯正される（行見出しの全列紺色化防止）",
  (out.match(/<th/g) || []).length === 3 && out.includes("<td>主な目的</td>"));
check("「第一候補：」がバッジ化される",
  out.includes('<span class="badge-rec">第一候補</span><br/>'));
check("旧デザインの class（紺ベタ）が付与されない", !out.includes("bg-slate-900"));
check("thead が誤破壊されない（先読みガード）", !out.match(/<t[d]ead/i));

// バッジ化がデータ行の「第一候補：」に誤爆しないこと
const tricky =
  "<table><tr><th>項目</th><th>A</th><th>B</th></tr>" +
  "<tr><td>備考</td><td>第一候補：ではなく第2候補</td><td>x</td></tr></table>";
const out2 = cleanTableHtml(tricky);
check("データ行中の「第一候補：」はバッジ化しない",
  !out2.includes('<td>第一候補：<span') && (out2.match(/badge-rec/g) || []).length === 0);

// バッジが無い通常ヘッダでも壊れないこと
const plain = "<table><tr><th>項目</th><th>A</th><th>B</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>";
const out3 = cleanTableHtml(plain);
check("バッジ対象なしの表でも正常に出力される",
  out3.includes('<table class="cmp-table">') && out3.includes("<td>a</td>"));

if (failed > 0) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log("\n全テスト合格");
