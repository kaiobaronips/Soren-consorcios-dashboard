import { expect, type Page } from "@playwright/test";

/**
 * Preenche o formulário de login em /login e submete.
 * Não espera pelo resultado — chame `expect` no teste para validar
 * sucesso (URL "/") ou erro (mensagem na tela).
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/**
 * Faz login e espera o redirecionamento para "/" (sucesso).
 */
export async function loginAsUser(page: Page, email: string, password: string) {
  await login(page, email, password);
  await expect(page).toHaveURL("/");
}

/**
 * Aciona "Sair" e espera o redirecionamento para /login.
 * Usa foco + Enter em vez de click(): o overlay de dev tools do Next.js
 * (nextjs-portal, fixo no canto da viewport) intercepta cliques de ponteiro
 * nesse botão em modo dev, mesmo com click({ force: true }).
 */
export async function logout(page: Page) {
  const button = page.getByRole("button", { name: "Sair" });
  await button.focus();
  await button.press("Enter");
  await expect(page).toHaveURL(/\/login$/);
}

export const DEMO_USERS = {
  admin: { email: "admin@demo.soren.com.br", password: "demo12345" },
  consultant: { email: "ana@demo.soren.com.br", password: "demo12345" },
} as const;
