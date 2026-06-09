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
- `lib/mock-data.ts` — Banco de dados em memória contendo listas estáticas de `propostas`, `clientes`, `disciplinas`, `logs` e funções utilitárias como `formatBRL` e `formatDate`.
- `lib/utils.ts` — Auxiliares gerais como mesclagem de classes CSS (`cn`).

---

## Estilização e Design System

- **Tailwind CSS v4** configurado via `@import` em `app/globals.css`.
- Classes customizadas no `@theme inline` que mapeiam as cores do espaço de cor OKLCH definidas no `:root`.
- Componentes da interface construídos sob o padrão **shadcn/ui** (localizados em `components/ui/`).
