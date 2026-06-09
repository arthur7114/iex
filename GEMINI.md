# GEMINI.md - Antigravity Kit (IEX)

Este arquivo define como a Inteligência Artificial se comporta e toma decisões neste workspace.

---

## 📥 CLASSIFICADOR DE REQUISIÇÃO

Antes de qualquer ação, o request deve ser classificado:

| Tipo de Request  | Palavras-chave / Escopo                    | Ação Esperada               |
| ---------------- | ------------------------------------------ | --------------------------- |
| **QUESTION**     | "como funciona", "explique", "o que é"     | Apenas Resposta de Texto    |
| **SIMPLE**       | "corrija", "adicione", "mude" (1-3 arqs)   | Edição Direta (Sem Plano)   |
| **COMPLEX**      | "construa", "crie", "implemente"           | Plano de Implementação + Task |
| **DESIGN**       | "desenhe", "UI", "arquitetura"             | Plano de Implementação + Task |

---

## 🤖 ROTEAMENTO INTELIGENTE DE AGENTES

Antes de escrever qualquer código, o agente correspondente deve ser selecionado:

- **Frontend Specialist** (`.agent/agents/frontend.md`) -> Para mudanças em páginas (`app/`), componentes (`components/`) ou estilos (`styles/`, `globals.css`).
- **Backend Specialist** (`.agent/agents/backend.md`) -> Para lógica de negócios, tipos centrais (`lib/mock-data.ts`) ou futuras APIs.

Formato obrigatório de resposta ao ativar um agente:
> 🤖 **Applying knowledge of `@[agent-name]`...**

---

## 🛑 SOCRATIC GATE (GLOBAL TIER 0)

Para qualquer request classificado como **COMPLEX** ou **DESIGN**, a implementação só deve iniciar após validação no portal Socratic:
1. Confirmar o entendimento do escopo.
2. Identificar possíveis edge-cases ou trade-offs.
3. Fazer perguntas estratégicas de clarificação ao usuário.

---

## 🧹 CÓDIGO LIMPO (GLOBAL MANDATORY)

- **Simplicidade**: Código conciso, direto, sem abstrações prematuras.
- **Nomes autoexplicativos**: Evitar comentários óbvios em funções ou variáveis.
- **Respeitar o Mock**: Manter compatibilidade com `docs/02-mock-contract.md`.

---

## 🏁 CHECKLIST DE VALIDAÇÃO (FINAL CHECKS)

Ao concluir as alterações, o checklist de integridade deve ser executado:
1. Rodar `pnpm lint` para garantir a qualidade do código.
2. Rodar `pnpm build` para assegurar que a compilação do Next.js e TypeScript está íntegra.
3. Executar o script de auditoria: `python .agent/scripts/checklist.py`.
4. Atualizar o roadmap em `docs/12-execution-roadmap.md`.
