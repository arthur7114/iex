# IEX — Gestor de Propostas

Este projeto é uma plataforma comercial corporativa para criação, padronização, precificação e gestão de propostas comerciais de projetos de engenharia.

## Escopo Comercial

O sistema gerencia propostas de projetos para diversas disciplinas de engenharia civil/instalações:
- Instalações elétricas
- Hidráulica
- Sanitária
- Incêndio
- SPDA
- Estrutura
- Climatização
- CFTV
- Gás
- Fotovoltaica
- Sondagem

## Estrutura do Projeto

O projeto utiliza **Next.js 16 (App Router)** e **Tailwind CSS 4**:

- `app/` — Rotas e páginas da aplicação (Dashboard, Propostas, Nova Proposta, Clientes, Cadastros, etc.)
- `components/` — Componentes reutilizáveis e layouts baseados em shadcn/ui.
- `lib/` — Utilitários comuns e dados mockados (`lib/mock-data.ts`).
- `public/` — Imagens, logotipos e placeholders.
- `styles/` — Arquivos CSS globais (usando Tailwind v4 `@import`).

## Stack Tecnológica

- **Framework**: Next.js 16.2 (React 19)
- **Estilização**: Tailwind CSS v4 + tw-animate-css
- **UI Components**: Shadcn/ui + Radix UI primitives + Lucide Icons
- **Gráficos**: Recharts
- **Formulários**: React Hook Form + Zod
- **Gerenciamento de Estado**: Estado React client-side (mock data local em `lib/mock-data.ts`)
