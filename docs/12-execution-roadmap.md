# Roadmap de Execução — IEX

Este documento serve como a fonte de verdade sobre o progresso de desenvolvimento do projeto IEX.

---

## Estado Atual do Projeto

- **Fase Atual**: Configuração de Regras e Agentes (Fase 1)
- **Status da Versão**: Mock 100% funcional no Frontend (Next.js 16 + Tailwind 4)

---

## Roadmap de Desenvolvimento

### Fase 1: Configuração & Alinhamento (ATUAL)
- [x] Extrair mock do sistema (`gestor-de-propostas.zip`) para a raiz do repositório.
- [x] Criar estrutura de documentação básica em `docs/` (`README.md`, `02-mock-contract.md`).
- [/] Ajustar regras de agente (`.agent/*` e `AGENTS.md`) para se alinharem ao novo escopo do projeto IEX.
- [ ] Validar compilação (`pnpm build`) e rodar checklist de validação básico.

### Fase 2: Integração e Persistência (Futuro)
- [ ] Modelagem de banco de dados relacional para Clientes, Disciplinas, Propostas e Logs.
- [ ] Configuração do Supabase e criação de migrações SQL.
- [ ] Integração do Prisma ORM para manipulação das tabelas.
- [ ] Substituição das chamadas do `mock-data.ts` por requisições HTTP reais de APIs ou Server Actions do Next.js.

### Fase 3: Recursos de Inteligência Artificial (Futuro)
- [ ] Criação de Copiloto IA no painel lateral para auxílio na precificação e elaboração de propostas.
- [ ] Integração com OpenAI / Anthropic para sugestões inteligentes baseadas no histórico do cliente.
