# DEPLOYMENT.md — Deploy do Soren Consórcio Dashboard

> **Estado atual:** o sistema foi desenvolvido e validado **localmente** (Supabase local + `pnpm dev`). O deploy em produção ainda **não foi executado** — este documento é o roteiro para colocá-lo no ar. O design visual final ainda será feito com o cliente; recomenda-se fazer o deploy depois dessa etapa.

## Alvo recomendado

- **Frontend/servidor:** Vercel (Next.js App Router nativo).
- **Banco/Auth/Storage:** Supabase Cloud (projeto gerenciado).

## 1. Provisionar o Supabase Cloud

1. Criar um projeto em https://supabase.com.
2. Anotar, em **Project Settings → API**: `Project URL`, `anon key`, `service_role key`.
3. Anotar, em **Project Settings → Database**: a connection string (`DATABASE_URL`).

## 2. Aplicar as migrations

O schema inteiro está versionado em `supabase/migrations/` (core, tabelas de negócio, RLS, grants, hardening de grants, storage de documentos, staging de extração). Com a Supabase CLI autenticada e o projeto linkado:

```bash
pnpm exec supabase link --project-ref <ref-do-projeto>
pnpm exec supabase db push
```

Isso cria as 11 tabelas + as tabelas de storage/staging, os enums, os índices, as funções helper de RLS e todas as policies no banco de produção.

## 3. Variáveis de ambiente (Vercel)

Configurar no projeto Vercel (Production e Preview), a partir do `.env.example`:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase Cloud |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key — **apenas server-side**; nunca expor no client |
| `DATABASE_URL` | connection string do Postgres (scripts/seed) |
| `APP_URL` | URL pública da aplicação (ex.: `https://soren.vercel.app`) |
| `MAX_PDF_SIZE_MB` | limite de upload de PDF (ex.: `20`) |
| `CRON_SECRET` | segredo forte que protege `/api/cron/sync-indexes`. A Vercel o envia como `Authorization: Bearer <valor>` ao disparar o cron; sem ele a rota rejeita **toda** chamada (401). Ver seção 7 |
| `ENABLE_INDEX_SYNC` | **legado / no-op** — não é mais lido por nenhum código (`grep` em `src/`/`scripts/` não encontra uso). O gating real do cron é o `CRON_SECRET`. Pode omitir com segurança |

`SUPABASE_SERVICE_ROLE_KEY` é lida nos scripts (`scripts/seed.ts`, `scripts/import-xlsx.ts`, `scripts/sync-indexes.ts`) e na rota de cron `/api/cron/sync-indexes` (server-only, runtime Node) — nunca em código de client; o build falha cedo se alguém tentar importá-la num componente client.

## 4. Criar o primeiro administrador e os dados iniciais

O `scripts/seed.ts` cria a organização, os usuários e as configurações/índices iniciais usando a service role. Para produção, ajuste os e-mails/senhas do seed (ou crie o admin manualmente pelo painel do Supabase Auth e insira o `profile` correspondente com `role='admin'` e o `organization_id` da organização real). Depois:

```bash
# com as variáveis de produção no ambiente
pnpm db:seed                                  # org + usuários + settings + índices
pnpm import:xlsx references/consorcio.xlsx    # 63 produtos reais da planilha
```

> **Atenção:** as credenciais demo (`admin@demo.soren.com.br` / `demo12345`) são **apenas para desenvolvimento**. Não use em produção — troque e-mails e senhas.

## 5. Bucket de Storage

A migration `..._storage_product_documents.sql` cria o bucket privado `product-documents` e as policies. Confirmar no painel do Supabase (Storage) que o bucket existe e está **privado** após o `db push`.

## 6. Deploy na Vercel

1. Importar o repositório na Vercel.
2. Framework: Next.js (detectado). Build command padrão (`pnpm build`); install `pnpm install`.
3. Definir as variáveis de ambiente (passo 3).
4. Deploy.

## 7. Sincronização de índices econômicos (Banco Central / SGS)

Os índices que alimentam as simulações (IGP-M, IPCA, CDI, poupança) vêm da API do **SGS — Sistema Gerenciador de Séries Temporais** do Banco Central e são gravados em `financial_indexes` com `source = "Banco Central (SGS)"` e `projected = false`. A lógica está em `src/services/sync-indexes.ts` (séries e normalização) e é compartilhada pelo script CLI e pela rota de cron.

### Séries usadas

Configuráveis em `SGS_SERIES` (`src/services/sync-indexes.ts`) — valide cada código contra a API real antes de subir para produção:

| Índice | Código SGS | Normalização |
|---|---|---|
| IGP-M | 189 | mensal → anual (acumula 12 meses) |
| IPCA | 433 | mensal → anual (acumula 12 meses) |
| CDI | 12 | diário → anual (`(1+d)^252`) |
| Poupança (`SAVINGS`) | 195 | mensal → anual (acumula 12 meses) |

