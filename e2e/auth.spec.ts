import { test, expect } from "@playwright/test";
import { login, loginAsUser, logout, DEMO_USERS } from "./helpers/auth";

test.describe("Autenticação", () => {
  test("rota protegida sem sessão redireciona para /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login com credenciais erradas mostra mensagem de erro", async ({ page }) => {
    await login(page, DEMO_USERS.admin.email, "senha-errada-123");
    await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login admin entra e vê a navegação", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo atendimento", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Produtos", exact: true })).toBeVisible();
  });

  test("logout volta para /login e rota protegida volta a redirecionar", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("consultora ana@ não vê Base de Produtos nem Configurações", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.consultant.email, DEMO_USERS.consultant.password);
    await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Base de Produtos" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações" })).not.toBeVisible();
  });
});
