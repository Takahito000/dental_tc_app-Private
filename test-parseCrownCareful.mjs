// クラウン版 careful モードのパース確認用スクリプト
const raw = `===PATIENT_SHEET_START===

■ 今のお気持ちへ
痛みや違和感がある中で、素材選びを前に進めたいと思われているかもしれません。

■ まず検査が先である理由
歯科医師による検査で状態を確認しないと、適した素材や治療の順序を決められません。

■ これからの流れ
まず検査を受けていただき、結果をもとに次のステップをご案内します。

■ 素材選びは後回しで大丈夫です
痛みが落ち着いてからでかまいません。

発行日: [[ISSUE_DATE]]
担当: [[STAFF_NAME]]
管理ID: [[PATIENT_ID]]

===PATIENT_SHEET_END===
===TALK_SCRIPT_START===
===TALK_SCRIPT_END===`;

function parsePatientSheet(raw) {
  const lines = raw.trim().split("\n");
  const title =
    lines[0]?.replace(/^#+\s*/, "").trim() ??
    "【客観分析レポート】お口の治療選択肢の比較";
  const issueLine =
    lines.find((l) => l.includes("発行日") || l.includes("管理ID")) ?? "";

  let bodyOnly = raw.replace(/本シートは一般的な情報提供[\s\S]*$/, "");
  bodyOnly = bodyOnly.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, "");
  bodyOnly = bodyOnly.replace(/(?:\n\|[^\n]*\|[^\n]*)+/g, "");
  bodyOnly = bodyOnly.replace(
    /保険の入れ歯は、国の規則で使える素材や製作の工程が定められている、お口の基本的な機能を回復するためのものです。/g,
    "",
  );
  bodyOnly = bodyOnly.replace(
    /※費用は一般的な相場の目安です[\s\S]*?医院にご確認ください。/g,
    "",
  );

  const sectionRegex = /■\s*(.+)\n([\s\S]*?)(?=\n■\s|$)/g;
  const sections = [];
  let m;
  while ((m = sectionRegex.exec(bodyOnly)) !== null) {
    sections.push({ heading: m[1].trim(), body: m[2].trim() });
  }
  return { title, issueLine, sections };
}

const sheet = parsePatientSheet(raw);

console.log("--- issueLine ---");
console.log(sheet.issueLine);

console.log("\n--- sections ---");
sheet.sections.forEach((s) => {
  console.log(`見出し: ${s.heading}`);
  console.log(`本文: ${s.body.slice(0, 60)}...`);
});

// CrownPatientSheet と同じ抽出ロジック
const intro = sheet.sections.find(
  (s) => s.heading.includes("悩み") || s.heading.includes("お気持ち"),
);
const recommend = sheet.sections.find(
  (s) =>
    s.heading.includes("おすすめ") ||
    s.heading.includes("知っておいて") ||
    s.heading.includes("次の一歩") ||
    s.heading.includes("検査") ||
    s.heading.includes("理由"),
);
const prosCons = sheet.sections.find(
  (s) =>
    s.heading.includes("良い点") ||
    s.heading.includes("注意点") ||
    s.heading.includes("次のステップ") ||
    s.heading.includes("流れ") ||
    s.heading.includes("素材選び") ||
    s.heading.includes("後回し"),
);

console.log("\n--- matched ---");
console.log("intro:", intro ? intro.heading : "なし");
console.log("recommend:", recommend ? recommend.heading : "なし");
console.log("prosCons:", prosCons ? prosCons.heading : "なし");

const careSections = sheet.sections.filter(
  (s) =>
    s.heading.includes("お気持ち") ||
    s.heading.includes("検査") ||
    s.heading.includes("理由") ||
    s.heading.includes("流れ") ||
    s.heading.includes("素材選び") ||
    s.heading.includes("後回し"),
);
console.log("\n--- careSections ---");
careSections.forEach((s) => console.log(s.heading));
