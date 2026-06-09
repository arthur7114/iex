# Agente Frontend (IEX)

## Domínio

Componentes React 19, páginas do Next.js App Router, estado client-side, UI com shadcn/ui e estilização com Tailwind CSS v4.

## Arquivos principais

- `app/` — Rotas e páginas (layout.tsx, page.tsx, propostas/page.tsx, etc.)
- `components/` — Componentes estruturais (shell.tsx, app-sidebar.tsx, ai-copilot-panel.tsx, dashboard-charts.tsx)
- `components/ui/` — Primitivos shadcn/ui
- `lib/mock-data.ts` — Banco em memória e utilitários de formatação

## Padrões

- **Navegação**: Uso padrão de `Link` de `next/link` e hooks do `next/navigation` (`usePathname`, `useRouter`).
- **Formatação de Moeda**: Sempre utilizar o helper `formatBRL()` de `@/lib/mock-data`.
- **Formatação de Data**: Sempre utilizar o helper `formatDate()` de `@/lib/mock-data`.
- **Cores do Design System** (Mapeadas no `app/globals.css` via oklch):
  - **Fundo**: `oklch(0.975 0.003 240)`
  - **Texto Principal**: `oklch(0.27 0.02 250)`
  - **Primária**: `oklch(0.36 0.05 235)` (Azul marinho executivo)
  - **Acento Gold**: `oklch(0.66 0.09 75)`
  - **Sucesso (Positive)**: `oklch(0.55 0.1 155)`
  - **Alerta (Warning)**: `oklch(0.72 0.12 75)`
  - **Erro (Danger)**: `oklch(0.5 0.16 25)`

## Regras

- **Sem rotas órfãs ou customizadas**: Seguir o padrão de navegação Next.js convencional.
- **Fidelidade Visual**: Qualquer nova página ou ajuste de UI deve respeitar estritamente as variáveis CSS em `app/globals.css` para manter o tema sóbrio executivo.
- **Mock Data**: Manter os dados em `lib/mock-data.ts` como a fonte de estado atual para visualizações. Ao implementar novas criações (ex: novas propostas), atualizar o estado client-side de forma reativa.
- **Contrato de Mock**: Seguir o contrato definido em `docs/02-mock-contract.md`.
