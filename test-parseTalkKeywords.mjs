// トークガイドパース条件の確認用スクリプト
const rawWithKeywords = `
■ ステップ1／オープニング
【キーワード】笑顔／挨拶／信頼
【心構え】患者様のペースに合わせて話しかける
【全文】こんにちは。本日はよろしくお願いします。

■ ステップ2／現状確認
【キーワード】悩み／生活／希望
【心構え】聞く姿勢を大切にする
【全文】どのようなことでお悩みですか？
`;

const rawWithoutKeywords = `
■ ステップ1／オープニング
患者様のペースに合わせて話しかけましょう。
`;

function parseTalkKeywords(raw) {
  if (!raw.includes("【キーワード】")) return null;
  const lines = raw.split("\n");
  const steps = [];
  const preambleLines = [];
  let current = null;
  const finishStep = (s) => ({
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
    } else {
      preambleLines.push(line);
    }
  }
  if (current) steps.push(finishStep(current));
  return { preamble: preambleLines.join("\n").trim(), steps };
}

function shouldShow(raw) {
  const parsed = parseTalkKeywords(raw);
  return parsed && parsed.steps.length > 0;
}

console.log("withKeywords:", shouldShow(rawWithKeywords));
console.log("withoutKeywords:", shouldShow(rawWithoutKeywords));
