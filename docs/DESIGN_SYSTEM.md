# Soren Connect Platform Design System

Este documento é a fonte de verdade visual para as telas operacionais do dashboard.
Qualquer nova funcionalidade deve reutilizar estes padrões antes de criar estilos próprios.

## Direção Visual

- Interface SaaS B2B enterprise, densa, técnica e operacional.
- Header preto compacto, sidebar preta, conteúdo em fundo cinza claro e superfícies brancas.
- Sem landing page, hero, glassmorphism, sombras pesadas, gradientes decorativos ou cantos muito arredondados.
- Cards, tabelas, formulários e modais devem parecer ferramentas de gestão, não peças de marketing.

## Tokens Principais

Os tokens vivem em `src/app/globals.css`, dentro de `.enterprise-shell`.

Use estes valores como padrão:

| Token | Uso |
|---|---|
| `--enterprise-app-bg: #f4f4f4` | fundo geral da aplicação |
| `--enterprise-surface: #ffffff` | cards, painéis e tabelas |
| `--enterprise-surface-subtle: #f8f8f8` | footers, toolbars e áreas secundárias |
| `--enterprise-border: #e0e0e0` | borda discreta |
| `--enterprise-border-strong: #c6c6c6` | borda de inputs e controles |
| `--enterprise-text: #161616` | texto principal |
| `--enterprise-text-secondary: #525252` | texto secundário |
| `--enterprise-text-muted: #6f6f6f` | metadados |
| `--enterprise-blue: #0f62fe` | ação primária, foco e seleção |
| `--enterprise-blue-hover: #0353e9` | hover da ação primária |

## Tipografia

- Fonte padrão: IBM Plex Sans via `var(--font-ibm-plex-sans)`.
- Títulos de página: `32px`, peso `400`, line-height `40px`.
- Títulos de cards/modais: `16px` a `18px`, peso `400` ou `500`.
- Corpo/tabelas: `13px` a `14px`.
- Labels de formulário: `12px`, peso `500`.
- Números em tabelas, métricas e gráficos devem usar `tabular-nums`.

Não usar fontes especiais ou pesos fortes fora de casos explicitamente definidos pela marca.

## Layout

Todas as rotas autenticadas devem usar `OperationalShell`.

Estrutura padrão:

```tsx
<OperationalShell>
  <GlobalHeader />
  <PrimarySidebar />
  <RouteBar />
  <main className="enterprise-content">
    <OperationalPageHeader />
    <section className="enterprise-card" />
  </main>
</OperationalShell>
```

Regras:

- A aplicação ocupa toda a viewport.
- Conteúdo começa depois do header, da sidebar e da rota aberta.
- Sidebar compacta tem `50px`.
- Header tem `52px`.
- Route bar tem `28px`, inicia fora do sidebar e usa separadores `|`.
- Padding de conteúdo desktop: `24px`.
- Mobile pode reduzir padding para `16px`.

## Componentes Obrigatórios

Preferir os componentes e classes abaixo:

| Necessidade | Usar |
|---|---|
| Shell de app | `src/components/layout/operational-shell.tsx` |
| Cabeçalho de página | `OperationalPageHeader` |
| Botão enterprise | `EnterpriseButton` ou classes `enterprise-button*` |
| Card/painel | `Panel` ou `enterprise-card` |
| Métrica | `MetricCard` |
| Status | `StatusBadge` |
| Modal | `enterprise-modal`, `enterprise-modal-header`, `enterprise-modal-body`, `enterprise-modal-footer` |
| Input de modal/form | `enterprise-field-input` |
| Label de form | `enterprise-field-label` |
| Tabela | `enterprise-table` |
| Toolbar/filtros | `enterprise-toolbar` |
| Tabs | `enterprise-tabs`, `enterprise-tab`, `enterprise-tab-active` |

Não estilizar diretamente componentes shadcn/base-ui como produto final. Eles podem ser usados para comportamento e acessibilidade, mas a camada visual deve seguir as classes enterprise.

## Botões

Primário:

```tsx
<Button className="enterprise-button enterprise-button-primary rounded-sm px-4">
  Cadastrar
</Button>
```

Secundário:

```tsx
<Button className="enterprise-button enterprise-button-secondary rounded-sm px-4">
  Cancelar
</Button>
```

Ícones:

- Usar Lucide React.
- Botões de ícone devem ter `aria-label`.
- Tamanho comum: `18px`.
- Evitar ícones dentro de círculos coloridos decorativos.

## Formulários E Modais

Modal padrão:

```tsx
<DialogContent className="enterprise-modal max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
  <DialogHeader className="enterprise-modal-header">
    <DialogTitle className="enterprise-modal-title">Título</DialogTitle>
  </DialogHeader>
  <form>
    <div className="enterprise-modal-body">...</div>
    <div className="enterprise-modal-footer">...</div>
  </form>
</DialogContent>
```

Regras:

- Rodapé do modal deve ficar sempre visível.
- Corpo do modal rola internamente.
- Inputs quadrados, altura `40px`, borda `#c6c6c6`.
- Foco azul com outline interno.
- Botão principal sempre azul Soren enterprise.
- Textos de ação curtos: `Cadastrar`, `Salvar`, `Excluir`, `Cancelar`.

## Tabelas

Usar `enterprise-table`.

Regras:

- Cabeçalho cinza claro.
- Linhas com `48px` de altura.
- Separação só horizontal.
- Sem borda em todas as células.
- Dados devem ficar em uma linha por célula; se necessário, criar novas colunas.
- Coluna `Ação` aparece apenas para perfis com permissão.
- Ações destrutivas precisam de confirmação em modal.

## Permissões Na UI

As permissões visuais devem refletir regras server-side.

- `admin`: pode cadastrar, alterar e excluir dados operacionais onde houver ação implementada.
- `manager`: pode operar funções staff definidas, mas não herda automaticamente exclusão administrativa.
- `consultant`: vê e opera somente o fluxo permitido ao consultor.

Toda action sensível deve validar o papel no servidor, não apenas esconder botão na UI.

## PDF E Produtos

Uploads de PDF seguem a regra atual:

- PDF enviado é processado automaticamente.
- Produtos completos são publicados em `consortium_products`.
- Produtos incompletos permanecem em revisão.
- Produtos vindos de PDF devem preencher `source_document_id` para aparecerem como `Upload · Documento PDF`.
- Produtos manuais aparecem como `Adicionado manualmente`.

## Checklist Para Nova Tela

Antes de finalizar qualquer tela:

- Usa `OperationalPageHeader`.
- Usa `enterprise-card` ou `Panel`.
- Usa `enterprise-table` para dados tabulares.
- Usa `enterprise-modal` para pop-ups.
- Usa `enterprise-button` para ações.
- Usa IBM Plex Sans herdada do shell.
- Não criou nova paleta visual.
- Não adicionou sombra pesada, gradiente decorativo ou border-radius acima de `8px`.
- `pnpm lint` e `pnpm typecheck` passam.

