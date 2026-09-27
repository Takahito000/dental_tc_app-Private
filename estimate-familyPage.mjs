// 3枚目「ご家族向けページ」のA4収まり見積もり（実定数ベースの静的計算）
// 使い方: node estimate-familyPage.mjs
// モデル: CJK=1.0em・全角記号=1.0em・ASCII=0.55em・半角space=0.3em で折り返し行数を計算

const MM = 96 / 25.4;
const A4_H = 1123;
const PAD = 12 * MM; // 45.35px
const AVAILABLE = A4_H - 90; // PageContentFitter の判定値 1033
const CONTENT_W = 794 - PAD * 2; // 703.3

// ---- 実定数（app/app/page.tsx から転記） ----
const EMPATHY_1 = (values) =>
  `患者さまは、${values}を大切にしたいとお話しくださいました。`;
const EMPATHY_2 =
  "そのお気持ちを、これから先もずっと叶えていくために、知っておいていただきたいことがあります。";
const LEAD =
  "噛めるかどうかの違いは、お口の中だけの問題ではありません。これからの10年・20年を『自立して笑顔で過ごせるか』を分ける、分岐点のお話です。";
const SUB = "このページは、ご本人とご家族で一緒にお読みください";
const H1 = "ご家族の皆さまへ ― 『噛めること』は、人生の質そのものです";

const FUTURE_L = "噛めないまま、放置した場合";
const FUTURE_R = "噛める状態を、取り戻した場合";
const ROWS = {
  meal: ["食卓が「別メニュー」になる", "噛めないと軟らかいものに偏り、筋力・体力が落ちていくため"],
  outing: ["外出が減り、孤立が進む", "口元を気にして人に会わなくなると、社会との接点が減るため"],
  talk: ["無口になり、笑顔が減る", "聞き返されることが増え、話すこと自体を避けるようになるため"],
};
const LIFE_NOTE =
  "日本人は平均して、人生の最後の約9〜12年を支援が必要な状態で過ごしています（厚生労働省・令和4年）。約10年とは、お子さまが小学生から大学生になるまでの長さです。";
const STATS = [
  ["約1.9倍", "歯を失い義歯を使っていない方の認知症発症リスク（厚生労働省研究班・JAGES）"],
  ["約2.4倍", "お口の機能が低下した方が、新たに介護が必要になるリスク（東京大学・柏スタディ）"],
  ["健康寿命の差", "自分の歯が多く保たれている方は、健康寿命が長く、要介護期間が短いことが報告されています（東北大学・2017年）"],
];
const COST_TREAT_LABEL = "今回ご提案している治療（片顎の目安）";
const COST_TREAT_VALUE = "約330,000〜550,000円（片顎・税込）"; // 最長レンジ候補
const COST_CARE_LABEL = "介護にかかる費用の平均総額（月約9万円 × 平均4年7ヶ月 ＋ 一時費用）";
const COST_NOTE =
  "入れ歯の治療で介護が不要になると断言できるものではありません。ただ、噛める状態の維持は『介護が必要になるリスクを減らすこと』と関連すると報告されています。介護が1年早く始まれば、費用は約108万円増え、ご家族の時間・仕事への影響も生まれます。（生命保険文化センター・2024年度）";
const INS_TITLE = "「保険の入れ歯では、だめなのでしょうか」";
const INS_BODY = [
  "保険の入れ歯は、基本的な機能を回復するためのものとして、国の制度に基づき適切に定められたものです。それ自体は正しい選択肢です。",
  "そのうえで私たちが自費の選択肢をお伝えするのは、素材や作り方の違いが「長く快適に使い続けられるか」に関わる場合があり、それがこのページに記した将来の健康リスクと結びつくと考えられるからです。",
  "どちらが正解かを私たちが決めることはありません。保険ではなく自費という選択肢をご提案している理由を、今一度、ご家族でよくお考えいただければ幸いです。",
];
const FT_QUESTION =
  "これからの年月を、『食べて、笑って、話して』過ごすか。それとも、できないことが増えるのを待つか。その分岐点は、いまの選択にあります。";
const FT_GUIDE =
  "治療の選択肢や費用について、ご家族の皆さま同席でのご相談も承ります。無理におすすめすることはありません。まずは選択肢を知るところから、ご一緒に考えましょう。";
