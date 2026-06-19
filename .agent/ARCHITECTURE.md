# Arquitetura IEX — Gestor de Propostas

## Visão geral

Aplicação Next.js 16 (App Router) construída inteiramente com estado client-side no React 19, utilizando dados mockados locais em `lib/mock-data.ts` para simular chamadas de banco e fluxos de negócio.

---

## Camadas e Componentes Principais

### 1. Rotas e Páginas (`app/`)
- `app/layout.tsx` — Layout raiz contendo o provider de tema, fontes e componente Toaster. Imports globais de CSS (`app/globals.css`).
- `app/page.tsx` — Dashboard comercial com cards de estatísticas, gráficos analíticos (recharts) e alertas de propostas sem retorno.
- `app/propostas/page.tsx` — Listagem de propostas com filtros por status/responsável e visualização de detalhes em gaveta lateral.
- `app/propostas/nova/page.tsx` — Formulário de criação de proposta com precificação dinâmica por m² (área * valor base da disciplina).
- `app/clientes/page.tsx` — Diretório e métricas de clientes.
- `app/cadastros/page.tsx` — Configurações de disciplinas e seus respectivos valores bases por metro quadrado.
- `app/logs/page.tsx` — Histórico de ações de auditoria executadas pelos usuários.

### 2. Layouts e Componentes Globais (`components/`)
- `components/shell.tsx` — Layout principal da aplicação com topbar de navegação, breadcrumbs e integração com a barra lateral.
- `components/app-sidebar.tsx` — Menu lateral contendo navegação baseada no pathname atual.
- `components/ai-copilot-panel.tsx` — Painel lateral simulando um copiloto IA para auxílio no preenchimento e análise comercial das propostas.
- `components/proposal-drawer.tsx` — Detalhes expandidos de uma proposta específica na listagem.

### 3. Serviços e Dados (`lib/`)
- `lib/supabase/` — Clientes Supabase (`@supabase/ssr`): `client.ts` (browser), `server.ts` (server/cookies), `middleware.ts` (renovação de sessão + proteção de rotas).
- `lib/db/*` — Camada de acesso a dados (client-side, com RLS `authenticated` e RPCs do banco): `propostas`, `clientes`, `disciplinas`, `lookups`, `complexidade`, `config`, `logs`, `documentos`, `dashboard`, `usuarios`, `types`. Mapeia linhas snake_case do Postgres para os tipos de domínio camelCase consumidos pela UI.
- `lib/mock-data.ts` — Mantido apenas pelos **tipos de domínio** e helpers `formatBRL`/`formatDate`. As listas estáticas deixaram de ser a fonte viva (o app lê do Supabase); permanecem como referência/seed.
- `lib/storage.ts` — Apenas o rascunho do wizard (localStorage).
- `lib/pricing.ts` — Motor de precificação legado; a lógica de complexidade agora vem do banco (`variaveis_complexidade`) via `lib/db/complexidade.ts`.
- `lib/utils.ts` — Auxiliares gerais (`cn`).

### Backend (Supabase — projeto `qkobmpdawjcbgumxzpzh`)
- Schema normalizado pré-existente (15 migrations): `clientes`, `propostas`/`proposta_itens`/`proposta_eventos`, `disciplinas`, lookups (`origens_cliente`, `perfis_cliente`, `tipos_empreendimento`, `motivos_perda`, `formas_pagamento`), `variaveis_complexidade`, `usuarios`, `config_empresa`/`config_precificacao`, `documentos`, `logs_uso`.
- Views: `v_propostas`, `clientes_metricas`, `v_logs_uso`. RPCs: `fn_log_uso` (auditoria), `fn_transicionar_status` (máquina de status).
- **Auth**: Supabase Auth; `auth.users` → `usuarios` via trigger `handle_new_auth_user`. RLS: `authenticated` tem acesso total; `anon` não acessa.
- Scripts utilitários em `scripts/`: `lib-db.mjs` (conexão direta via pooler), `create-test-user.mjs`, `validate-db.mjs`.

---

## Estilização e Design System

- **Tailwind CSS v4** configurado via `@import` em `app/globals.css`.
- Classes customizadas no `@theme inline` que mapeiam as cores do espaço de cor OKLCH definidas no `:root`.
- Componentes da interface construídos sob o padrão **shadcn/ui** (localizados em `components/ui/`).
