import { test, expect } from "@playwright/test";
import { loginAsUser, DEMO_USERS } from "./helpers/auth";

/**
 * Responsividade (Fase 7, Tarefa 6): nas viewports tablet (768×1024) e mobile
 * (390×844), as páginas principais não devem ter overflow horizontal do body
 * e a sidebar deve colapsar (trigger do menu visível, sidebar fora da tela).
 * UI neutra shadcn — nenhum ajuste de cor/identidade, só o mínimo para não
 * quebrar o layout.
 */
const VIEWPORTS = {
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

const PAGES = ["/", "/atendimento", "/produtos", "/clientes"] as const;

test.describe("Responsividade — tablet e mobile", () => {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`viewport ${viewportName} (${viewport.width}x${viewport.height})`, () => {
      test.use({ viewport });

      for (const path of PAGES) {
        test(`${path}: sem overflow horizontal do body e sidebar colapsada`, async ({ page }) => {
          await loginAsUser(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
          await page.goto(path);
          await expect(page.getByRole("main")).toBeVisible();

          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.body.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);

          // A sidebar colapsa: o trigger (botão de menu) fica visível para abri-la.
          await expect(page.getByRole("button", { name: "Toggle Sidebar" })).toBeVisible();
        });
      }
    });
  }
});
