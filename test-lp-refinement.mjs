// LP洗練化の検証スクリプト: node test-lp-refinement.mjs
// - PC(1400px)・モバイル(390px)のスクリーンショット（FV・CONCEPT・FLOW・VOICE・PRICE）
// - GA4イベント（click_trial / view_form）の発火確認
// - prefers-reduced-motion でアニメーション無効化の確認
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3000";
const OUT = "/tmp/lp-shots";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const sections = [
  ["fv", "#top"],
  ["concept", null], // CONCEPTセクション（class bg-accent）をセレクタで拾う
  ["flow", null],
  ["voice", null],
  ["price", null],
];

async function shootPage(page, prefix) {
  // FV
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/${prefix}-fv.png` });

  // 各セクションは見出しテキストで位置特定
  const targets = [
    ["concept", "AIは、選択肢を可視化する"],
    ["flow", "導入は、3ステップ"],
    ["voice", "推薦の声"],
    ["price", "料金プラン"],
  ];
  for (const [name, text] of targets) {
    await page.evaluate((t) => {
      const els = [...document.querySelectorAll("h2, p")];
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

  // GA4イベントの記録（dataLayer経由。gtag本体はga4-script.tsxが定義するためスタブは上書きされる）
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await shootPage(page, "pc");

  // click_trial: ヘッダーCTAをクリック
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));
  await page.click('header a[href="#apply"]');
  await new Promise((r) => setTimeout(r, 1500));
  // view_form: #apply が表示されたか（IO threshold 0.3）
  await new Promise((r) => setTimeout(r, 2000));

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

  // ---- prefers-reduced-motion ----
  const rpage = await browser.newPage();
  await rpage.setViewport({ width: 1400, height: 1000 });
  await rpage.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await rpage.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 300)); // 遷移直後（transition中）に測定
  const rm = await rpage.evaluate(() => {
    const els = [...document.querySelectorAll(".fade-in-up")];
    return els.map((el) => {
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, transform: cs.transform, transition: cs.transitionDuration };
    });
  });
  console.log(
    "reduced-motion .fade-in-up styles (sample):",
    JSON.stringify(rm.slice(0, 4)),
    "total:",
    rm.length,
  );
  const rmAllVisible = rm.every((s) => s.opacity === "1" && s.transform === "none");
  console.log("reduced-motion all visible & no transform:", rmAllVisible);

  // 通常時は未表示→表示になること（アニメーション動作の確認）
  const normal = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".fade-in-up")];
    return { total: els.length, visible: els.filter((e) => e.classList.contains("is-visible")).length };
  });
  console.log("normal mode fade-in:", JSON.stringify(normal));

  await browser.close();
  console.log("screenshots saved to", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
