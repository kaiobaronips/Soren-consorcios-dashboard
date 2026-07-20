import { chromium, type FullConfig } from "@playwright/test";
import { DEMO_USERS } from "./helpers/auth";

/**
 * Aquece o dev server antes da suíte: o Next (App Router) compila cada rota sob
 * demanda na primeira visita, o que pode levar vários segundos e estourar o
 * timeout do primeiro teste. Fazemos um login completo (compila /login, a server
 * action de auth e a home "/") para que os testes já encontrem as rotas prontas.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ baseURL });
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByLabel("E-mail").fill(DEMO_USERS.admin.email);
    await page.getByLabel("Senha").fill(DEMO_USERS.admin.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("/", { timeout: 60_000 });
    // Visita as rotas principais para compilá-las antecipadamente.
    for (const path of ["/atendimento", "/produtos", "/clientes"]) {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }
  } finally {
    await browser.close();
  }
}
