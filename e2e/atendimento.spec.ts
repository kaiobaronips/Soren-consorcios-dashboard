import { test, expect } from "@playwright/test";
import { loginAsUser, DEMO_USERS } from "./helpers/auth";
import { cleanupE2EData } from "./helpers/cleanup";

/**
 * Cadastro de cliente + novo atendimento, validando os valores do oráculo da
 * planilha (references/consorcio.xlsx) já cobertos nos testes unitários
 * (src/domain/eligibility/oracle.test.ts): disponível 1500 → 23 elegíveis /
 * maior carta R$ 240.000,00; disponível 800 → 6 elegíveis; disponível 500 →
 * estado vazio. Basis padrão da org é "regular" (ver scripts/seed.ts).
 */
test.describe("Atendimento — cadastro de cliente + oráculo", () => {
  test.afterEach(async () => {
    await cleanupE2EData();
  });

  test("(a) João Silva: disponível 1500 em Imóvel → 23 elegíveis, maior carta R$ 240.000,00, plano recomendado", async ({
    page,
  }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] João Silva");
    await page.getByLabel("Valor disponível mensal").fill("1500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();

    await expect(page.getByRole("heading", { name: "[E2E] João Silva" })).toBeVisible();
    await expect(page.getByText("Planos elegíveis", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText(
      "23",
    );
    await expect(page.getByText("R$ 240.000,00").first()).toBeVisible();
    await expect(page.getByText("Plano recomendado")).toBeVisible();
  });

  test("(b) disponível 800 → 6 elegíveis; disponível 500 → estado vazio com dica", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] Carlos Pereira");
    await page.getByLabel("Valor disponível mensal").fill("800.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();

    await expect(page.getByRole("heading", { name: "[E2E] Carlos Pereira" })).toBeVisible();
    await expect(page.getByText("Planos elegíveis", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText(
      "6",
    );

    // Novo atendimento para o mesmo cliente, disponível 500 → nenhum elegível.
    await page.goto("/atendimento");
    await page.getByLabel("Cliente").fill("[E2E] Carlos Pereira");
    const existingClientOption = page.getByRole("button", { name: "[E2E] Carlos Pereira" });
    await expect(existingClientOption).toBeVisible();
    await existingClientOption.click();
    await page.getByLabel("Valor disponível mensal").fill("500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();

    await expect(page.getByText("Nenhum plano cabe no valor informado")).toBeVisible();
    await expect(page.getByText("Menor parcela do catálogo:")).toBeVisible();
  });

  test("(c) selo de atenção aparece quando parcela 1ª–12ª supera o disponível (parcela inicial sempre visível)", async ({
    page,
  }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] Atenção Teste");
    await page.getByLabel("Valor disponível mensal").fill("1500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();

    await expect(page.getByRole("heading", { name: "[E2E] Atenção Teste" })).toBeVisible();
    const attentionCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Atenção: 1ª–12ª acima do disponível" })
      .first();
    await expect(attentionCard).toBeVisible();
    // parcela inicial (1ª–12ª) nunca fica oculta, mesmo no produto com selo de atenção
    await expect(attentionCard.getByText("Parcela 1ª–12ª")).toBeVisible();
    const first12Value = attentionCard.locator("dt", { hasText: "Parcela 1ª–12ª" }).locator("xpath=following-sibling::dd[1]");
    await expect(first12Value).not.toHaveText("—");
  });

  test("(d) renda 2000 + disponível 1500 → alerta de risco de comprometimento (75% > 30%)", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] Risco Teste");
    await page.getByLabel("Renda mensal (opcional)").fill("2000.00");
    await page.getByLabel("Valor disponível mensal").fill("1500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();

    await expect(page.getByRole("heading", { name: "[E2E] Risco Teste" })).toBeVisible();
    await expect(page.getByText(/Comprometimento de 75% da renda/)).toBeVisible();
  });

  test("(e) busca incremental encontra o cliente recém-criado ao digitar o nome", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] Busca Incremental");
    await page.getByLabel("Valor disponível mensal").fill("1500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();
    await expect(page.getByRole("heading", { name: "[E2E] Busca Incremental" })).toBeVisible();

    // novo atendimento: busca incremental deve encontrar o cliente recém-criado
    await page.goto("/atendimento");
    await page.getByLabel("Cliente").fill("[E2E] Busca Incre");
    const option = page.getByRole("button", { name: /\[E2E\] Busca Incremental/ });
    await expect(option).toBeVisible();
    await option.click();

    // ao selecionar, o campo é preenchido e passa a ficar desabilitado (edição bloqueada)
    await expect(page.getByLabel("Cliente")).toHaveValue("[E2E] Busca Incremental");
    await expect(page.getByLabel("Cliente")).toBeDisabled();
  });
});
