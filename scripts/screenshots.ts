import { chromium, type Page } from "@playwright/test";
import fs from "node:fs/promises";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = "screenshots";

const CREDENTIALS = {
  email: "admin@demo.soren.com.br",
  password: "demo12345",
};

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(CREDENTIALS.email);
  await page.getByLabel("Senha").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${BASE_URL}/`);
}

async function screenshot(page: Page, name: string, fullPage = true) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage });
  console.log(`✓ ${path}`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "01-login");

  // 2. Home
  await login(page);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "02-home");

  // 3. Atendimento (formulário vazio)
  await page.goto(`${BASE_URL}/atendimento`);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "03-atendimento-empty");

  // 4. Atendimento com resultados
  await page.getByLabel("Cliente").fill("Cliente Screenshot");
  await page.getByLabel("Valor disponível mensal").fill("2500.00");
  await page.getByLabel("Categoria").selectOption("property");
  await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();
  await page.waitForSelector('[data-slot="card"]', { timeout: 10000 });
  await page.waitForTimeout(500);
  await screenshot(page, "04-atendimento-results");

  // 5. Simulador com chart
  const recommendedCard = page.locator('[data-slot="card"]').filter({ hasText: "Plano recomendado" }).first();
  await recommendedCard.getByRole("button", { name: "Simular" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  // aguarda renderização do Recharts
  await dialog.locator(".recharts-wrapper").first().waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(1200);
  await screenshot(page, "05-simulador-chart", false);

  // 6. Produtos
  await dialog.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5000 });
  await page.goto(`${BASE_URL}/produtos`);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "06-produtos");

  // 7. Clientes
  await page.goto(`${BASE_URL}/clientes`);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "07-clientes");

  // 8. Base de produtos
  await page.goto(`${BASE_URL}/base-produtos`);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "08-base-produtos");

  // 9. Configurações
  await page.goto(`${BASE_URL}/configuracoes`);
  await page.waitForLoadState("networkidle");
  await screenshot(page, "09-configuracoes");

  // 10. Tema escuro home
  await page.goto(`${BASE_URL}/`);
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.waitForTimeout(600);
  await screenshot(page, "10-home-dark");

  await browser.close();
  console.log("\nScreenshots finalizados em ./screenshots");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
