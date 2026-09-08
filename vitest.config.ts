import { fileURLToPath } from "node:url"
import { defaultExclude, defineConfig } from "vitest/config"

// O alias "@/" do tsconfig não é lido pelo vitest automaticamente. Sem isto,
// qualquer teste que importe um módulo da aplicação (ou um módulo que importe
// outro por "@/") falha na resolução.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Worktrees do Claude Code vivem DENTRO do repositório. Sem excluí-los, a
    // suíte da raiz descobre e roda a suíte de cada worktree junto — duplicando
    // a execução e deixando o resultado da main refém de trabalho em andamento.
    exclude: [...defaultExclude, "**/.claude/worktrees/**"],
  },
})
