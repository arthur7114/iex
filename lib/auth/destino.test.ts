import { describe, expect, it } from "vitest"
import { destinoInternoSeguro } from "./destino"

describe("destinoInternoSeguro", () => {
  it.each([
    ["caminho simples", "/definir-senha", "/definir-senha"],
    ["com query", "/propostas?status=Enviada", "/propostas?status=Enviada"],
    ["com fragmento", "/propostas#topo", "/propostas#topo"],
    ["raiz", "/", "/"],
  ])("mantém %s", (_caso, entrada, esperado) => {
    expect(destinoInternoSeguro(entrada)).toBe(esperado)
  })

  // Todo destino que possa sair da origem vira "/". O caso da barra invertida é
  // o que escapa de uma checagem ingênua de startsWith("//").
  it.each([
    ["URL absoluta", "https://evil.com/colher-senha"],
    ["protocolo relativo", "//evil.com"],
    ["barra invertida", "/\\evil.com"],
    ["barra invertida dupla", "/\\/evil.com"],
    ["barra invertida com caminho", "/\\evil.com/login"],
    ["esquema javascript", "javascript:alert(1)"],
    ["esquema de dados", "data:text/html,<script>"],
    ["caminho relativo", "definir-senha"],
    ["string vazia", ""],
    ["nulo", null],
    ["indefinido", undefined],
  ])("recusa %s", (_caso, entrada) => {
    expect(destinoInternoSeguro(entrada)).toBe("/")
  })

  it("aceita a origem real quando ela é conhecida", () => {
    const origem = "https://app.iexprojetos.com"

    expect(destinoInternoSeguro("/definir-senha", origem)).toBe("/definir-senha")
    expect(destinoInternoSeguro("/\\evil.com", origem)).toBe("/")
  })
})
