// render.js <site dir> [shots dir]: every page at 360px with JS off must show real
// content and not scroll sideways. With a shots dir, also saves desktop and mobile
// screenshots for judges.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const site = path.resolve(process.argv[2] || ".");
const shots = process.argv[3];
const pages = fs.readdirSync(site, { recursive: true }).filter((f) => f.endsWith(".html") && !f.includes("node_modules"));

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
  const problems = [];
  for (const page of pages) {
    const url = "file://" + path.join(site, page);
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, javaScriptEnabled: false });
    const tab = await ctx.newPage();
    await tab.goto(url);
    const { overflow, text } = await tab.evaluate(() => ({
      overflow: document.scrollingElement.scrollWidth - window.innerWidth,
      text: document.body.innerText.trim().length,
    }));
    if (overflow > 2) problems.push(`${page}: ${overflow}px horizontal overflow at 360px`);
    if (text < 200) problems.push(`${page}: only ${text} chars of text without JS`);
    if (shots) await tab.screenshot({ path: path.join(shots, page.replace(/\//g, "_") + "-mobile-nojs.png"), fullPage: true });
    await ctx.close();
    if (shots) {
      const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const t2 = await desk.newPage();
      await t2.goto(url);
      await t2.screenshot({ path: path.join(shots, page.replace(/\//g, "_") + "-desktop.png"), fullPage: true });
      await desk.close();
    }
  }
  await browser.close();
  if (problems.length) {
    console.error(problems.join("; "));
    process.exit(1);
  }
  console.log(`render: ${pages.length} pages ok at 360px without JS`);
})();
