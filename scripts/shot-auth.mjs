// Screenshot autenticado da área interna.
// Uso: node scripts/shot-auth.mjs <caminho> <saida.png> [largura] [altura] [--full] [--wait=ms]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const [path, out, w = "1440", h = "900", ...rest] = process.argv.slice(2);
const full = rest.includes("--full");
const wait = Number((rest.find((a) => a.startsWith("--wait=")) ?? "--wait=800").split("=")[1]);
const creds = readFileSync("data/credenciais-dev.txt", "utf8").split("\n").filter((l) => l.includes("@"))[0].trim().split(/\s+/);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(w) < 600 ? 2 : 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:3000/entrar", { waitUntil: "networkidle" });
await page.fill("#email", creds[0]);
await page.fill("#password", creds[1]);
await Promise.all([page.waitForURL("**/painel**"), page.click("button[type=submit]")]);
await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(wait);
await page.screenshot({ path: out, fullPage: full });
await browser.close();
if (errors.length) console.log("ERROS:\n" + errors.slice(0, 6).join("\n").slice(0, 3000));
console.log("ok", out);
