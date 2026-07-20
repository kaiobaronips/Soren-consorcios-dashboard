import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "html",
  // Aquece as rotas do dev server (Next compila sob demanda na 1ª requisição) antes
  // dos testes, para o cold start não estourar o timeout do primeiro teste.
  globalSetup: "./e2e/global-setup.ts",
  // Timeout de asserção mais folgado: o dev server pode compilar uma rota nova em
  // alguns segundos na primeira visita.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // Usa o Google Chrome instalado no sistema em vez do Chromium
      // empacotado pelo Playwright: o download de cdn.playwright.dev
      // não é alcançável no sandbox deste ambiente (TLS handshake trava).
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
