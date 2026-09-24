// Abre um navegador já logado na área interna (para testes e screenshots).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

export async function openLogged({ width = 1440, height = 900 } = {}) {
  const creds = readFileSync("data/credenciais-dev.txt", "utf8").split("\n").filter((l) => l.includes("@"))[0].trim().split(/\s+/);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:3000/entrar", { waitUntil: "networkidle" });
  await page.fill("#email", creds[0]);
  await page.fill("#password", creds[1]);
  await Promise.all([page.waitForURL("**/painel**"), page.click("button[type=submit]")]);
  return { browser, page, errors };
}
