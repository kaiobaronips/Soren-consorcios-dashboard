# PDF_IMPORT.md — Base de Produtos (extração de PDF)

Área administrativa (`/base-produtos`, apenas admin/manager) para transformar tabelas de consórcio em PDF em produtos do catálogo, sempre com **revisão humana obrigatória** antes de publicar.

## Pipeline

```
Upload → storage seguro → hash (SHA-256) → extração de texto → identificação de produtos
→ validação → revisão humana (lado a lado) → publicação
```

Estados do documento (`product_documents.status`): `uploaded` → `processing` → `review_required` (ou `failed`) → `completed`.

## 1. Upload

- Apenas PDF: validado pelos **magic bytes** (`%PDF-`) do conteúdo, não pelo MIME do navegador.
- Limite de tamanho: env `MAX_PDF_SIZE_MB` (default 20).
- Nome de arquivo sanitizado (`[^a-zA-Z0-9._-]` → `_`).
- **Deduplicação por hash**: reenviar o mesmo arquivo não reprocessa — retorna o documento existente com um aviso.
- Armazenamento: bucket privado `product-documents` no Supabase Storage, path `{organizationId}/{hash}.pdf`, com policies de RLS que restringem leitura/escrita ao staff da própria organização.

## 2. Extração de texto e OCR

- Texto extraído por página com `pdfjs-dist` (build legacy, roda no Node, sem worker de browser). As linhas são reconstruídas a partir das posições x/y dos fragmentos, inserindo **dois espaços** entre colunas quando a geometria indica troca de coluna (o parser usa esse separador).
- **OCR de fallback** (`tesseract.js`, idioma `por`, ajustável via env `TESSERACT_LANG`): acionado por página quando o texto extraído tem menos de 20 caracteres (PDF digitalizado/imagem). A página é rasterizada com `@napi-rs/canvas` antes do OCR.
- Na primeira execução o Tesseract baixa `por.traineddata` (cache local, gitignored). Offline, o caminho de OCR degrada graciosamente: registra o método `ocr` no log e não extrai produtos — **nunca inventa dados**.

> Build: `pdfjs-dist`, `tesseract.js` e `@napi-rs/canvas` são declarados em `serverExternalPackages` (next.config.ts) — resolvidos por `require()` em runtime no servidor, não empacotados.

## 3. Identificação de produtos (heurística)

Parsing puro e testado (`src/lib/pdf/parse-products.ts`):

- Detecta a linha de cabeçalho por palavras-chave (produto, código, crédito/carta, prazo, taxa, parcela), insensível a acento e caixa.
- Infere as colunas por ordem/posição; linhas de dados são as que têm ≥2 valores monetários ou padrão código+números.
- **Confiança por campo** (0–100): cada campo extraído carrega `value`, `confidence` e o `raw` de origem, além da **página de origem** do produto.
- **Campo não identificado fica PENDENTE** (`value: null`, confiança 0) com uma issue legível — nunca é preenchido com valor inventado.
- Valores pt-BR normalizados: `R$ 600.000,00` → `600000.00`; `26,8%` → `26.800` (pontos percentuais), via `decimal.js`.

### Validações (§8.9)

Aplicadas na extração e novamente na publicação: carta > 0; prazo entre 1 e 600 meses; taxa entre 0 e 100; parcela > 0 e menor que a carta. Violação zera a confiança do campo e vira uma issue.

## 4. Mapeamento manual de colunas

Quando o layout de uma administradora não é inferido corretamente, a tela de revisão permite mapear manualmente qual coluna corresponde a cada campo e **reprocessar** o documento com esse mapeamento — os candidatos ainda em `pending_review` são substituídos; os já aprovados/publicados não são tocados.

## 5. Revisão humana (lado a lado)

Tela `/base-produtos/[id]`:

- Esquerda: o PDF original (via URL assinada do Storage).
- Direita: os produtos extraídos, com cada campo editável, badge de confiança e destaque para campos **pendentes**; página de origem e issues visíveis.
- Fluxo por produto: editar → **aprovar** → **publicar**. Aprovação é individual e humana.

## 6. Publicação

- **Nunca automática**: publicar exige `review_status = 'approved'` (aprovação humana prévia).
- Campo obrigatório **pendente bloqueia** a publicação, com mensagem clara (`first12InstallmentAmount` é opcional).
- **Deduplicação/versionamento** pela chave de negócio `product_code + category + term_months + credit_amount`:
  - Existente → **UPDATE** do produto; a auditoria `product.publish_from_pdf` grava o estado anterior e o novo (histórico de versões).
  - Novo → **INSERT** gravando `source_document_id`, `source_page` e `extraction_confidence`.
- Administradora, categoria e índice de correção são escolhidos na revisão (não vêm do PDF; a administradora é pré-preenchida a partir do nome do arquivo, editável).

## Limitações conhecidas

- OCR de tabelas complexas ou de baixa qualidade tende a produzir muitos campos pendentes — é esperado: o sistema prefere marcar pendente a inventar.
- PDFs protegidos por senha não são suportados.
- A resolução do worker do `pdfjs` é local-first (resolve em `node_modules`); revalidar em ambiente serverless/produção antes do deploy (Fase 7).