const FT_SOURCES =
  "出所： 厚生労働省『健康寿命の令和4年値』／厚生労働科学研究班・JAGES（65歳以上4,442名・4年追跡）".replace("4,442", "4,425") +
  "／東京大学高齢社会総合研究機構・柏スタディ（2,011名追跡、J Gerontol A 2018）／東北大学大学院歯学研究科（15,640名・3年追跡、J Dent Res 2017）／生命保険文化センター『生命保険に関する全国実態調査』2024年度";
const FT_DISCLAIMER =
  "※本資料は一般的な調査データに基づく情報提供です。治療の最終的な方針は、歯科医師とのご相談のうえでお決めください。";

// ---- 幅モデル ----
function isCjk(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x1100 && c <= 0x11ff) ||
    (c >= 0x2e80 && c <= 0x9fff) ||
    (c >= 0xac00 && c <= 0xd7af) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xff00 && c <= 0xffef) ||
    (c >= 0x3000 && c <= 0x303f) ||
    (c >= 0x2018 && c <= 0x201f) || // ‘’“”
    (c >= 0x2014 && c <= 0x2015) || // ――
    c === 0x00b7 || c === 0x2026
  );
}
function textW(s, fs) {
  let w = 0;
  for (const ch of s) {
    if (ch === " ") w += 0.3 * fs;
    else if (isCjk(ch)) w += 1.0 * fs;
    else w += 0.55 * fs;
  }
  return w;
}
const lines = (s, fs, w) => Math.max(1, Math.ceil(textW(s, fs) / w - 1e-6));

// ---- 現在のスタイル値 ----
const S = {
  headerPadV: 9 * MM + 8 * MM, // 64.2
  sub: 10, subLH: 1.4,
  h1: 24, h1LH: 1.4, h1MT: 6,
  lead: 12, leadLH: 1.8, leadMT: 6,
  empathyPadV: 12 * 2, empathy: 16, empathyLH: 1.8, empathyMT: 10,
  secMT: 24, sec7MT: 21, h2: 18, h2LH: 1.25,
  colGap: 8, colPadV: 11 * 2, colHead: 12, colHeadLH: 1.25,
  rowMT: 10, rowTitle: 14, rowTitleLH: 1.25, note: 12, noteLH: 1.6,
  age: 12, ageLH: 1.4, ageMT: 4,
  barH: 30, barMT: 8,
  cardGap: 8, cardPadV: 11 * 2, statNum: 24, statNumLH: 1.3, statNoteMT: 4,
  costLabel: 12, costLabelLH: 1.4, costBarH: 18, costBarMT: 3, costRowMT: 10, costNoteMT: 5,
  insPadV: 11 * 2, insTitle: 16, insTitleLH: 1.3, insBody: 13, insBodyLH: 1.8, insParaMT: 5,
  ftPadV: 6 * MM + 5 * MM, // 41.6
  ftQ: 13, ftQLH: 1.8, ftGuide: 10.5, ftGuideLH: 1.8, ftGuideMT: 5,
  ftSrc: 8.5, ftSrcLH: 1.6, ftSrcMT: 7, ftDiscMT: 3,
};

