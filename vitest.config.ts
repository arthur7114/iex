import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// O alias "@/" do tsconfig não é lido pelo vitest automaticamente. Sem isto,
// qualquer teste que importe um módulo da aplicação (ou um módulo que importe
// outro por "@/") falha na resolução.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})
