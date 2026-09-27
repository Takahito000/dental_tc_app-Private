// 3枚目家族向けページの実測（sessionStorage復元で描画）: node measure-familyPage.mjs
import puppeteer from "puppeteer-core";

const patientSheet = [
  "■今のお悩みと目指す暮らし",
  "入れ歯が合わず、食事の時間がつらいとお話しでした。家族と一緒に食卓を囲みたいというお気持ちが大切です。",
  "■あなたへのおすすめ",
  "現状に合わせた入れ歯の作り替えをご提案します。",
  "■それぞれの良い点・注意点",
  "保険は費用を抑えられます。自費は快適性に特徴があります。",
  "■費用の考え方",
  "第一候補の目安をご案内します。",
  "■ご家族向けのまとめ",
  "ご家族と一緒にご検討ください。",
].join("\n");

const talkScript = [
  "■ ステップ1: オープニング",
  "【キーワード】あいさつ／信頼関係",
  "【心構え】",
  "【全文】本日はよろしくお願いします。",
  "■ ステップ2: 次の一歩",
  "【キーワード】持ち帰り／相談",
  "【全文】持ち帰ってご家族とご相談ください。",
].join("\n");

const formData = {
  mode: "denture",
  denture_status: "使っている",
  remaining_teeth: "ほとんど無い",
  target_jaw: "上顎",
  defect_site: "該当なし（総義歯）",
  current_denture_complaints: ["痛い"],
  denture_duration: "1〜5年",
  adjustment_history: "調整しても改善しない",
  oral_dryness: "普通",
  ridge_mucosa: "しっかり",
  emotion_drivers: ["家族と食事", "旅行やおでかけ"],
  expectation_type: "快適なら満足",
  cost_sensitivity: "価値が高ければ許容",
  red_flag_words: ["特になし"],
  target_site: "前歯（1〜3番）",
  visibility: "よく見える",
  chief_priority: "見た目の自然さ",
  metal_allergy: "特になし",
  bruxism: "特になし",
  has_pain: "特になし",
  free_memo: "",
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--no-sandbox", "--force-device-scale-factor=1"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.evaluateOnNewDocument((payload) => {
    localStorage.setItem("clinic_access_token", "measure-token");
    sessionStorage.setItem("denpist-ai-generated-result", JSON.stringify(payload));
    localStorage.setItem("include_family_page", "1");
  }, {
    patientSheet,
    talkScript,
    patientAnonId: "TEST-000",
    issueDate: "2026-09-17",
    formData,
  });

  await page.goto("http://localhost:3000/app", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(".family-page-last", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500)); // fitter計測待ち

  // 年代を70代に
  await page.evaluate(() => {
    const age = [...document.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.text === "70代"),
    );
    if (age) {
      age.selectedIndex = [...age.options].findIndex((o) => o.text === "70代");
      age.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  const m = await page.evaluate(() => {
    const pageEl = document.querySelector(".family-page-last .sheet-page-portrait");
    const fitter = pageEl.querySelector("[data-page-content-fitter]");
    const zoom = getComputedStyle(fitter).zoom;
    const pr = pageEl.getBoundingClientRect();
    const scale = pr.width / 794;
    const blocks = [...fitter.children].map((c) => ({
      h: c.getBoundingClientRect().height / scale,
      top: (c.getBoundingClientRect().top - pr.top) / scale,
      secs: [...c.children].map((s) => ({
        h: Math.round(s.getBoundingClientRect().height / scale),
        top: Math.round((s.getBoundingClientRect().top - pr.top) / scale),
        text: (s.textContent || "").trim().slice(0, 16),
      })),
    }));
    return { zoom, fitterScrollH: fitter.scrollHeight, blocks, pageH: pr.height / scale, scale };
  });
  console.log(JSON.stringify(m, null, 2));

  const el = await page.$(".family-page-last");
  await el.screenshot({ path: "/tmp/family-page.png" });
  console.log("screenshot: /tmp/family-page.png");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
