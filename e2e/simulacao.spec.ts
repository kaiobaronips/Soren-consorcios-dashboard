import { test, expect } from "@playwright/test";
import { loginAsUser, DEMO_USERS } from "./helpers/auth";
import { cleanupE2EData } from "./helpers/cleanup";

/**
 * E2E do simulador financeiro: a partir de um atendimento (cliente [E2E], disponível 1500,
 * Imóvel), abre o painel de simulação do plano recomendado (botão "Simular"), valida o
 * bloco de premissas, o slider de tempo, a troca de cenário, o salvamento e o resumo
 * imprimível (com comparação com CDI). Um teste separado cobre a restrição de taxa
 * personalizada para consultores.
 */
test.describe("Simulador financeiro", () => {
  test.afterEach(async () => {
    await cleanupE2EData();
  });

  test("(a)-(e) simular, mover slider, trocar cenário, salvar e ver resumo com CDI", async ({ page }) => {
    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] Simulação Cliente");
    await page.getByLabel("Valor disponível mensal").fill("1500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();
    await expect(page.getByRole("heading", { name: "[E2E] Simulação Cliente" })).toBeVisible();

    const recommendedCard = page.locator('[data-slot="card"]').filter({ hasText: "Plano recomendado" }).first();
    await expect(recommendedCard).toBeVisible();

    // (a) abrir o painel de simulação: bloco de premissas mostra índice, taxa, origem e aviso de estimativa.
    await recommendedCard.getByRole("button", { name: "Simular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("dt", { hasText: "Índice" })).toBeVisible();
    await expect(dialog.locator("dt", { hasText: "Taxa anual" })).toBeVisible();
    await expect(dialog.locator("dt", { hasText: "Origem" })).toBeVisible();
    await expect(dialog.getByText("Estimativa — não é garantia de resultado.")).toBeVisible();

    // (b) mover o slider de tempo altera os valores exibidos — capturar antes/depois.
    const projectedCreditValue = dialog
      .getByText("Carta corrigida", { exact: true })
      .locator("xpath=following-sibling::p[1]");
    const before = await projectedCreditValue.innerText();
    // o slider inicia no prazo total (valor máximo) — move para a esquerda para alterar o mês.
    const slider = dialog.getByRole("slider");
    await slider.focus();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("ArrowLeft");
    }
    await expect(async () => {
      const after = await projectedCreditValue.innerText();
      expect(after).not.toBe(before);
    }).toPass();

    // (c) trocar cenário (Base → Agressivo) altera a projeção.
    const beforeScenario = await projectedCreditValue.innerText();
    await dialog.getByRole("group", { name: "Cenário" }).getByRole("button", { name: "Agressivo" }).click();
    await expect(async () => {
      const afterScenario = await projectedCreditValue.innerText();
      expect(afterScenario).not.toBe(beforeScenario);
    }).toPass();

    // (d) salvar simulação → confirmação; fica no histórico do cliente.
    await dialog.getByRole("button", { name: "Salvar simulação" }).click();
    await expect(dialog.getByText("Simulação salva com sucesso.")).toBeVisible();
    await dialog.press("Escape");
    await expect(dialog).toBeHidden();

    await page.goto("/clientes");
    await page.getByRole("link", { name: "[E2E] Simulação Cliente" }).click();
    await expect(page.getByRole("heading", { name: "[E2E] Simulação Cliente" })).toBeVisible();
    await expect(page.getByText("Nenhuma simulação salva ainda.")).toHaveCount(0);

    // (e) abrir o resumo imprimível: cliente, produto, premissas e comparação com CDI (valor, não "não registrada").
    await page.getByRole("button", { name: "Ver resumo" }).first().click();
    await expect(page).toHaveURL(/\/simulacoes\/.+\/resumo/);
    await expect(page.getByRole("heading", { name: "Resumo da simulação" })).toBeVisible();
    await expect(page.getByText("[E2E] Simulação Cliente")).toBeVisible();
    await expect(page.getByText("Produto simulado")).toBeVisible();
    await expect(page.getByText("Premissas usadas")).toBeVisible();
    await expect(page.getByText("Comparação com CDI")).toBeVisible();
    await expect(page.getByText("Comparação com CDI não foi registrada nesta simulação.")).toHaveCount(0);
    await expect(page.getByText("Valor comparado ao CDI")).toBeVisible();
  });

  test("(f) consultora ana@: input de taxa personalizada não aparece para o cenário Personalizado", async ({
    page,
  }) => {
    await loginAsUser(page, DEMO_USERS.consultant.email, DEMO_USERS.consultant.password);
    await page.goto("/atendimento");

    await page.getByLabel("Cliente").fill("[E2E] Consultora Taxa");
    await page.getByLabel("Valor disponível mensal").fill("1500.00");
    await page.getByLabel("Categoria").selectOption("property");
    await page.getByRole("button", { name: "Consultar planos elegíveis" }).click();
    await expect(page.getByRole("heading", { name: "[E2E] Consultora Taxa" })).toBeVisible();

    const recommendedCard = page.locator('[data-slot="card"]').filter({ hasText: "Plano recomendado" }).first();
    await recommendedCard.getByRole("button", { name: "Simular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const scenarioGroup = dialog.getByRole("group", { name: "Cenário" });
    await expect(scenarioGroup.getByRole("button", { name: "Personalizado" })).toHaveCount(0);
    await expect(dialog.getByLabel("Taxa anual personalizada (%)")).toHaveCount(0);
  });
});
