// Tira screenshots com o Chromium do Playwright.
// Uso: node scripts/shot.mjs <url> <saida.png> [largura] [altura] [--full] [--wait=ms] [--scroll=px]
import { chromium } from "playwright";

const [url, out, w = "1440", h = "900", ...rest] = process.argv.slice(2);
const full = rest.includes("--full");
const wait = Number((rest.find((a) => a.startsWith("--wait=")) ?? "--wait=600").split("=")[1]);
const scroll = Number((rest.find((a) => a.startsWith("--scroll=")) ?? "--scroll=0").split("=")[1]);
const reduced = rest.includes("--reduced");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: Number(w) < 600 ? 2 : 1,
  reducedMotion: reduced ? "reduce" : "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
if (scroll) {
  await page.evaluate((y) => window.scrollTo(0, y), scroll);
}
await page.waitForTimeout(wait);
await page.screenshot({ path: out, fullPage: full });
await browser.close();
if (errors.length) console.log("ERROS:\n" + errors.join("\n"));
console.log("ok", out);