> Confira uma série manualmente assim: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados/ultimos/1?formato=json`.

### Execução manual (one-off)

Com as variáveis de produção no ambiente (ou `.env.local` apontando para o Supabase Cloud):

```bash
pnpm sync:indexes
```

O script imprime um relatório `Atualizados: … / Falhas: …`. **Falha parcial não é erro fatal:** cada índice é sincronizado de forma independente e, se a API do Bacen falhar/der timeout para um deles, o último valor bom permanece no banco (fallback) — a UI nunca fica sem dado. Rode este comando uma vez logo após o deploy para popular os índices oficiais.

### Cron diário (Vercel)

`vercel.json` declara o cron:

```json
{
  "crons": [{ "path": "/api/cron/sync-indexes", "schedule": "0 10 * * *" }]
}
```

- Roda **diariamente às 10:00 UTC** (07:00 no horário de Brasília). Ajuste o `schedule` (cron UTC) se quiser outro horário.
- O arquivo é aplicado automaticamente no deploy — nenhuma configuração extra no painel além da env `CRON_SECRET`.
- A rota (`src/app/api/cron/sync-indexes/route.ts`) roda no **runtime Node** (`runtime = "nodejs"`, `maxDuration = 60`), usa a service role e chama a mesma `syncIndexesFromBcb`.

### Proteção por `CRON_SECRET` (obrigatória)

A rota é uma URL HTTP pública. Ela só aceita a requisição se o header `Authorization` for exatamente `Bearer <CRON_SECRET>`; caso contrário responde **401**. A Vercel injeta esse header automaticamente nas chamadas de cron **quando a env `CRON_SECRET` está definida no projeto**.

1. Gere um segredo forte (guarde em local seguro):
   ```bash
   openssl rand -hex 32
   ```
2. Em **Vercel → Project → Settings → Environment Variables**, adicione `CRON_SECRET` com esse valor (Production; Preview se quiser testar lá).
3. Redeploy para o cron passar a autenticar. Sem a env, **todas** as execuções do cron retornam 401 e nenhum índice é atualizado.

> Já existe um `CRON_SECRET` gerado nesta configuração (no histórico da sessão de setup). Reutilize-o ou gere um novo — se gerar novo, atualize a env na Vercel.

### Teste rápido da rota

```bash
# Deve retornar 401 (sem/errado o secret):
curl -i https://<app>.vercel.app/api/cron/sync-indexes

# Deve retornar { "ok": true, "updated": [...], "failed": [...] }:
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/sync-indexes
```

## 8. Checklist pós-deploy

- [ ] Login com o admin real funciona; rota protegida redireciona sem sessão.
- [ ] `/produtos` lista os 63 produtos importados.
- [ ] Novo atendimento com um valor disponível retorna planos elegíveis (conferir contra a planilha).
- [ ] Simulação salva e resumo imprimível funcionam.
- [ ] Base de Produtos: upload de um PDF de teste → processa → revisa → publica.
- [ ] Isolamento: um usuário não vê dados de outra organização (validado pelos testes `rls-isolation.test.ts` em dev; reconferir com dois usuários reais).
- [ ] Índices: `pnpm sync:indexes` rodou uma vez e populou IGP-M/IPCA/CDI/poupança com `source = "Banco Central (SGS)"`; o simulador exibe as premissas com origem oficial e data.
- [ ] Cron: `CRON_SECRET` configurado na Vercel; `curl` sem o segredo dá 401 e com o segredo dá `{ "ok": true }` (seção 7).

## Riscos e pontos de atenção em produção (serverless)

- **Extração de PDF / OCR em serverless.** `pdfjs-dist`, `tesseract.js` e `@napi-rs/canvas` estão em `serverExternalPackages` (não empacotados). Em funções serverless da Vercel:
  - o worker do `pdfjs` é resolvido via `node_modules` (local-first) — validar que a resolução funciona no runtime da Vercel; se falhar, apontar `standardFontDataUrl`/worker para um caminho empacotado ou usar o runtime Node (não Edge).
  - o `tesseract.js` baixa `por.traineddata` em runtime na primeira execução; em serverless com filesystem efêmero isso repete a cada cold start. Considerar empacotar o traineddata ou usar um serviço de OCR dedicado se o volume justificar.
  - o binário nativo do `@napi-rs/canvas` precisa ser compatível com o runtime (Node) da função. Testar o upload/OCR num deploy de preview antes de produção.
  - Alternativa recomendada para volume: mover o processamento de PDF para um **job assíncrono** (fila/worker) em vez de processar na request — o pipeline já separa upload (rápido) de processamento (pesado), então a migração é natural.
- **Timeout de função.** O processamento de PDF pode exceder o timeout padrão; ajustar o limite da função ou usar processamento assíncrono.
- **CI (E2E).** A suíte Playwright usa `channel: "chrome"` neste ambiente (o download do Chromium é bloqueado no sandbox de desenvolvimento). No CI, prefira `pnpm exec playwright install --with-deps chromium` e remova o `channel` para usar o Chromium empacotado.
