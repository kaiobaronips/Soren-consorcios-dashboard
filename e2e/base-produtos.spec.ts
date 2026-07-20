import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { loginAsUser, DEMO_USERS } from "./helpers/auth";
import { cleanupBaseProdutosE2EData } from "./helpers/cleanup";

/**
 * E2E da Base de Produtos: upload de PDF → processar (extração) → revisar
 * (produtos extraídos com badges de confiança + PDF ao lado) → editar/aprovar/
 * publicar por produto → produto aparece em /produtos. Cobre também dedup por
 * hash (re-upload do mesmo arquivo) e bloqueio de publicação com campo pendente.
 *
 * Fixture `tests/fixtures/tabela-simples.pdf` traz 3 produtos (Auto Facil/001,
 * Imovel Plus/002, Moto Ja/003), todos com os 6 campos obrigatórios legíveis
 * (confiança 90%) — só a Parcela 1ª–12ª (opcional) fica PENDENTE, pois a
 * tabela não tem essa coluna.
 *
 * O processamento roda o pipeline de extração (pdfjs) de forma síncrona na
 * server action; usamos timeout de teste generoso e esperas explícitas por
 * status em vez de sleeps fixos.
 */
const FIXTURE_PATH = path.join(__dirname, "..", "tests", "fixtures", "tabela-simples.pdf");

/**
 * Localiza o card de um produto extraído pelo valor do campo "Produto".
 *
 * Os 3 candidatos do fixture têm o mesmo `page` (1) e são inseridos no mesmo
 * instante (mesmo `created_at`), então a ordem de `listByDocument` (order by
 * page, created_at) não é estável entre re-renders — não dá pra confiar num
 * índice fixo (nth), que ficaria apontando pro card errado depois de um
 * router.refresh() reordenar a lista. Em vez de resolver um índice uma vez,
 * devolve um Locator por XPath (`@value`) — reavaliado do zero a cada
 * interação/asserção, então nunca fica "preso" numa posição obsoleta.
 */
function cardByProductName(page: Page, name: string): Locator {
  return page.locator(`xpath=//input[@value=${JSON.stringify(name)}]/ancestor::div[contains(@class, "rounded-lg")][1]`);
}

test.describe("Base de Produtos — upload, revisão e publicação", () => {
  test.beforeEach(async () => {
    // Garante slate limpo: um run anterior interrompido deixaria o documento
    // do fixture já cadastrado, o que faria o 1º upload deste teste cair no
    // caminho de duplicado.
    await cleanupBaseProdutosE2EData();
  });

  test.afterEach(async () => {
    await cleanupBaseProdutosE2EData();
  });

  test("upload → processar → revisar → editar → aprovar → publicar; re-upload é duplicado; campo pendente bloqueia publicação", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
    await page.goto("/base-produtos");

    // (a) upload do PDF → documento aparece na lista com status "Enviado".
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Selecionar arquivos" }).click(),
    ]);
    await chooser.setFiles(FIXTURE_PATH);

    const row = page.locator("tr", { hasText: "tabela-simples.pdf" });
    await expect(row).toBeVisible();
    await expect(row.getByText("Enviado", { exact: true })).toBeVisible();

    // (b) processar → status vira "revisão"; abrir revisão mostra os produtos
    // extraídos com badges de confiança e o PDF ao lado.
    await row.getByRole("button", { name: "Processar" }).click();
    await expect(row.getByRole("link", { name: "Revisar" })).toBeVisible({ timeout: 60_000 });
    await expect(row.getByText("Revisão pendente")).toBeVisible();

    await row.getByRole("link", { name: "Revisar" }).click();
    await expect(page).toHaveURL(/\/base-produtos\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "tabela-simples.pdf" })).toBeVisible();
    await expect(page.getByText("3 produto(s) candidato(s).")).toBeVisible();

    // PDF de origem visível ao lado dos produtos extraídos.
    await expect(page.getByTitle("tabela-simples.pdf")).toBeVisible();

    // 3 candidatos extraídos (Auto Facil, Imovel Plus, Moto Ja), cada um com
    // badge de confiança (conf. 90%) nos campos preenchidos e badge PENDENTE
    // na Parcela 1ª–12ª (coluna ausente no fixture).
    const productNameInputs = page.getByRole("textbox", { name: "Produto" });
    await expect(productNameInputs).toHaveCount(3);
    const names = await productNameInputs.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(new Set(names)).toEqual(new Set(["Auto Facil", "Imovel Plus", "Moto Ja"]));

    const autoFacilCard = cardByProductName(page, "Auto Facil");
    await expect(autoFacilCard.getByText("conf. 90%").first()).toBeVisible();
    await expect(autoFacilCard.getByText("PENDENTE", { exact: true })).toBeVisible(); // Parcela 1ª–12ª

    // (c) editar um campo do candidato Auto Facil (corrige o código do
    // produto), aprovar e publicar → produto aparece em /produtos.
    const codeInput = autoFacilCard.getByRole("textbox", { name: "Código" });
    await codeInput.fill("001-REVISADO");
    await codeInput.blur();
    await expect(autoFacilCard.getByText("conf. 100%")).toBeVisible();

    await autoFacilCard.getByRole("button", { name: "Aprovar" }).click();
    await expect(autoFacilCard.getByText("Aprovado")).toBeVisible();

    await autoFacilCard.getByRole("button", { name: "Publicar" }).click();
    await expect(autoFacilCard.getByText("Publicado", { exact: true })).toBeVisible();
    await expect(autoFacilCard.getByRole("link", { name: "/produtos" })).toBeVisible();

    await page.goto("/produtos");
    await expect(page.getByText("001-REVISADO")).toBeVisible();
    await expect(page.getByText("Auto Facil").first()).toBeVisible();

    // (e) tentar publicar um candidato com campo pendente → erro claro, não
    // publica. Limpa a Parcela Mensal (obrigatória) do candidato Moto Ja,
    // aprova e tenta publicar.
    const reviewUrlMatch = /\/base-produtos\/[0-9a-f-]+$/;
    await page.goto("/base-produtos");
    await page.locator("tr", { hasText: "tabela-simples.pdf" }).getByRole("link", { name: "Revisar" }).click();
    await expect(page).toHaveURL(reviewUrlMatch);

    const motoJaCard = cardByProductName(page, "Moto Ja");
    const installmentInput = motoJaCard.getByRole("textbox", { name: "Parcela mensal" });
    await installmentInput.fill("");
    await installmentInput.blur();
    await expect(motoJaCard.getByText("PENDENTE", { exact: true }).first()).toBeVisible();

    await motoJaCard.getByRole("button", { name: "Aprovar" }).click();
    await expect(motoJaCard.getByText("Aprovado")).toBeVisible();

    await motoJaCard.getByRole("button", { name: "Publicar" }).click();
    await expect(motoJaCard.getByText(/Campo pendente bloqueia a publicação/)).toBeVisible();
    // Nunca foi publicado: continua "Aprovado", não "Publicado".
    await expect(motoJaCard.getByText("Aprovado")).toBeVisible();

    // (d) re-upload do mesmo arquivo → aviso de duplicado, não reprocessa.
    await page.goto("/base-produtos");
    const [chooser2] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Selecionar arquivos" }).click(),
    ]);
    await chooser2.setFiles(FIXTURE_PATH);
    await expect(page.getByText("Documento duplicado (ignorado)")).toBeVisible();
    // Continua havendo só uma linha do arquivo na lista (não duplicou o documento).
    await expect(page.locator("tr", { hasText: "tabela-simples.pdf" })).toHaveCount(1);
  });
});
