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

O projeto utiliza **Next.js 16 (App Router)**, **Tailwind CSS 4** e **Supabase/PostgreSQL**:

- `app/` — Rotas e páginas da aplicação (Dashboard, Propostas, Nova Proposta, Clientes, Cadastros, etc.)
- `components/` — Componentes reutilizáveis e layouts baseados em shadcn/ui.
- `lib/db/` — acesso ao Supabase, mapeamentos e RPCs do domínio.
- `lib/document/` — fonte única de preview, PDF, Word e snapshots versionados.
- `lib/mock-data.ts` — tipos/helpers e referência de seed; não é mais a fonte viva.
- `supabase/migrations/` — evolução idempotente do banco.
- `public/` — Imagens, logotipos e placeholders.
- `styles/` — Arquivos CSS globais (usando Tailwind v4 `@import`).

## Stack Tecnológica

- **Framework**: Next.js 16.2 (React 19)
- **Estilização**: Tailwind CSS v4 + tw-animate-css
- **UI Components**: Shadcn/ui + Radix UI primitives + Lucide Icons
- **Gráficos**: Recharts
- **Formulários**: React Hook Form + Zod
- **Persistência e autenticação**: Supabase Auth + PostgreSQL com RLS e RPCs transacionais
- **Documentos**: jsPDF, docx e preview React a partir de `PropostaDoc`

## Contrato atual de propostas

- Novos códigos seguem `AAAAMMDD-NN`, com sequência diária no fuso `America/Fortaleza`.
- A primeira finalização cria `V1`; cada edição finalizada cria uma nova versão imutável.
- O snapshot de versão inclui conteúdo e identidade visual. Proposta, itens e snapshot são finalizados na mesma transação; exportar ou enviar não cria versão.
- Títulos e escopos padrão são materializados no item ao criar a proposta; o fallback legado foi materializado antes da revisão do catálogo e alterações cadastrais não reescrevem propostas existentes.
- Preview, PDF e Word usam paginação adaptativa, sem quebra fixa antes dos encargos.