function compute(st = S) {
  const colW = (CONTENT_W - st.colGap) / 2;
  const colTextW = colW - 12 * 2; // 列パディング左右12px
  const cardW = (CONTENT_W - st.cardGap * 2) / 3;
  const cardTextW = cardW - 12 * 2;
  const insTextW = CONTENT_W - 14 * 2;
  const empathyValues = "『家族と食事』『旅行やおでかけ』";
  const empathyLines =
    lines(EMPATHY_1(empathyValues), st.empathy, CONTENT_W - 14 * 2) +
    lines(EMPATHY_2, st.empathy, CONTENT_W - 14 * 2);

  const h = {};
  h.header =
    st.headerPadV +
    st.sub * st.subLH +
    st.h1MT + st.h1 * st.h1LH +
    st.leadMT + lines(LEAD, st.lead, CONTENT_W) * st.lead * st.leadLH;
  h.empathy = st.empathyMT + st.empathyPadV + empathyLines * st.empathy * st.empathyLH;

  // ③ 各列の高さ（左右同じ行数のため同じ）
  const colInner =
    st.colPadV +
    st.colHead * st.colHeadLH +
    Object.values(ROWS)
      .map(([title, note]) => {
        const t = title + "　"; // アイコン分のガター
        return (
          st.rowMT +
          lines(t, st.rowTitle, colTextW) * st.rowTitle * st.rowTitleLH +
          lines(note, st.note, colTextW) * st.note * st.noteLH
        );
      })
      .reduce((a, b) => a + b, 0);
  h.future = st.secMT + st.h2 * st.h2LH + 10 + colInner;

  h.life =
    st.secMT + st.h2 * st.h2LH +
    st.ageMT + st.age * st.ageLH +
    st.barMT + st.barH +
    4 + lines(LIFE_NOTE, st.note, CONTENT_W) * st.note * st.noteLH;

  const cardH = STATS.map(([val, note]) => {
    const headLines = val === "健康寿命の差" && st.statHeadingSame
      ? lines(val, st.statNum, cardTextW)
      : lines(val, 13.5, cardTextW);
    const headH = val === "健康寿命の差" && st.statHeadingSame
      ? headLines * st.statNum * st.statNumLH
      : headLines * 13.5 * 1.5;
    return st.cardPadV + headH + st.statNoteMT + lines(note, st.note, cardTextW) * st.note * st.noteLH;
  });
  h.stats = st.secMT + Math.max(...cardH);

  h.cost =
    st.secMT + st.h2 * st.h2LH + 10 +
    st.costLabel * st.costLabelLH + st.costBarMT + st.costBarH +
    st.costRowMT + st.costLabel * st.costLabelLH + st.costBarMT + st.costBarH +
    st.costNoteMT + lines(COST_NOTE, st.note, CONTENT_W) * st.note * st.noteLH;

  h.ins =
    st.sec7MT + st.insPadV + st.insTitle * st.insTitleLH +
    INS_BODY.reduce((a, p) => a + st.insParaMT + lines(p, st.insBody, insTextW) * st.insBody * st.insBodyLH, 0);

  h.footer =
    st.ftPadV +
    lines(FT_QUESTION, st.ftQ, CONTENT_W) * st.ftQ * st.ftQLH +
    st.ftGuideMT + lines(FT_GUIDE, st.ftGuide, CONTENT_W) * st.ftGuide * st.ftGuideLH +
    st.ftSrcMT + lines(FT_SOURCES, st.ftSrc, CONTENT_W) * st.ftSrc * st.ftSrcLH +
    st.ftDiscMT + lines(FT_DISCLAIMER, st.ftSrc, CONTENT_W) * st.ftSrc * st.ftSrcLH;

  h.total = Object.values(h).reduce((a, b) => a + b, 0);
  return h;
}

const cur = compute();
console.log("=== 現在（ユーザー指定サイズ済み・健康寿命の差=13.5px） ===");
for (const [k, v] of Object.entries(cur)) console.log(`  ${k}: ${v.toFixed(0)}px`);
console.log(`  合計: ${cur.total.toFixed(0)}px / 利用可能 ${AVAILABLE}px → 超過 ${(cur.total - AVAILABLE).toFixed(0)}px, zoom=${Math.max(0.7, AVAILABLE / cur.total).toFixed(3)}`);

const fixed = compute({ ...S, statHeadingSame: true });
console.log("\n=== 健康寿命の差を24px化した場合 ===");
console.log(`  合計: ${fixed.total.toFixed(0)}px → 超過 ${(fixed.total - AVAILABLE).toFixed(0)}px, zoom=${Math.max(0.7, AVAILABLE / fixed.total).toFixed(3)}`);

// 収まるチューニング案: 行間・パディングを詰め、セクション余白は維持
const tuned = compute({
  ...S,
  statHeadingSame: true,
  headerPadV: 7 * MM + 6 * MM,
  leadLH: 1.6,
  empathyPadV: 10 * 2, empathyLH: 1.65,
  colPadV: 9 * 2, rowMT: 7,
  barH: 26,
  cardPadV: 9 * 2,
  insPadV: 9 * 2, insBodyLH: 1.65, insParaMT: 3,
  ftPadV: 4.5 * MM + 4 * MM, ftQLH: 1.65, ftGuideLH: 1.65,
  noteLH: 1.5,
});
console.log("\n=== チューニング案（行間1.5〜1.65・帯パディング縮小・セクション余白は維持） ===");
for (const [k, v] of Object.entries(tuned)) console.log(`  ${k}: ${v.toFixed(0)}px`);
console.log(`  合計: ${tuned.total.toFixed(0)}px / ${AVAILABLE}px → ${tuned.total <= AVAILABLE ? "収まる ✓" : `超過 ${(tuned.total - AVAILABLE).toFixed(0)}px ✗`}`);

