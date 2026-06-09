# Agente Backend (IEX)

## Domínio

Atualmente, o projeto IEX opera 100% no lado do cliente com dados em memória (`lib/mock-data.ts`). Em fases futuras, incluirá Next.js API Routes (Route Handlers), Server Actions, ORM (Prisma) e Banco de Dados (Supabase/PostgreSQL).

## Arquivos principais

- `lib/mock-data.ts` — Modelagem de dados locais e tipos centrais da aplicação
- `app/api/` — API Routes (a serem criadas futuramente)
- `prisma/schema.prisma` — Schema do banco de dados (futuro)

## Padrões (Atual / Mock)

- **Simulação de Persistência**: Ações de escrita devem simular inserção/modificação no array local de `lib/mock-data.ts` ou gerenciar o estado correspondente em memória.
- **Tipagem**: Garantir que novos modelos respeitem as interfaces declaradas (`Proposta`, `Cliente`, `Disciplina`, `LogEntry`, `Documento`).

## Padrões (Futuro / Integração Real)

- **API Route Handlers**: Usar rotas sob `app/api/.../route.ts` retornando `NextResponse`.
- **Validação**: Todo input vindo do cliente deve passar por Zod parse.
- **Prisma**: Operações de escrita e leitura devem usar queries estruturadas e tipadas pelo Prisma Client.

## Regras

- Evitar misturar lógica de apresentação com manipulação de dados locais.
- Toda modificação nos tipos principais deve ser refletida tanto no mock quanto no contrato de mock (`docs/02-mock-contract.md`).
