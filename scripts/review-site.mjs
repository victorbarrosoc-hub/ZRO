// Revisão visual do site público: páginas × larguras, com menos movimento (conteúdo estático).
// Uso: node scripts/review-site.mjs <pasta-saida> [largura,...]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2];
const widths = (process.argv[3] ?? "390,1920").split(",").map(Number);
const pages = ["/", "/filmes", "/filmes/manifesto", "/sobre", "/absolute", "/orcamento", "/privacidade"];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const report = [];
for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w < 600 ? 844 : 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  for (const p of pages) {
    await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = (p === "/" ? "home" : p.slice(1).replace(/\//g, "-")) + `-${w}`;
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    report.push(`${name}: overflow-x=${overflow}px`);
  }
  if (errors.length) report.push(`erros em ${w}px: ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}
await browser.close();
console.log(report.join("\n"));