// A案: zoomなし100%表示に必要なサイズ（主要項目は指定値より1〜2pt下げ）
const fitA = compute({
  ...S,
  statHeadingSame: true,
  headerPadV: 5.5 * MM + 4.5 * MM,
  sub: 9, subLH: 1.3,
  h1: 19, h1LH: 1.3,
  lead: 10, leadLH: 1.55,
  empathyPadV: 9 * 2, empathy: 13, empathyLH: 1.6,
  secMT: 18, sec7MT: 16, h2: 13.5, h2LH: 1.2,
  colPadV: 9 * 2, colHead: 11, colHeadLH: 1.2,
  rowMT: 7, rowTitle: 12, rowTitleLH: 1.2, note: 10, noteLH: 1.45,
  age: 11, ageLH: 1.35, ageMT: 3,
  barH: 22, barMT: 6,
  cardPadV: 9 * 2, statNum: 19, statNumLH: 1.2, statNoteMT: 3,
  costLabel: 11, costLabelLH: 1.3, costBarH: 14, costBarMT: 2, costRowMT: 7, costNoteMT: 3,
  insPadV: 9 * 2, insTitle: 13.5, insTitleLH: 1.2, insBody: 11, insBodyLH: 1.6, insParaMT: 3,
  ftPadV: 4 * MM + 3.5 * MM,
  ftQ: 11, ftQLH: 1.55, ftGuide: 9.5, ftGuideLH: 1.55, ftGuideMT: 4,
  ftSrc: 8, ftSrcLH: 1.5, ftSrcMT: 4, ftDiscMT: 2,
});
console.log("\n=== A案: 100%表示（ズームなし）に収めるサイズ案 ===");
for (const [k, v] of Object.entries(fitA)) console.log(`  ${k}: ${v.toFixed(0)}px`);
console.log(`  合計: ${fitA.total.toFixed(0)}px / ${AVAILABLE}px → ${fitA.total <= AVAILABLE ? "収まる ✓" : `超過 ${(fitA.total - AVAILABLE).toFixed(0)}px ✗`}`);

// B案: ⑦〜フッター間の隙間をゼロにするため、わずかに超過させる（zoom 0.97〜0.99 で目に見えず、auto余白は保証0）
const fitB = compute({
  ...S,
  statHeadingSame: true,
  headerPadV: 5.5 * MM + 4.5 * MM,
  sub: 9, subLH: 1.3,
  h1: 19, h1LH: 1.3,
  lead: 10, leadLH: 1.55,
  empathyPadV: 9 * 2, empathy: 14, empathyLH: 1.6,
  secMT: 20, sec7MT: 18, h2: 13.5, h2LH: 1.2,
  colPadV: 9 * 2, colHead: 11, colHeadLH: 1.2,
  rowMT: 8, rowTitle: 12, rowTitleLH: 1.2, note: 10.5, noteLH: 1.5,
  age: 11, ageLH: 1.35, ageMT: 3,
  barH: 22, barMT: 6,
  cardPadV: 9 * 2, statNum: 19, statNumLH: 1.2, statNoteMT: 3,
  costLabel: 11, costLabelLH: 1.3, costBarH: 14, costBarMT: 2, costRowMT: 7, costNoteMT: 3,
  insPadV: 9 * 2, insTitle: 13.5, insTitleLH: 1.2, insBody: 11, insBodyLH: 1.6, insParaMT: 3,
  ftPadV: 4 * MM + 3.5 * MM,
  ftQ: 11, ftQLH: 1.55, ftGuide: 9.5, ftGuideLH: 1.55, ftGuideMT: 4,
  ftSrc: 8, ftSrcLH: 1.5, ftSrcMT: 4, ftDiscMT: 2,
});
console.log("\n=== B案: ⑦〜フッター間をゼロに（わずか超過で隙間保証0） ===");
for (const [k, v] of Object.entries(fitB)) console.log(`  ${k}: ${v.toFixed(0)}px`);
console.log(`  合計: ${fitB.total.toFixed(0)}px / ${AVAILABLE}px → zoom=${(AVAILABLE / fitB.total).toFixed(3)}`);
