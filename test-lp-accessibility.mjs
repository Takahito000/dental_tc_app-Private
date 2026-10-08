// LPアクセシビリティ改善の検証スクリプト: node test-lp-accessibility.mjs
// - PC(1400px)・モバイル(390px)のスクリーンショット（FV・新設ブロック・発行ログ帯カード・FAQ・APPLY）
// - GA4イベント（click_trial / view_form）の発火確認
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3123";
const OUT = "/tmp/lp-shots-20261008";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

async function shootPage(page, prefix) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/${prefix}-fv.png` });

  const targets = [
    ["features", "選ばれる3つの理由"],
    ["repro-block", "説明の再現性は、医院の資産です。"],
    ["log-card", "発行ログ——いつ、誰が、何を渡したか。"],
    ["faq", "よくあるご質問"],
    ["apply", "まずは4週間、無料でお試しください"],
  ];
  for (const [name, text] of targets) {
    await page.evaluate((t) => {
      const els = [...document.querySelectorAll("h2, h3, p")];
      const el = els.find((e) => e.textContent.includes(t));
      if (el) el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -60);
    }, text);
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: `${OUT}/${prefix}-${name}.png` });
  }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--no-sandbox", "--force-device-scale-factor=1"],
  });

  // ---- PC ----
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await shootPage(page, "pc");

  // GA4イベントの記録（dataLayer経由）
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));
  await page.click('header a[href="#apply"]');
  await new Promise((r) => setTimeout(r, 3500));

  const ga = await page.evaluate(() =>
    (window.dataLayer || [])
      .filter((a) => a && a[0] === "event")
      .map((a) => ({ event: a[1], params: a[2] })),
  );
  console.log("GA4 events:", JSON.stringify(ga));

  // ---- モバイル ----
  const mpage = await browser.newPage();
  await mpage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mpage.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await shootPage(mpage, "mobile");

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
