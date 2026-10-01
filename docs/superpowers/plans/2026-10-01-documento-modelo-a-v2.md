# Documento Modelo A v2 — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF, prévia na tela e Word da proposta passam a seguir o layout "Modelo A v2" aprovado pela IEX, com o mesmo conteúdo dinâmico de hoje.

**Architecture:** Um módulo puro (`lib/document/layout-a.ts`) concentra paleta, conteúdo institucional fixo, formatação e paginação. Um carregador (`lib/document/recursos.ts`) busca fonte e imagens estáticas de `public/`. O PDF é redesenhado com jsPDF em blocos paginados. A prévia vira folhas A4 em React com medidas em mm via container query. O Word é montado com `docx` em tabelas sombreadas. Os três leem `layout-a.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, jsPDF 4 (`jspdf`), `docx` 9, vitest 4, pnpm. Imagens geradas com Google Chrome headless (só em desenvolvimento).

**Spec:** `docs/superpowers/specs/2026-10-01-documento-modelo-a-v2-design.md`

## Global Constraints

- Paleta fixa: navy capa `#0f1c33`, navy `#1f3152`, painel `#172b4d`, dourado `#c09a55`, azul-claro `#75c2e3`, tinta `#1d2433`, cinza `#6b7486`, linha `#e3e7ee`, faixa `#f4f6fa`. `empresa.corPrimaria` não afeta o documento novo.
- Números institucionais: "+ de 1.400 Projetos aprovados", "32 Hospitais e clínicas", "+ de 600 Lojas em 36 shopping centers".
- Valores monetários sempre com `brl()` de `lib/document/tipos.ts` (duas casas). Ele usa espaço não separável depois de "R$"; testes procuram só o número (`123.160,00`).
- Rodapé de toda página interna inclui `empresa.textoRodape || "Powered by YRM Strategy Lab"`.
- Quem assina continua vindo de `assinaturaDoDocumento()`; não duplicar a regra.
- Nenhuma imagem do documento depende de CSS `mask`/`mask-image` (o leitor de PDF do iPhone ignora; ver incidente da foto cortada).
- Textos de interface e comentários em português, no estilo do repositório.
- Nada vai para a `main` sem ordem explícita do Arthur.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Ajustes à spec decididos neste plano

Registrados na spec no Task 1:

1. **Quem somos no Word** vira tabela nativa (foto, mapa, números em texto) em vez de imagem única. Fica editável e não duplica os números numa imagem.
2. **Página de metodologia:** foto do prédio, degradê e cantos arredondados vêm prontos em `metodologia.png`. O degradê não é desenhado em código.
3. **Prévia:** como `DocumentData` não traz dados da empresa, o rodapé usa `EMPRESA_PADRAO` (IEX Projetos, endereço e telefone). A prévia não mostra a imagem de assinatura nem os dados bancários.
4. **`middleware.ts`** deixa de interceptar `.ttf`/`.woff`/`.woff2`, para a fonte do documento carregar como estático.
5. **Revisão da IEX no Modelo A v2 (01/10/2026, "Documento sem nome.pdf"):**
   - "Quem somos" usa o texto institucional da IEX (dois parágrafos, abaixo do painel); o título e o resumo do painel saem.
   - O institucional vem antes do projeto: Capa → Quem somos → Como trabalhamos + Nossas especialidades → Apresentação + Dados do empreendimento + Escopo (o escopo continua na mesma página) → Condições.
   - "Etapas deste projeto" sai (a IEX não manteve). O quadro do investimento total fica (o recorte da IEX só cortou a imagem).
   - Exemplo dos testes: prazo em "dias úteis" (o app já usa "30 dias úteis" por padrão) e listas de Incluso / Não incluso da IEX. As listas reais vêm dos modelos de proposta em Cadastros, que este plano não altera.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `scripts/documento/fontes/*` | criar | Fontes das imagens (SVG/PNG originais) |
| `scripts/documento/rasterizar.mjs` | criar | Gera os PNG de `public/documento` com Chrome headless |
| `public/documento/*.png`, `public/documento/icones/*.png` | criar | Imagens usadas pelo PDF, Word e prévia |
| `public/fonts/manrope-{400,600,700,800}.ttf`, `public/fonts/OFL.txt` | criar | Fonte Manrope e licença |
| `middleware.ts` | modificar | Excluir fontes do matcher |
| `lib/document/layout-a.ts` | criar | Paleta, institucional, regras puras, `paginar` |
| `lib/document/layout-a.test.ts` | criar | Testes das regras puras |
| `lib/document/recursos.ts` | criar | Tipos e carregador de fonte/imagens |
| `test/recursos-documento.ts` | criar | Carrega recursos do disco para os testes |
| `test/documento-exemplo.ts` | criar | Proposta e empresa de exemplo para os testes |
| `lib/document/recursos.test.ts` | criar | Garante que todos os arquivos existem e carregam |
| `lib/document/pdf.ts` | reescrever | `montarPdf` / `gerarPdf` (assíncrono) |
| `lib/document/pdf.test.ts` | criar | Páginas, textos, fallback de fonte |
| `app/propostas/page.tsx`, `app/propostas/nova/page.tsx`, `components/proposal-drawer.tsx` | modificar | `await gerarPdf(...)` |
| `components/document-preview.tsx` | reescrever | Prévia em folhas A4 |
| `components/document-preview.test.ts` | criar | Renderização estática da prévia |
| `app/globals.css` | modificar | `@font-face` "Manrope Documento" |
| `lib/document/word.ts` | reescrever | `montarWord` / `gerarWord` |
| `lib/document/word.test.ts` | criar | Texto do XML do .docx |
| `package.json` | modificar | `jszip` como devDependency (teste do Word) |
| `docs/02-mock-contract.md`, `docs/12-execution-roadmap.md`, `docs/01-prd.md` | modificar | Adendo, progresso, estrutura do documento |

---

### Task 1: Recursos estáticos (fonte, imagens, ícones)

**Files:**
- Create: `scripts/documento/fontes/` (logo, mapa, rede, sócios, prédio, ícones SVG)
- Create: `scripts/documento/rasterizar.mjs`
- Create: `public/documento/*.png`, `public/documento/icones/*.png`, `public/fonts/*`
- Modify: `middleware.ts:11`
- Modify: `docs/superpowers/specs/2026-10-01-documento-modelo-a-v2-design.md` (ajustes acima)

**Interfaces:**
- Produces (arquivos que os Tasks 3–7 leem):
  - `/fonts/manrope-400.ttf`, `/fonts/manrope-600.ttf`, `/fonts/manrope-700.ttf`, `/fonts/manrope-800.ttf`
  - `/documento/logo-branco.png`, `/documento/socios.png`, `/documento/mapa-brasil.png`, `/documento/metodologia.png`, `/documento/capa-rede.png`, `/documento/capa-word.png`
  - `/documento/icones/<id>.png` para cada id de `ICONES` (Task 2): `eletrica hidraulica sanitaria incendio climatizacao spda dados gas estrutura fotovoltaica generico bim quantitativos aprovacoes`

- [ ] **Step 1: Copiar as fontes das imagens para o repositório**

Origem: diretório do Modelo A v2 na scratchpad desta sessão
(`/private/tmp/claude-501/-Users-arthurbrito-Documents-Dev-IEX--claude-worktrees-uncommitted-local-changes-0c8f93/16a69521-0534-4bbd-943b-57c5ca4c5851/scratchpad/modelos`, chamado de `$MODELOS` abaixo).

```bash
MODELOS=/private/tmp/claude-501/-Users-arthurbrito-Documents-Dev-IEX--claude-worktrees-uncommitted-local-changes-0c8f93/16a69521-0534-4bbd-943b-57c5ca4c5851/scratchpad/modelos
mkdir -p scripts/documento/fontes/icones public/documento/icones public/fonts
cp "$MODELOS/mapa-brasil.svg" scripts/documento/fontes/mapa-brasil.svg
cp "$MODELOS/rede.svg" scripts/documento/fontes/capa-rede.svg
cp "$MODELOS/socios.png" public/documento/socios.png
sips -Z 1600 "$MODELOS/predio-blueprint.png" --out scripts/documento/fontes/predio-blueprint.png
cp public/images/iex-projetos-logo-branco.svg scripts/documento/fontes/logo-branco.svg
```

Expected: os 5 arquivos existem; `sips` imprime o caminho de saída.

- [ ] **Step 2: Criar os SVG dos ícones**

Todos em `scripts/documento/fontes/icones/<id>.svg`, com o mesmo invólucro (troque só o miolo):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1f3152" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">MIOLO</svg>
```

| id | MIOLO |
|---|---|
| `eletrica` | `<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>` |
| `hidraulica` | `<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/><path d="M9 15a3 3 0 0 0 3 3"/>` |
| `sanitaria` | `<path d="M4 3v7a4 4 0 0 0 4 4h12"/><path d="m16 10 4 4-4 4"/><path d="M2 3h4"/>` |
| `incendio` | `<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8a7 7 0 0 0 7 7z"/>` |
| `climatizacao` | `<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>` |
| `spda` | `<path d="M12 2v6M9 5l3-3 3 3"/><path d="M6 22 12 8l6 14"/><path d="M8 17h8M4 22h16"/>` |
| `dados` | `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>` |
| `gas` | `<rect x="7" y="6" width="10" height="15" rx="3"/><path d="M10 6V3h4v3M10 11h4"/>` |
| `estrutura` | `<path d="M4 21V9l8-6 8 6v12"/><path d="M4 13h16M4 17h16M9 21v-8M15 21v-8"/>` |
| `fotovoltaica` | `<rect x="3" y="11" width="18" height="9" rx="1"/><path d="M3 15.5h18M9 11v9M15 11v9M12 2v3M5.6 4.6l1.8 1.8M18.4 4.6l-1.8 1.8"/>` |
| `generico` | `<path d="M4 20h16M6 20V8l6-4 6 4v12"/><path d="M10 20v-5h4v5"/>` |
| `bim` | `<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>` |
| `quantitativos` | `<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>` |
| `aprovacoes` | `<path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>` |

- [ ] **Step 3: Escrever o script de rasterização**

Create `scripts/documento/rasterizar.mjs`:

```js
// Gera as imagens do documento da proposta (public/documento) a partir de
// scripts/documento/fontes. Só roda em desenvolvimento, com Google Chrome.
// Uso: node scripts/documento/rasterizar.mjs   (CHROME=/caminho para outro binário)
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

const raiz = resolve(import.meta.dirname, "../..")
const fontes = join(raiz, "scripts/documento/fontes")
const destino = join(raiz, "public/documento")
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const tmp = mkdtempSync(join(tmpdir(), "iex-documento-"))
const arquivo = (nome) => `file://${join(fontes, nome)}`

function render(saida, corpo, largura, altura, { fundo = "transparent" } = {}) {
  const html = join(tmp, `${basename(saida)}.html`)
  writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:${fundo}}img{display:block}</style></head><body>${corpo}</body></html>`)
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
    fundo === "transparent" ? "--default-background-color=00000000" : "--default-background-color=ffffffff",
    `--window-size=${largura},${altura}`, `--screenshot=${join(destino, saida)}`, `file://${html}`,
  ], { stdio: "ignore" })
  console.log(`ok  ${saida}`)
}

// Logo branco (proporção 145,83 × 113,78).
render("logo-branco.png", `<img src="${arquivo("logo-branco.svg")}" style="width:640px">`, 640, 500)
// Mapa do Brasil (proporção 273,2 × 275,44).
render("mapa-brasil.png", `<img src="${arquivo("mapa-brasil.svg")}" style="width:800px">`, 800, 807)
// Desenho técnico da capa (viewBox 600 × 420).
render("capa-rede.png", `<img src="${arquivo("capa-rede.svg")}" style="width:1500px">`, 1500, 1050)
// Painel da metodologia: 174 × 56 mm a 10 px/mm, cantos de 3 mm e degradê já aplicados.
render("metodologia.png", `<div style="width:1740px;height:560px;border-radius:30px;overflow:hidden;position:relative;background:#172b4d url(${arquivo("predio-blueprint.png")}) center/cover no-repeat"><div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,28,51,.88),rgba(15,28,51,0) 70%)"></div></div>`, 1740, 560)
// Capa do Word: A4 a 150 dpi, sem texto (o texto vai editável por cima).
render("capa-word.png", `<svg width="1240" height="1754" viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg"><rect width="210" height="297" fill="#fff"/><polygon points="0,0 210,0 210,184.14 0,231.66" fill="#0f1c33"/><image href="${arquivo("capa-rede.svg")}" x="70" y="26" width="150" height="105"/><polygon points="0,231.66 210,184.14 210,188.89 0,236.41" fill="#c09a55"/></svg>`, 1240, 1754, { fundo: "#ffffff" })
// Ícones a 96 px.
for (const svg of readdirSync(join(fontes, "icones")).filter((f) => f.endsWith(".svg"))) {
  render(`icones/${svg.replace(".svg", ".png")}`, `<img src="${arquivo(`icones/${svg}`)}" style="width:96px">`, 96, 96)
}
```

- [ ] **Step 4: Gerar as imagens**

Run: `node scripts/documento/rasterizar.mjs`
Expected: 19 linhas `ok  ...` (5 imagens + 14 ícones).

Run: `ls public/documento public/documento/icones && sips -g pixelWidth -g pixelHeight public/documento/metodologia.png`
Expected: 6 PNG em `public/documento` (incluindo `socios.png`), 14 em `icones`; `metodologia.png` com 1740 × 560.

- [ ] **Step 5: Conferir as imagens a olho**

Read (ferramenta de leitura de imagem): `public/documento/capa-word.png`, `public/documento/metodologia.png`, `public/documento/mapa-brasil.png`, `public/documento/icones/eletrica.png`.
Expected: capa com bloco navy diagonal, faixa dourada e desenho azul; metodologia com prédio, degradê escuro à esquerda e cantos arredondados; mapa azul sem fundo; ícone de raio navy sem fundo.

- [ ] **Step 6: Baixar a fonte Manrope e a licença**

```bash
for w in 400 600 700 800; do curl -sfL -o public/fonts/manrope-$w.ttf "https://cdn.jsdelivr.net/fontsource/fonts/manrope@latest/latin-$w-normal.ttf"; done
curl -sfL -o public/fonts/OFL.txt "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt"
ls -la public/fonts
```

Expected: 4 arquivos `.ttf` de ~36 KB e `OFL.txt` com alguns KB.

- [ ] **Step 7: Tirar as fontes do matcher do middleware**

Modify `middleware.ts`, linha do matcher:

```ts
    // Todas as rotas, exceto estáticos, imagens e fontes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2)$).*)",
```

- [ ] **Step 8: Registrar os ajustes na spec**

Em `docs/superpowers/specs/2026-10-01-documento-modelo-a-v2-design.md`, acrescentar ao fim:

```markdown
## Ajustes do plano (2026-10-01)

- **Quem somos no Word:** tabela nativa (foto, mapa e números em texto), no
  lugar de imagem única. Fica editável e não duplica os números.
  `quem-somos.png` não existe.
- **Metodologia:** foto, degradê e cantos vêm prontos em
  `public/documento/metodologia.png` (gerado por
  `scripts/documento/rasterizar.mjs`); não há `predio-blueprint.png` em
  `public/`.
- **Prévia:** `DocumentData` não traz dados da empresa. O rodapé usa
  `EMPRESA_PADRAO`, e a prévia não mostra a imagem de assinatura nem os dados
  bancários.
- **Middleware:** `.ttf`, `.woff` e `.woff2` saem do matcher, para a fonte
  carregar como estático.
- **Medidas:** área útil das páginas internas de 27 mm a 276 mm do topo.
- **Revisão da IEX (01/10/2026):** "Quem somos" com o texto institucional da
  IEX abaixo do painel (sem título nem resumo no painel); ordem Capa → Quem
  somos → Metodologia (Como trabalhamos, Nossas especialidades) →
  Apresentação + Dados + Escopo → Condições; "Etapas deste projeto" removida.
```

- [ ] **Step 9: Commit**

```bash
git add scripts/documento public/documento public/fonts middleware.ts docs/superpowers/specs/2026-10-01-documento-modelo-a-v2-design.md
git commit -m "$(cat <<'EOF'
feat(documento): imagens, ícones e fonte Manrope do layout Modelo A v2

Script de rasterização gera os PNG de public/documento a partir das fontes
em scripts/documento/fontes. Middleware deixa de interceptar fontes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Módulo de layout (`layout-a.ts`)

**Files:**
- Create: `lib/document/layout-a.ts`
- Test: `lib/document/layout-a.test.ts`

**Interfaces:**
- Consumes: `PropostaDoc`, `EmpresaDoc` (`lib/document/tipos.ts`); `DadosBancarios` (`lib/db/types.ts`).
- Produces:
  - `PALETA` (objeto `as const` de strings hex)
  - `INSTITUCIONAL` (ver código)
  - `ICONES` (tupla), `type IconeId`
  - `APRESENTACAO_PADRAO: string`, `RODAPE_PADRAO: string`, `EMPRESA_PADRAO: { razaoSocial: string; endereco: string; telefone: string }`
  - `tituloCapa(empreendimento: string): string[]`
  - `subtituloCapa(itens: { disciplina: string }[]): string`
  - `iconeDisciplina(nome: string): IconeId`
  - `percentual(valor: number, total: number): number`
  - `formatarPercentual(p: number): string`
  - `rotuloParcela(desc: string): string`
  - `formatarArea(area: number): string`
  - `fichaEmpreendimento(doc: Pick<PropostaDoc, "cliente"|"contato"|"tipo"|"cidade"|"uf"|"area"|"itens">): [string, string][]`
  - `linhasBancarias(b: DadosBancarios | null | undefined): string[]`
  - `contatoRodape(e: { razaoSocial?: string; endereco?: string; telefone?: string }): string`
  - `dataPorExtenso(d: Date): string`, `mesAno(d: Date): string`
  - `interface BlocoPaginavel { altura: number; quebraAntes?: boolean; manterComProximo?: boolean }`
  - `paginar(blocos: BlocoPaginavel[], alturaUtil: number): number[][]`

- [ ] **Step 1: Escrever os testes**

Create `lib/document/layout-a.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  contatoRodape, dataPorExtenso, EMPRESA_PADRAO, fichaEmpreendimento, formatarPercentual, iconeDisciplina,
  linhasBancarias, mesAno, paginar, percentual, rotuloParcela, subtituloCapa, tituloCapa,
} from "./layout-a"

describe("tituloCapa", () => {
  it("quebra o empreendimento no travessão", () => {
    expect(tituloCapa("Clínica Vida Plena — Unidade Aldeota")).toEqual(["Clínica Vida Plena", "Unidade Aldeota"])
  })
  it("mantém uma linha quando não há travessão", () => {
    expect(tituloCapa("Residencial Aurora")).toEqual(["Residencial Aurora"])
  })
  it("usa um título genérico quando vazio", () => {
    expect(tituloCapa("   ")).toEqual(["Proposta comercial"])
  })
})

describe("subtituloCapa", () => {
  it("lista as disciplinas sem prefixos, com 'e' antes da última", () => {
    expect(
      subtituloCapa([{ disciplina: "Instalações elétricas" }, { disciplina: "Hidráulica" }, { disciplina: "SPDA" }]),
    ).toBe("Projetos executivos de: elétricas, hidráulica e SPDA.")
  })
  it("tira 'Prevenção e combate a' e trata uma disciplina só", () => {
    expect(subtituloCapa([{ disciplina: "Prevenção e combate a incêndio" }])).toBe("Projetos executivos de: incêndio.")
  })
  it("cai num texto genérico sem disciplinas", () => {
    expect(subtituloCapa([])).toBe("Projetos executivos de engenharia.")
  })
})

describe("iconeDisciplina", () => {
  it.each([
    ["Instalações elétricas", "eletrica"],
    ["Hidráulica", "hidraulica"],
    ["Hidrossanitário", "hidraulica"],
    ["Sanitária", "sanitaria"],
    ["Águas pluviais", "sanitaria"],
    ["Prevenção e combate a incêndio", "incendio"],
    ["Climatização", "climatizacao"],
    ["Exaustão de cozinhas", "climatizacao"],
    ["SPDA", "spda"],
    ["CFTV", "dados"],
    ["Rede de gases medicinais", "gas"],
    ["Estrutural", "estrutura"],
    ["Fotovoltaica", "fotovoltaica"],
    ["Paisagismo", "generico"],
  ])("%s → %s", (nome, id) => {
    expect(iconeDisciplina(nome)).toBe(id)
  })
})

describe("percentuais e parcelas", () => {
  it("calcula o percentual com uma casa", () => {
    expect(percentual(30400, 123160)).toBe(24.7)
    expect(percentual(10, 0)).toBe(0)
  })
  it("formata o percentual em pt-BR", () => {
    expect(formatarPercentual(24.7)).toBe("24,7%")
    expect(formatarPercentual(30)).toBe("30%")
  })
  it("tira o percentual que já vem na descrição da parcela", () => {
    expect(rotuloParcela("Assinatura do contrato (30%)")).toBe("Assinatura do contrato")
    expect(rotuloParcela("Entrega do executivo (marco — 40%)")).toBe("Entrega do executivo · marco")
    expect(rotuloParcela("Conforme combinado")).toBe("Conforme combinado")
  })
})

describe("fichaEmpreendimento", () => {
  const base = { cliente: "Grupo Vida", contato: "Mariana", tipo: "Clínica", cidade: "Fortaleza", uf: "CE", area: 1850, itens: [{ disciplina: "A", valor: 1 }, { disciplina: "B", valor: 1 }] }
  it("monta os seis campos", () => {
    expect(fichaEmpreendimento(base)).toEqual([
      ["Cliente", "Grupo Vida"], ["Contato", "Mariana"], ["Tipologia", "Clínica"],
      ["Localização", "Fortaleza/CE"], ["Área total", "1.850 m²"], ["Disciplinas", "2 projetos"],
    ])
  })
  it("omite campos vazios e área zero", () => {
    expect(fichaEmpreendimento({ ...base, contato: " ", area: 0, cidade: "", uf: "", itens: [{ disciplina: "A", valor: 1 }] })).toEqual([
      ["Cliente", "Grupo Vida"], ["Tipologia", "Clínica"], ["Disciplinas", "1 projeto"],
    ])
  })
})

describe("linhasBancarias e contatoRodape", () => {
  it("monta as linhas só com o que existe", () => {
    expect(linhasBancarias(null)).toEqual([])
    expect(linhasBancarias({ banco: "Banco do Brasil", agencia: "1234", conta: "5678-9", pix: "00.000", favorecido: "IEX Projetos" })).toEqual([
      "Banco do Brasil", "Ag. 1234 · C/C 5678-9", "PIX 00.000", "IEX Projetos",
    ])
    expect(linhasBancarias({ pix: "chave" })).toEqual(["PIX chave"])
  })
  it("completa o rodapé com os dados padrão da IEX", () => {
    expect(contatoRodape({ razaoSocial: "", endereco: "", telefone: "" })).toBe(
      `${EMPRESA_PADRAO.razaoSocial} · ${EMPRESA_PADRAO.endereco} · ${EMPRESA_PADRAO.telefone}`,
    )
    expect(contatoRodape({ razaoSocial: "IEX X", endereco: "Rua A", telefone: "1" })).toBe("IEX X · Rua A · 1")
  })
})

describe("datas", () => {
  const d = new Date(2026, 8, 28)
  it("escreve a data por extenso", () => expect(dataPorExtenso(d)).toBe("28 de setembro de 2026"))
  it("escreve mês/ano", () => expect(mesAno(d)).toBe("setembro/2026"))
})

describe("paginar", () => {
  it("põe tudo numa página quando cabe", () => {
    expect(paginar([{ altura: 50 }, { altura: 50 }, { altura: 50 }], 200)).toEqual([[0, 1, 2]])
  })
  it("abre página nova quando o bloco não cabe", () => {
    expect(paginar([{ altura: 120 }, { altura: 100 }], 200)).toEqual([[0], [1]])
  })
  it("respeita quebraAntes sem criar página vazia", () => {
    expect(paginar([{ altura: 10, quebraAntes: true }, { altura: 10, quebraAntes: true }], 200)).toEqual([[0], [1]])
  })
  it("leva o título junto com o bloco seguinte", () => {
    expect(paginar([{ altura: 180 }, { altura: 13, manterComProximo: true }, { altura: 30 }], 200)).toEqual([[0], [1, 2]])
  })
  it("dá uma página só ao bloco maior que a área útil", () => {
    expect(paginar([{ altura: 10 }, { altura: 300 }, { altura: 10 }], 200)).toEqual([[0], [1], [2]])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/document/layout-a.test.ts`
Expected: FAIL, `Failed to resolve import "./layout-a"`.

- [ ] **Step 3: Implementar**

Create `lib/document/layout-a.ts`:

```ts
import type { DadosBancarios } from "@/lib/db/types"
import type { PropostaDoc } from "./tipos"

// Layout "Modelo A v2" do documento da proposta (spec 2026-10-01). Fonte
// única de paleta, conteúdo institucional fixo e regras puras usadas pelo PDF
// (pdf.ts), pela prévia (document-preview.tsx) e pelo Word (word.ts). Nada
// aqui depende de jsPDF, docx ou React.

export const PALETA = {
  navyCapa: "#0f1c33",
  navy: "#1f3152",
  painel: "#172b4d",
  dourado: "#c09a55",
  douradoSuave: "#f3ebdc",
  azulClaro: "#75c2e3",
  tinta: "#1d2433",
  cinza: "#6b7486",
  cinzaClaro: "#a5aab4",
  texto: "#3b4456",
  textoCard: "#4a5366",
  linha: "#e3e7ee",
  faixa: "#f4f6fa",
  branco: "#ffffff",
  suaveNoNavy: "#b7c0cf",
  suaveNoPainel: "#c4cad6",
  divisorPainel: "#34466a",
  bordaChip: "#4a5670",
  verde: "#2f7d5b",
  vermelho: "#b0564a",
} as const

export const ICONES = [
  "eletrica", "hidraulica", "sanitaria", "incendio", "climatizacao", "spda", "dados", "gas",
  "estrutura", "fotovoltaica", "generico", "bim", "quantitativos", "aprovacoes",
] as const
export type IconeId = (typeof ICONES)[number]

// Conteúdo fixo da IEX (decisão da spec: trocar exige deploy).
export const INSTITUCIONAL = {
  // Texto enviado pela IEX (revisão de 01/10/2026). "assim" → "assinam".
  quemSomos: [
    "Em 2013 nasceu a IEX PROJETOS, a união do pai Alderi Sousa com o filho João Paulo, com a proposta de levar ao mercado uma empresa que entregue ao cliente solução completa em projetos de instalações de forma rápida, segura e compatibilizada, e com agilidade gerando menor custo e velocidade nas obras de forma responsável.",
    "A IEX traz o conceito de Solidez, Qualidade, Credibilidade e Inovação em cada projeto que seus profissionais assinam, pois é formada por engenheiros projetistas especializados em cada disciplina, iniciando desde os projetos de terraplenagem, até os projetos de climatização. Todos os projetos são desenvolvidos e pensados em levar aos clientes eficiência e economia em suas obras.",
  ],
  socios: "Alderi Sousa e João Paulo",
  sociosLegenda: "Sócios fundadores",
  numeros: [
    { prefixo: "+ de", valor: "1.400", rotulo: "Projetos aprovados" },
    { prefixo: "", valor: "32", rotulo: "Hospitais e clínicas" },
    { prefixo: "+ de", valor: "600", rotulo: "Lojas em 36 shopping centers" },
  ],
  metodologiaChamada: "100% dos projetos nascem em BIM",
  diferenciais: [
    { icone: "bim", titulo: "BIM integrado", texto: "Todas as disciplinas no mesmo modelo: interferências resolvidas antes da obra." },
    { icone: "quantitativos", titulo: "Quantitativos precisos", texto: "Planilhas de materiais que viram base para orçamento, compras e controle de custo." },
    { icone: "aprovacoes", titulo: "Aprovações", texto: "Aprovação junto à CAGECE, à ENEL e ao Corpo de Bombeiros." },
  ],
  especialidades: [
    { titulo: "Instalações elétricas", itens: ["Baixa tensão e IT médico", "Subestações aéreas e abrigadas", "Redes de distribuição", "SPDA, dados e CFTV"] },
    { titulo: "Instalações civis", itens: ["Hidrossanitário", "Tratamento de água e esgoto", "Combate a incêndio com aprovação nos bombeiros"] },
    { titulo: "Instalações mecânicas", itens: ["Ar-condicionado", "Exaustão de cozinhas", "Redes de gases combustíveis e medicinais"] },
    { titulo: "Estruturas", itens: ["Concreto armado", "Alvenaria estrutural", "Estruturas metálicas", "Estruturas em madeira"] },
  ],
} as const satisfies {
  diferenciais: readonly { icone: IconeId; titulo: string; texto: string }[]
  [k: string]: unknown
}

export const APRESENTACAO_PADRAO =
  "Apresentamos a seguir o preço e as condições comerciais e técnicas para a elaboração dos projetos executivos de engenharia da obra em referência."
export const RODAPE_PADRAO = "Powered by YRM Strategy Lab"
export const EMPRESA_PADRAO = {
  razaoSocial: "IEX Projetos",
  endereco: "Rua Monsenhor Bruno, 1153, Salas 804/806 — Aldeota, Fortaleza/CE",
  telefone: "(85) 99921-8630",
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function tituloCapa(empreendimento: string): string[] {
  const partes = (empreendimento ?? "").split(" — ").map((p) => p.trim()).filter(Boolean)
  return partes.length ? partes : ["Proposta comercial"]
}

const PREFIXOS = [/^instala[cç][aã]o(es)?\s+/i, /^instala[cç][oõ]es\s+/i, /^projetos?\s+de\s+/i, /^preven[cç][aã]o\s+e\s+combate\s+a\s+/i]

function nomeCurto(disciplina: string): string {
  let nome = disciplina.trim()
  for (const p of PREFIXOS) nome = nome.replace(p, "")
  // Siglas (SPDA, CFTV) ficam em caixa alta; o resto começa minúsculo.
  return /^[A-Z0-9]{2,}\b/.test(nome) ? nome : nome.charAt(0).toLowerCase() + nome.slice(1)
}

export function subtituloCapa(itens: { disciplina: string }[]): string {
  const nomes = itens.map((i) => nomeCurto(i.disciplina)).filter(Boolean)
  if (!nomes.length) return "Projetos executivos de engenharia."
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
  return `Projetos executivos de: ${lista}.`
}

// A ordem importa: "hidrossanitário" é hidráulica, "águas pluviais" é
// sanitária, "rede de gases" é gás.
const REGRAS_ICONE: [RegExp, IconeId][] = [
  [/spda/, "spda"],
  [/fotovolt|solar/, "fotovoltaica"],
  [/cftv|dados|telecom|logic/, "dados"],
  [/\bgas\b|gases|glp/, "gas"],
  [/hidross/, "hidraulica"],
  [/sanit|esgoto|pluvia|drenag/, "sanitaria"],
  [/hidraul|agua/, "hidraulica"],
  [/incend|bombeir|alarme/, "incendio"],
  [/climat|ar.condicionado|exaust|ventila/, "climatizacao"],
  [/eletric|subesta|luminot/, "eletrica"],
  [/estrut|fundac|sondag|concreto/, "estrutura"],
]

export function iconeDisciplina(nome: string): IconeId {
  const n = semAcento(nome ?? "")
  return REGRAS_ICONE.find(([re]) => re.test(n))?.[1] ?? "generico"
}

export function percentual(valor: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((valor / total) * 1000) / 10
}

export function formatarPercentual(p: number): string {
  return `${p.toLocaleString("pt-BR")}%`
}

// As parcelas salvas já trazem o percentual na descrição ("... (30%)"). O
// layout mostra o percentual numa etiqueta, então ele sai do rótulo.
export function rotuloParcela(desc: string): string {
  const marco = /\(marco\s*—\s*[\d.,]+%\)\s*$/i.test(desc)
  const limpo = desc.replace(/\s*\((?:marco\s*—\s*)?[\d.,]+%\)\s*$/i, "").trim()
  return marco ? `${limpo} · marco` : limpo
}

export function formatarArea(area: number): string {
  return `${area.toLocaleString("pt-BR")} m²`
}

export function fichaEmpreendimento(
  doc: Pick<PropostaDoc, "cliente" | "contato" | "tipo" | "cidade" | "uf" | "area" | "itens">,
): [string, string][] {
  const n = doc.itens.length
  const campos: [string, string][] = [
    ["Cliente", doc.cliente ?? ""],
    ["Contato", doc.contato ?? ""],
    ["Tipologia", doc.tipo ?? ""],
    ["Localização", [doc.cidade, doc.uf].filter((v) => v?.trim()).join("/")],
    ["Área total", doc.area > 0 ? formatarArea(doc.area) : ""],
    ["Disciplinas", n > 0 ? `${n} ${n === 1 ? "projeto" : "projetos"}` : ""],
  ]
  return campos.filter(([, v]) => v.trim())
}

export function linhasBancarias(b: DadosBancarios | null | undefined): string[] {
  if (!b) return []
  const conta = [b.agencia && `Ag. ${b.agencia}`, b.conta && `C/C ${b.conta}`].filter(Boolean).join(" · ")
  return [b.banco, conta, b.pix && `PIX ${b.pix}`, b.favorecido].filter((v): v is string => !!v && !!v.trim())
}

export function contatoRodape(e: { razaoSocial?: string; endereco?: string; telefone?: string }): string {
  return [
    e.razaoSocial?.trim() || EMPRESA_PADRAO.razaoSocial,
    e.endereco?.trim() || EMPRESA_PADRAO.endereco,
    e.telefone?.trim() || EMPRESA_PADRAO.telefone,
  ].join(" · ")
}

export function dataPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
}

export function mesAno(d: Date): string {
  return `${d.toLocaleDateString("pt-BR", { month: "long" })}/${d.getFullYear()}`
}

export interface BlocoPaginavel {
  altura: number
  quebraAntes?: boolean
  manterComProximo?: boolean
}

// Distribui blocos de altura conhecida em páginas. Um bloco que não cabe
// abre página nova; `manterComProximo` exige espaço para o bloco e para os
// seguintes da cadeia (título nunca fica órfão); um bloco maior que a área
// útil ocupa uma página sozinho.
export function paginar(blocos: BlocoPaginavel[], alturaUtil: number): number[][] {
  const paginas: number[][] = []
  let atual: number[] = []
  let usado = 0
  const fechar = () => {
    if (atual.length) paginas.push(atual)
    atual = []
    usado = 0
  }
  blocos.forEach((bloco, i) => {
    if (bloco.quebraAntes) fechar()
    let exigida = bloco.altura
    for (let j = i; blocos[j]?.manterComProximo && blocos[j + 1] && !blocos[j + 1].quebraAntes; j++) {
      exigida += blocos[j + 1].altura
    }
    if (atual.length && usado + exigida > alturaUtil) fechar()
    atual.push(i)
    usado += bloco.altura
    if (usado > alturaUtil) fechar()
  })
  fechar()
  return paginas
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/document/layout-a.test.ts`
Expected: PASS, todos os testes.

- [ ] **Step 5: Commit**

```bash
git add lib/document/layout-a.ts lib/document/layout-a.test.ts
git commit -m "$(cat <<'EOF'
feat(documento): módulo de layout Modelo A v2 (paleta, institucional, paginação)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Carregador de recursos e fixtures de teste

**Files:**
- Create: `lib/document/recursos.ts`
- Create: `test/recursos-documento.ts`
- Create: `test/documento-exemplo.ts`
- Test: `lib/document/recursos.test.ts`

**Interfaces:**
- Consumes: `ICONES`, `IconeId` (Task 2); arquivos do Task 1.
- Produces:
  - `type PesoFonte = "regular" | "semibold" | "bold" | "extrabold"`
  - `interface RecursosDoc { fontes: Record<PesoFonte, string> | null; imagens: { logoBranco: string | null; socios: string | null; mapa: string | null; metodologia: string | null; capaRede: string | null; capaWord: string | null }; icones: Partial<Record<IconeId, string>> }`. Fontes em base64 (TTF); imagens e ícones em data URL PNG.
  - `CAMINHO_IMAGEM: Record<keyof RecursosDoc["imagens"], string>`, `CAMINHO_ICONE(id: IconeId): string`, `CAMINHO_FONTE(p: PesoFonte): string`, `PESOS`
  - `carregarRecursos(): Promise<RecursosDoc>` (navegador)
  - `RECURSOS_VAZIOS: RecursosDoc`
  - `recursosDoDisco(o: { fontes: boolean }): RecursosDoc` (`test/recursos-documento.ts`)
  - `docExemplo(parcial?: Partial<PropostaDoc>): PropostaDoc`, `empresaExemplo(parcial?: Partial<EmpresaDoc>): EmpresaDoc`, `itensExemplo(n: number)` (`test/documento-exemplo.ts`)

- [ ] **Step 1: Escrever o teste**

Create `lib/document/recursos.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { recursosDoDisco } from "@/test/recursos-documento"
import { ICONES } from "./layout-a"

describe("recursos do documento", () => {
  it("encontra fonte, imagens e todos os ícones em public/", () => {
    const r = recursosDoDisco({ fontes: true })
    expect(r.fontes).not.toBeNull()
    for (const peso of ["regular", "semibold", "bold", "extrabold"] as const) expect(r.fontes![peso].length).toBeGreaterThan(1000)
    for (const [nome, url] of Object.entries(r.imagens)) expect(url, nome).toMatch(/^data:image\/png;base64,/)
    for (const id of ICONES) expect(r.icones[id], id).toMatch(/^data:image\/png;base64,/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/document/recursos.test.ts`
Expected: FAIL, `Failed to resolve import "@/test/recursos-documento"`.

- [ ] **Step 3: Implementar o carregador**

Create `lib/document/recursos.ts`:

```ts
import { ICONES, type IconeId } from "./layout-a"

// Fonte e imagens fixas do documento (public/fonts, public/documento). No
// navegador são buscadas uma vez por sessão; um arquivo que falha vira null e
// o gerador segue sem ele (spec §3). Nos testes, ver test/recursos-documento.ts.

export type PesoFonte = "regular" | "semibold" | "bold" | "extrabold"
export const PESOS: Record<PesoFonte, number> = { regular: 400, semibold: 600, bold: 700, extrabold: 800 }

export interface RecursosDoc {
  // TTF em base64 por peso; null quando algum falhou (o PDF cai para Helvetica).
  fontes: Record<PesoFonte, string> | null
  // Data URLs PNG.
  imagens: {
    logoBranco: string | null
    socios: string | null
    mapa: string | null
    metodologia: string | null
    capaRede: string | null
    capaWord: string | null
  }
  icones: Partial<Record<IconeId, string>>
}

export const CAMINHO_FONTE = (peso: PesoFonte) => `/fonts/manrope-${PESOS[peso]}.ttf`
export const CAMINHO_IMAGEM: Record<keyof RecursosDoc["imagens"], string> = {
  logoBranco: "/documento/logo-branco.png",
  socios: "/documento/socios.png",
  mapa: "/documento/mapa-brasil.png",
  metodologia: "/documento/metodologia.png",
  capaRede: "/documento/capa-rede.png",
  capaWord: "/documento/capa-word.png",
}
export const CAMINHO_ICONE = (id: IconeId) => `/documento/icones/${id}.png`

export const RECURSOS_VAZIOS: RecursosDoc = {
  fontes: null,
  imagens: { logoBranco: null, socios: null, mapa: null, metodologia: null, capaRede: null, capaWord: null },
  icones: {},
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function buscarBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return bytesParaBase64(new Uint8Array(await resp.arrayBuffer()))
  } catch {
    return null
  }
}

async function buscarPng(url: string): Promise<string | null> {
  const b64 = await buscarBase64(url)
  return b64 ? `data:image/png;base64,${b64}` : null
}

async function montar(): Promise<RecursosDoc> {
  const pesos = Object.keys(PESOS) as PesoFonte[]
  const chaves = Object.keys(CAMINHO_IMAGEM) as (keyof RecursosDoc["imagens"])[]
  const [fontes, imagens, icones] = await Promise.all([
    Promise.all(pesos.map((p) => buscarBase64(CAMINHO_FONTE(p)))),
    Promise.all(chaves.map((k) => buscarPng(CAMINHO_IMAGEM[k]))),
    Promise.all(ICONES.map((id) => buscarPng(CAMINHO_ICONE(id)))),
  ])
  return {
    fontes: fontes.every(Boolean) ? (Object.fromEntries(pesos.map((p, i) => [p, fontes[i]])) as Record<PesoFonte, string>) : null,
    imagens: Object.fromEntries(chaves.map((k, i) => [k, imagens[i]])) as RecursosDoc["imagens"],
    icones: Object.fromEntries(ICONES.flatMap((id, i) => (icones[i] ? [[id, icones[i]]] : []))),
  }
}

let cache: Promise<RecursosDoc> | null = null

// Só guarda em cache um carregamento completo: uma falha de rede passageira
// não deixa a sessão inteira sem fonte ou imagem.
export function carregarRecursos(): Promise<RecursosDoc> {
  if (!cache) {
    cache = montar().then((r) => {
      const completo = r.fontes && Object.values(r.imagens).every(Boolean) && ICONES.every((id) => r.icones[id])
      if (!completo) cache = null
      return r
    })
  }
  return cache
}
```

- [ ] **Step 4: Implementar os ajudantes de teste**

Create `test/recursos-documento.ts`:

```ts
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { ICONES } from "@/lib/document/layout-a"
import { CAMINHO_FONTE, CAMINHO_ICONE, CAMINHO_IMAGEM, PESOS, type PesoFonte, type RecursosDoc } from "@/lib/document/recursos"

// Lê de public/ os mesmos arquivos que carregarRecursos() busca no navegador.
const publico = fileURLToPath(new URL("../public", import.meta.url))
const base64 = (caminho: string) => readFileSync(publico + caminho).toString("base64")
const png = (caminho: string) => `data:image/png;base64,${base64(caminho)}`

export function recursosDoDisco(o: { fontes: boolean }): RecursosDoc {
  const pesos = Object.keys(PESOS) as PesoFonte[]
  return {
    fontes: o.fontes ? (Object.fromEntries(pesos.map((p) => [p, base64(CAMINHO_FONTE(p))])) as Record<PesoFonte, string>) : null,
    imagens: Object.fromEntries(
      Object.entries(CAMINHO_IMAGEM).map(([k, caminho]) => [k, png(caminho)]),
    ) as RecursosDoc["imagens"],
    icones: Object.fromEntries(ICONES.map((id) => [id, png(CAMINHO_ICONE(id))])),
  }
}
```

Create `test/documento-exemplo.ts`:

```ts
import type { EmpresaDoc, PropostaDoc } from "@/lib/document/tipos"

// Proposta do Modelo A v2 (total R$ 123.160,00), usada pelos testes de PDF,
// Word e prévia.
export function docExemplo(parcial: Partial<PropostaDoc> = {}): PropostaDoc {
  return {
    numero: "20260928-01",
    versao: 1,
    apresentacao:
      "A IEX Projetos apresenta a proposta técnica e comercial para a elaboração dos projetos executivos de instalações da Clínica Vida Plena. O escopo foi dimensionado a partir do programa de necessidades e do estudo arquitetônico recebidos, com foco em desempenho, segurança e compatibilização entre as disciplinas.",
    cliente: "Grupo Vida Plena Saúde",
    contato: "Dra. Mariana Queiroz",
    empreendimento: "Clínica Vida Plena — Unidade Aldeota",
    cidade: "Fortaleza",
    uf: "CE",
    area: 1850,
    tipo: "Clínica",
    itens: [
      { disciplina: "Instalações elétricas", valor: 30400, escopo: ["Iluminação e tomadas de uso geral e específico.", "Alimentadores de máquinas e climatização.", "Alimentadores e diagramas de quadros elétricos."] },
      { disciplina: "Hidráulica", valor: 23040, escopo: ["Rede de distribuição de água fria.", "Caixas d’água, cisternas e pontos de consumo.", "Registros e dispositivos hidráulicos."] },
      { disciplina: "Prevenção e combate a incêndio", valor: 27500, escopo: ["Rede de detecção e alarme.", "Iluminação de emergência.", "Hidrantes, extintores e rotas de fuga."] },
      { disciplina: "Climatização", valor: 39000, escopo: ["Definição de equipamentos.", "Rede de tubulações frigoríferas.", "Drenos e pontos de alimentação específicos."] },
      { disciplina: "SPDA", valor: 3220, escopo: ["Malha de captação e descidas.", "Aterramentos.", "Equipamentos e conexões."] },
    ],
    total: 123160,
    formaPagamento: "Parcelado por etapa",
    parcelas: [
      { desc: "Assinatura do contrato (30%)", valor: 36948 },
      { desc: "Entrega do anteprojeto (40%)", valor: 49264 },
      { desc: "Entrega do projeto executivo (30%)", valor: 36948 },
    ],
    prazoExecucao: "45 dias úteis",
    validade: "15 dias",
    // Listas enviadas pela IEX (revisão de 01/10/2026).
    premissas: [
      "Projeto executivo detalhado em REVIT, com esquemático das instalações.",
      "Memorial técnico descritivo e lista de materiais por disciplina.",
      "Entrega de ficheiros editáveis em suporte digital, nas versões DWG, PDF e IFC.",
      "Fornecimento de ART (Anotação de Responsabilidade Técnica) junto ao CREA – CE.",
    ],
    exclusoes: [
      "Relatório de estudo do solo para desenvolvimento do projeto de cálculo estrutural.",
      "Projeto luminotécnico para desenvolvimento do projeto de instalações elétricas.",
      "Taxas e os processos de aprovação em órgãos fiscalizadores.",
      "Acompanhamento de obra e execução.",
    ],
    observacoes: "",
    responsavel: "Alderi Sousa",
    assinaturaNome: "Alderi Sousa",
    assinaturaCargo: "Diretor Comercial",
    ...parcial,
  }
}

export function itensExemplo(n: number): PropostaDoc["itens"] {
  return Array.from({ length: n }, (_, i) => ({
    disciplina: `Disciplina ${i + 1}`,
    valor: 1000 * (i + 1),
    escopo: ["Primeiro item do escopo.", "Segundo item do escopo.", "Terceiro item do escopo.", "Quarto item do escopo."],
  }))
}

export function empresaExemplo(parcial: Partial<EmpresaDoc> = {}): EmpresaDoc {
  return {
    razaoSocial: "IEX Projetos",
    cnpj: "45.546.897/0001-91",
    endereco: "Rua Monsenhor Bruno, 1153, Salas 804/806 — Aldeota, Fortaleza/CE",
    telefone: "(85) 99921-8630",
    email: "alderi@iexprojetos.com",
    textoRodape: "",
    dadosBancarios: { banco: "Banco do Brasil", agencia: "0000-0", conta: "00000-0", pix: "45.546.897/0001-91", favorecido: "IEX Projetos" },
    logoDataUrl: null,
    assinaturaDataUrl: null,
    corPrimaria: null,
    corSecundaria: null,
    ...parcial,
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run lib/document/recursos.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/document/recursos.ts lib/document/recursos.test.ts test/recursos-documento.ts test/documento-exemplo.ts
git commit -m "$(cat <<'EOF'
feat(documento): carregador de fonte e imagens do documento, com fixtures de teste

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: PDF no layout Modelo A v2

**Files:**
- Rewrite: `lib/document/pdf.ts`
- Test: `lib/document/pdf.test.ts`
- Modify: `app/propostas/page.tsx:269,722`, `app/propostas/nova/page.tsx:1141,1181`, `components/proposal-drawer.tsx:135,160`

**Interfaces:**
- Consumes: tudo do Task 2 e do Task 3; `assinaturaDoDocumento`, `brl` (`tipos.ts`); `hexParaRgb` (`util.ts`); `identificacaoDocumento`.
- Produces:
  - `montarPdf(doc: PropostaDoc, empresa: EmpresaDoc, recursos: RecursosDoc): jsPDF` (síncrono, testável)
  - `gerarPdf(doc: PropostaDoc, empresa: EmpresaDoc, recursos?: RecursosDoc): Promise<Blob>` (**agora assíncrono**)

- [ ] **Step 1: Escrever os testes**

Create `lib/document/pdf.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { docExemplo, empresaExemplo, itensExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { montarPdf } from "./pdf"
import { RECURSOS_VAZIOS } from "./recursos"

// Sem a fonte embutida o jsPDF escreve o texto literal (Helvetica), o que
// permite procurar strings no PDF cru.
const semFonte = () => recursosDoDisco({ fontes: false })

describe("montarPdf", () => {
  // Capa, Quem somos, Metodologia, Apresentação + escopo, resto do escopo +
  // total, Condições.
  it("gera 6 páginas para a proposta de exemplo", () => {
    expect(montarPdf(docExemplo(), empresaExemplo(), semFonte()).getNumberOfPages()).toBe(6)
  })

  it("escreve valores com centavos, a marca e o rodapé YRM", () => {
    const cru = montarPdf(docExemplo(), empresaExemplo(), semFonte()).output()
    expect(cru).toContain("123.160,00")
    expect(cru).toContain("30.400,00")
    expect(cru).toContain("36.948,00")
    expect(cru).toContain("IEX Projetos")
    expect(cru).toContain("Powered by YRM Strategy Lab")
    expect(cru).toContain("1.400")
    expect(cru).toContain("Credibilidade")
  })

  it("usa o texto de rodapé configurado no lugar do YRM padrão", () => {
    const cru = montarPdf(docExemplo(), empresaExemplo({ textoRodape: "Rodapé próprio" }), semFonte()).output()
    expect(cru).toContain("Rodap")
    expect(cru).not.toContain("Powered by YRM Strategy Lab")
  })

  it("leva o escopo para mais páginas com 12 disciplinas", () => {
    const itens = itensExemplo(12)
    const doc = docExemplo({ itens, total: itens.reduce((s, i) => s + i.valor, 0) })
    const curto = montarPdf(docExemplo(), empresaExemplo(), semFonte()).getNumberOfPages()
    expect(montarPdf(doc, empresaExemplo(), semFonte()).getNumberOfPages()).toBeGreaterThan(curto)
  })

  it("aceita proposta sem parcelas, premissas, exclusões e dados bancários", () => {
    const doc = docExemplo({ parcelas: [], premissas: [], exclusoes: [], observacoes: "Prazo conta a partir do recebimento do arquitetônico." })
    const cru = montarPdf(doc, empresaExemplo({ dadosBancarios: null }), semFonte()).output()
    expect(cru).toContain("Parcelado por etapa")
    expect(cru).toContain("Observa")
  })

  it("embute a Manrope quando a fonte está disponível", () => {
    const pdf = montarPdf(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: true }))
    expect(pdf.getNumberOfPages()).toBe(6)
    expect(pdf.output()).toContain("Manrope")
  })

  it("não falha sem nenhuma imagem nem fonte", () => {
    expect(montarPdf(docExemplo(), empresaExemplo(), RECURSOS_VAZIOS).getNumberOfPages()).toBe(6)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/document/pdf.test.ts`
Expected: FAIL, `montarPdf is not a function` (ou não exportado).

- [ ] **Step 3: Reescrever `lib/document/pdf.ts`**

Replace todo o conteúdo de `lib/document/pdf.ts`:

```ts
import jsPDF from "jspdf"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"
import {
  APRESENTACAO_PADRAO, EMPRESA_PADRAO, INSTITUCIONAL, PALETA, RODAPE_PADRAO, contatoRodape, dataPorExtenso,
  fichaEmpreendimento, formatarArea, formatarPercentual, iconeDisciplina, linhasBancarias, mesAno, paginar,
  percentual, rotuloParcela, subtituloCapa, tituloCapa, type BlocoPaginavel,
} from "./layout-a"
import { carregarRecursos, type PesoFonte, type RecursosDoc } from "./recursos"
import { assinaturaDoDocumento, brl, type EmpresaDoc, type PropostaDoc } from "./tipos"
import { hexParaRgb } from "./util"

// PDF da proposta no layout "Modelo A v2" (spec 2026-10-01). Medidas em mm,
// as mesmas do modelo aprovado. A capa é desenhada direto; as páginas
// internas são uma lista de blocos com altura conhecida, distribuída por
// paginar() — por isso cabeçalho, rodapé e "NN / TT" saem certos em
// propostas de qualquer tamanho.

const W = 210
const M = 18
const LARG = W - 2 * M
const TOPO = 27
const BASE = 276
const PT = 0.3528 // mm por ponto tipográfico

type RGB = [number, number, number]
const rgb = (hex: string): RGB => hexParaRgb(hex) ?? [0, 0, 0]
const pad = (n: number) => String(n).padStart(2, "0")
const passo = (tam: number, lh: number) => tam * PT * lh

interface Ctx {
  pdf: jsPDF
  rec: RecursosDoc
  doc: PropostaDoc
  empresa: EmpresaDoc
  usar: (peso: PesoFonte) => void
}

interface Bloco extends BlocoPaginavel {
  secao: string
  desenhar: (y: number) => void
}

interface OpcoesTexto {
  peso?: PesoFonte
  tam: number
  cor: string
  align?: "left" | "right" | "center"
  espaco?: number // letter-spacing em em
  lh?: number
}

function registrarFontes(pdf: jsPDF, fontes: RecursosDoc["fontes"]): (peso: PesoFonte) => void {
  const helvetica = (peso: PesoFonte) => pdf.setFont("helvetica", peso === "regular" ? "normal" : "bold")
  if (!fontes) return helvetica
  try {
    for (const peso of Object.keys(fontes) as PesoFonte[]) {
      const arquivo = `manrope-${peso}.ttf`
      pdf.addFileToVFS(arquivo, fontes[peso])
      pdf.addFont(arquivo, `Manrope-${peso}`, "normal")
    }
    return (peso) => pdf.setFont(`Manrope-${peso}`, "normal")
  } catch {
    return helvetica
  }
}

function fonte(c: Ctx, peso: PesoFonte, tam: number) {
  c.usar(peso)
  c.pdf.setFontSize(tam)
}

function escrever(c: Ctx, s: string | string[], x: number, y: number, o: OpcoesTexto) {
  fonte(c, o.peso ?? "regular", o.tam)
  c.pdf.setTextColor(...rgb(o.cor))
  c.pdf.text(s, x, y, {
    align: o.align ?? "left",
    charSpace: o.espaco ? o.tam * PT * o.espaco : 0,
    lineHeightFactor: o.lh ?? 1.15,
  })
}

function quebrar(c: Ctx, s: string, largura: number, tam: number, peso: PesoFonte = "regular"): string[] {
  fonte(c, peso, tam)
  return c.pdf.splitTextToSize(s ?? "", largura) as string[]
}

function largura(c: Ctx, s: string, tam: number, peso: PesoFonte = "regular", espaco = 0): number {
  fonte(c, peso, tam)
  return c.pdf.getTextWidth(s) + (espaco ? tam * PT * espaco * s.length : 0)
}

const formatoImagem = (url: string) => (/^data:image\/jpe?g/i.test(url) ? "JPEG" : "PNG")

function proporcao(c: Ctx, url: string | null | undefined): number | null {
  if (!url) return null
  try {
    const p = c.pdf.getImageProperties(url)
    return p.height / p.width
  } catch {
    return null
  }
}

// Imagem com altura pela proporção quando `h` não vem. Imagem ausente ou
// inválida não impede o PDF.
function imagem(c: Ctx, url: string | null | undefined, alias: string, x: number, y: number, w: number, h?: number) {
  if (!url) return
  const alt = h ?? (() => { const p = proporcao(c, url); return p ? w * p : null })()
  if (!alt) return
  try {
    c.pdf.addImage(url, formatoImagem(url), x, y, w, alt, alias, "FAST")
  } catch {
    /* segue sem a imagem */
  }
}

function retangulo(c: Ctx, x: number, y: number, w: number, h: number, o: { fundo?: string; borda?: string; raio?: number }) {
  const { pdf } = c
  if (o.fundo) pdf.setFillColor(...rgb(o.fundo))
  if (o.borda) {
    pdf.setDrawColor(...rgb(o.borda))
    pdf.setLineWidth(0.25)
  }
  const estilo = o.fundo && o.borda ? "FD" : o.fundo ? "F" : "S"
  if (o.raio) pdf.roundedRect(x, y, w, h, o.raio, o.raio, estilo)
  else pdf.rect(x, y, w, h, estilo)
}

function linhaH(c: Ctx, x1: number, x2: number, y: number, cor: string = PALETA.linha, tracejada = false) {
  c.pdf.setDrawColor(...rgb(cor))
  c.pdf.setLineWidth(0.25)
  if (tracejada) c.pdf.setLineDashPattern([0.8, 0.8], 0)
  c.pdf.line(x1, y, x2, y)
  if (tracejada) c.pdf.setLineDashPattern([], 0)
}

// ── Capa ────────────────────────────────────────────────────────────────

function desenharCapa(c: Ctx) {
  const { pdf, doc } = c
  const hoje = new Date()
  // Bloco navy diagonal (0,0)-(210,0)-(210,184,14)-(0,231,66) e faixa dourada.
  pdf.setFillColor(...rgb(PALETA.navyCapa))
  pdf.lines([[W, 0], [0, 184.14], [-W, 47.52]], 0, 0, [1, 1], "F", true)
  imagem(c, c.rec.imagens.capaRede, "capa-rede", 70, 26, 150)
  pdf.setFillColor(...rgb(PALETA.dourado))
  pdf.lines([[W, -47.52], [0, 4.75], [-W, 47.52]], 0, 231.66, [1, 1], "F", true)
  imagem(c, c.rec.imagens.logoBranco, "logo-branco", M, 18, 32)

  const chip = `Proposta ${mesAno(hoje)}`.toUpperCase()
  const largChip = largura(c, chip, 7.5, "regular", 0.18) + 7
  pdf.setDrawColor(...rgb(PALETA.bordaChip))
  pdf.setLineWidth(0.25)
  pdf.roundedRect(W - M - largChip, 20, largChip, 7, 3.5, 3.5, "S")
  escrever(c, chip, W - M - largChip + 3.5, 24.7, { tam: 7.5, cor: PALETA.branco, espaco: 0.18 })

  escrever(c, "PROPOSTA TÉCNICA E COMERCIAL", M, 111, { peso: "bold", tam: 9, cor: PALETA.dourado, espaco: 0.2 })
  let titulo = tituloCapa(doc.empreendimento).flatMap((l) => quebrar(c, l, 125, 38, "extrabold"))
  if (titulo.length > 3) titulo = [...titulo.slice(0, 2), `${titulo[2]}…`]
  escrever(c, titulo, M, 127.5, { peso: "extrabold", tam: 38, cor: PALETA.branco, lh: 1.02 })
  const ySub = 127.5 + (titulo.length - 1) * passo(38, 1.02) + 10
  escrever(c, quebrar(c, subtituloCapa(doc.itens), 125, 10.5), M, ySub, { tam: 10.5, cor: PALETA.suaveNoNavy, lh: 1.6 })

  const colunas: [string, string, string][] = [
    ["Cliente", doc.cliente, doc.contato ? `A/C ${doc.contato}` : ""],
    ["Proposta", identificacaoDocumento(doc.numero, doc.versao), ""],
    ["Emitida em", dataPorExtenso(hoje), doc.validade ? `Validade: ${doc.validade}` : ""],
  ]
  const larguras = [63.2, 48.6, 48.6]
  let x = M
  colunas.forEach(([rotulo, valor, sub], i) => {
    retangulo(c, x, 265, 0.7, 14, { fundo: PALETA.dourado })
    escrever(c, rotulo.toUpperCase(), x + 4, 268.5, { tam: 7.5, cor: PALETA.cinza, espaco: 0.12 })
    escrever(c, quebrar(c, valor || "—", larguras[i] - 6, 10.5, "bold")[0] ?? "", x + 4, 274, { peso: "bold", tam: 10.5, cor: PALETA.tinta })
    if (sub) escrever(c, quebrar(c, sub, larguras[i] - 6, 8.5)[0] ?? "", x + 4, 278.5, { tam: 8.5, cor: PALETA.cinza })
    x += larguras[i] + 6
  })
}

// ── Moldura das páginas internas ───────────────────────────────────────

function desenharMoldura(c: Ctx, secao: string, n: number, total: number) {
  const { doc, empresa } = c
  retangulo(c, 0, 0, W, 15, { fundo: PALETA.navy })
  imagem(c, c.rec.imagens.logoBranco, "logo-branco", M, 2.75, 12.2)
  const rotulo = secao.toUpperCase()
  escrever(c, rotulo, W / 2 - largura(c, rotulo, 7.5, "regular", 0.16) / 2, 9.3, { tam: 7.5, cor: PALETA.branco, espaco: 0.16 })
  escrever(c, identificacaoDocumento(doc.numero, doc.versao), W - M, 9.3, { tam: 7.5, cor: PALETA.branco, align: "right" })
  linhaH(c, M, W - M, 283)
  escrever(c, quebrar(c, contatoRodape(empresa), 140, 7)[0] ?? "", M, 287.5, { tam: 7, cor: PALETA.cinza })
  escrever(c, empresa.textoRodape || RODAPE_PADRAO, M, 291.5, { tam: 6.5, cor: PALETA.cinzaClaro })
  escrever(c, `${pad(n)} / ${pad(total)}`, W - M, 287.5, { tam: 7, cor: PALETA.cinza, align: "right" })
}

function tituloSecao(c: Ctx, num: number, titulo: string, x: number, y: number, larg: number) {
  escrever(c, pad(num), x, y + 6.5, { tam: 10, cor: PALETA.dourado })
  escrever(c, titulo, x + 9, y + 6.5, { peso: "extrabold", tam: 17, cor: PALETA.navy })
  const fim = x + 9 + largura(c, titulo, 17, "extrabold") + 4
  if (fim < x + larg) linhaH(c, fim, x + larg, y + 4.6)
}

function secaoBloco(c: Ctx, secao: string, num: number, titulo: string, quebraAntes = false): Bloco {
  return { secao, altura: 13, quebraAntes, manterComProximo: true, desenhar: (y) => tituloSecao(c, num, titulo, M, y, LARG) }
}

function blocosTexto(c: Ctx, secao: string, texto: string, tam: number): Bloco[] {
  const lh = 1.65
  const linhas = quebrar(c, texto, LARG, tam)
  const porBloco = Math.max(1, Math.floor((BASE - TOPO - 20) / passo(tam, lh)))
  const blocos: Bloco[] = []
  for (let i = 0; i < linhas.length; i += porBloco) {
    const parte = linhas.slice(i, i + porBloco)
    const ultimo = i + porBloco >= linhas.length
    blocos.push({
      secao,
      altura: parte.length * passo(tam, lh) + (ultimo ? 6 : 0),
      desenhar: (y) => escrever(c, parte, M, y + tam * PT, { tam, cor: PALETA.texto, lh }),
    })
  }
  return blocos
}

function fatiar<T>(lista: T[], tamanho: number): T[][] {
  const partes: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho))
  return partes.length ? partes : [[]]
}

// ── Quem somos e apresentação ──────────────────────────────────────────

// Painel navy com foto dos sócios, mapa e números (revisão da IEX: sem título
// nem resumo dentro do painel; o texto institucional vem logo abaixo).
function blocoQuemSomos(c: Ctx, secao: string): Bloco {
  const ALT = 100
  return {
    secao,
    altura: ALT + 7,
    desenhar: (y) => {
      const { imagens } = c.rec
      retangulo(c, M, y, LARG, ALT, { fundo: PALETA.painel, raio: 3 })
      // Foto com o fundo da mesma cor do painel: encostada no pé, sem máscara.
      const propSocios = proporcao(c, imagens.socios)
      if (propSocios) imagem(c, imagens.socios, "socios", M + 4, y + ALT - 86, 86 / propSocios, 86)
      retangulo(c, M + 8, y + ALT - 17, 46, 11, { fundo: PALETA.navyCapa, raio: 1.5 })
      escrever(c, INSTITUCIONAL.socios, M + 11, y + ALT - 12.4, { peso: "bold", tam: 8, cor: PALETA.branco })
      escrever(c, INSTITUCIONAL.sociosLegenda, M + 11, y + ALT - 8.4, { tam: 7, cor: PALETA.suaveNoPainel })
      imagem(c, imagens.mapa, "mapa", M + 74, y + 18, 62)
      INSTITUCIONAL.numeros.forEach((n, i) => {
        const x = M + LARG - 36
        const t = y + 14 + i * 27
        retangulo(c, x, t, 0.7, 21, { fundo: PALETA.dourado })
        if (n.prefixo) escrever(c, n.prefixo, x + 3, t + 2.8, { tam: 7.5, cor: PALETA.suaveNoPainel })
        escrever(c, n.valor, x + 3, t + 11.8, { peso: "extrabold", tam: 24, cor: PALETA.branco })
        escrever(c, quebrar(c, n.rotulo, 26, 7.8, "semibold"), x + 3, t + 16, { peso: "semibold", tam: 7.8, cor: PALETA.azulClaro, lh: 1.3 })
      })
    },
  }
}

function blocoFicha(c: Ctx, secao: string): Bloco | null {
  const campos = fichaEmpreendimento(c.doc)
  if (!campos.length) return null
  const linhas = Math.ceil(campos.length / 3)
  const ALT = 15
  const COL = LARG / 3
  return {
    secao,
    altura: linhas * ALT + 9,
    desenhar: (y) => {
      retangulo(c, M, y, LARG, linhas * ALT, { borda: PALETA.linha, raio: 3 })
      for (let l = 1; l < linhas; l++) linhaH(c, M, M + LARG, y + l * ALT)
      campos.forEach(([rotulo, valor], i) => {
        const col = i % 3
        const x = M + col * COL
        const yy = y + Math.floor(i / 3) * ALT
        if (col > 0) {
          c.pdf.setDrawColor(...rgb(PALETA.linha))
          c.pdf.line(x, yy, x, yy + ALT)
        }
        escrever(c, rotulo.toUpperCase(), x + 5, yy + 6, { tam: 7, cor: PALETA.cinza, espaco: 0.14 })
        escrever(c, quebrar(c, valor, COL - 9, 10, "bold")[0] ?? "", x + 5, yy + 11.5, { peso: "bold", tam: 10, cor: PALETA.tinta })
      })
    },
  }
}

// ── Metodologia ────────────────────────────────────────────────────────

function blocosMetodologia(c: Ctx, num: () => number): Bloco[] {
  const secao = "Metodologia"
  const blocos: Bloco[] = [secaoBloco(c, secao, num(), "Como trabalhamos", true)]

  blocos.push({
    secao,
    altura: 65,
    desenhar: (y) => {
      imagem(c, c.rec.imagens.metodologia, "metodologia", M, y, LARG, 56)
      escrever(c, "ENGENHARIA INTEGRADA", M + 6, y + 44, { tam: 8, cor: PALETA.branco, espaco: 0.14 })
      escrever(c, INSTITUCIONAL.metodologiaChamada, M + 6, y + 50.5, { peso: "bold", tam: 13, cor: PALETA.branco })
    },
  })

  const larg3 = (LARG - 8) / 3
  const textos = INSTITUCIONAL.diferenciais.map((d) => quebrar(c, d.texto, larg3 - 10, 8.4))
  const altD = 25.5 + Math.max(...textos.map((t) => t.length)) * passo(8.4, 1.55) + 4
  blocos.push({
    secao,
    altura: altD + 9,
    desenhar: (y) => {
      INSTITUCIONAL.diferenciais.forEach((d, i) => {
        const x = M + i * (larg3 + 4)
        retangulo(c, x, y, larg3, altD, { borda: PALETA.linha, raio: 3 })
        retangulo(c, x + 5, y + 5, 9, 9, { fundo: PALETA.faixa, raio: 2 })
        imagem(c, c.rec.icones[d.icone], `icone-${d.icone}`, x + 6.8, y + 6.8, 5.4, 5.4)
        escrever(c, d.titulo, x + 5, y + 20, { peso: "bold", tam: 10.5, cor: PALETA.navy })
        escrever(c, textos[i], x + 5, y + 25.5, { tam: 8.4, cor: PALETA.textoCard, lh: 1.55 })
      })
    },
  })

  blocos.push(secaoBloco(c, secao, num(), "Nossas especialidades"))
  const larg4 = (LARG - 9) / 4
  const cartoes = INSTITUCIONAL.especialidades.map((e) => ({
    titulo: quebrar(c, e.titulo, larg4 - 9, 9.5, "bold"),
    itens: e.itens.map((it) => quebrar(c, it, larg4 - 9, 7.8)),
  }))
  const altE = Math.max(
    ...cartoes.map((k) => 7 + k.titulo.length * passo(9.5, 1.25) + 1.5 + k.itens.flat().length * passo(7.8, 1.55) + 4),
  )
  blocos.push({
    secao,
    altura: altE + 9,
    desenhar: (y) => {
      cartoes.forEach((k, i) => {
        const x = M + i * (larg4 + 3)
        retangulo(c, x, y, larg4, altE, { fundo: PALETA.faixa, raio: 3 })
        retangulo(c, x + 1.5, y, larg4 - 3, 0.7, { fundo: PALETA.dourado })
        escrever(c, k.titulo, x + 4.5, y + 7, { peso: "bold", tam: 9.5, cor: PALETA.navy, lh: 1.25 })
        let ly = y + 7 + k.titulo.length * passo(9.5, 1.25) + 1.5
        for (const linhas of k.itens) {
          escrever(c, linhas, x + 4.5, ly, { tam: 7.8, cor: PALETA.textoCard, lh: 1.55 })
          ly += linhas.length * passo(7.8, 1.55)
        }
      })
    },
  })
  return blocos
}

// ── Escopo e investimento ──────────────────────────────────────────────

// Sem quebra antes: o escopo continua na página da apresentação (revisão da
// IEX) e paginar() leva o resto para a página seguinte.
function blocosEscopo(c: Ctx, num: () => number): Bloco[] {
  const secao = "Escopo e investimento"
  const blocos: Bloco[] = [secaoBloco(c, secao, num(), "Escopo por disciplina")]
  const lh = passo(9, 1.6)
  const maxLinhas = Math.floor((BASE - TOPO - 30) / lh)

  for (const item of c.doc.itens) {
    const valor = brl(item.valor)
    const larguraTexto = M + LARG - (largura(c, valor, 11, "bold") + 5) - 34
    const titulo = quebrar(c, item.disciplina, larguraTexto, 11.5, "bold")
    const altTitulo = titulo.length * passo(11.5, 1.2)
    const linhas = (item.escopo ?? []).flatMap((e) =>
      quebrar(c, e, larguraTexto - 4, 9).map((l, i) => ({ l, marcador: i === 0 })),
    )
    // Só uma disciplina maior que a página é partida (por linha de escopo).
    fatiar(linhas, maxLinhas).forEach((parte, p) => {
      const primeira = p === 0
      const conteudo = Math.max(11, (primeira ? 4 + altTitulo : 0) + parte.length * lh)
      const altura = 5.5 + conteudo + 5.5
      blocos.push({
        secao,
        altura,
        desenhar: (y) => {
          const y0 = y + 5.5
          if (primeira) {
            const id = iconeDisciplina(item.disciplina)
            retangulo(c, M, y0, 11, 11, { fundo: PALETA.faixa, raio: 2.5 })
            imagem(c, c.rec.icones[id], `icone-${id}`, M + 2.9, y0 + 2.9, 5.2, 5.2)
            escrever(c, titulo, 34, y0 + 4.2, { peso: "bold", tam: 11.5, cor: PALETA.navy, lh: 1.2 })
            escrever(c, valor, M + LARG, y0 + 4.2, { peso: "bold", tam: 11, cor: PALETA.tinta, align: "right" })
          }
          let ly = y0 + (primeira ? 4.2 + altTitulo + 1.5 : 3)
          for (const { l, marcador } of parte) {
            if (marcador) retangulo(c, 34, ly - 1.3, 1.6, 0.25, { fundo: PALETA.dourado })
            escrever(c, l, 38, ly, { tam: 9, cor: PALETA.textoCard })
            ly += lh
          }
          linhaH(c, M, M + LARG, y + altura)
        },
      })
    })
  }

  blocos.push({
    secao,
    altura: 30,
    desenhar: (y) => {
      const yy = y + 8
      retangulo(c, M, yy, LARG, 22, { fundo: PALETA.navy, raio: 3 })
      escrever(c, "INVESTIMENTO TOTAL", M + 8, yy + 9, { peso: "bold", tam: 8, cor: PALETA.dourado, espaco: 0.2 })
      const legenda = c.doc.area > 0 ? `Valor global para ${formatarArea(c.doc.area)}` : "Valor global da proposta"
      escrever(c, legenda, M + 8, yy + 14.5, { tam: 9, cor: PALETA.suaveNoNavy })
      escrever(c, brl(c.doc.total), M + LARG - 8, yy + 14.2, { peso: "extrabold", tam: 24, cor: PALETA.branco, align: "right" })
    },
  })
  return blocos
}

// ── Condições comerciais ───────────────────────────────────────────────

interface LinhaCartao {
  pill?: string
  rotulo: string[]
  valor: string[]
  tamValor: number
  altura: number
}

function blocosCondicoes(c: Ctx, num: () => number): Bloco[] {
  const secao = "Condições comerciais"
  const { doc, empresa } = c
  const blocos: Bloco[] = [secaoBloco(c, secao, num(), "Condições comerciais", true)]
  const COL = (LARG - 8) / 2

  const linha = (rotulo: string, valores: string[], o: { pill?: string; tamValor?: number; largValor: number }): LinhaCartao => {
    const tamValor = o.tamValor ?? 9.5
    const valor = valores.flatMap((v) => quebrar(c, v, o.largValor, tamValor, "bold"))
    const rot = quebrar(c, rotulo, COL - 12 - o.largValor - 3 - (o.pill ? 12 : 0), 9.5)
    const altura = Math.max(rot.length * passo(9.5, 1.35), valor.length * passo(tamValor, 1.35)) + 3.4
    return { pill: o.pill, rotulo: rot, valor, tamValor, altura }
  }

  const pagamento = (doc.parcelas ?? []).length
    ? (doc.parcelas ?? []).map((p) =>
        linha(rotuloParcela(p.desc), [brl(p.valor)], { pill: formatarPercentual(percentual(p.valor, doc.total)), largValor: 28 }),
      )
    : [linha(doc.formaPagamento || "A combinar", [], { largValor: 0 })]
  const banco = linhasBancarias(empresa.dadosBancarios)
  const prazo = [
    linha("Prazo de execução", [doc.prazoExecucao || "—"], { largValor: 36 }),
    linha("Validade da proposta", [doc.validade || "—"], { largValor: 36 }),
    ...(banco.length ? [linha("Dados bancários", banco, { largValor: 46, tamValor: 8 })] : []),
  ]
  const altCartao = (ls: LinhaCartao[]) => 14 + ls.reduce((s, l) => s + l.altura, 0) + 2
  const ALT = Math.max(altCartao(pagamento), altCartao(prazo))

  const cartao = (x: number, y: number, titulo: string, ls: LinhaCartao[]) => {
    retangulo(c, x, y, COL, ALT, { borda: PALETA.linha, raio: 3 })
    escrever(c, quebrar(c, titulo.toUpperCase(), COL - 22, 8, "bold")[0] ?? "", x + 6, y + 9, { peso: "bold", tam: 8, cor: PALETA.cinza, espaco: 0.12 })
    let ly = y + 14
    ls.forEach((l, i) => {
      const base = ly + 9.5 * PT * 0.9 + 0.6
      let xr = x + 6
      if (l.pill) {
        retangulo(c, xr, ly, 10.5, 4.6, { fundo: PALETA.douradoSuave, raio: 2.3 })
        escrever(c, l.pill, xr + 5.25, ly + 3.3, { peso: "bold", tam: 7, cor: PALETA.dourado, align: "center" })
        xr += 12
      }
      escrever(c, l.rotulo, xr, base, { tam: 9.5, cor: PALETA.tinta, lh: 1.35 })
      if (l.valor.length) escrever(c, l.valor, x + COL - 6, base, { peso: "bold", tam: l.tamValor, cor: PALETA.tinta, align: "right", lh: 1.35 })
      ly += l.altura
      if (i < ls.length - 1) linhaH(c, x + 6, x + COL - 6, ly - 1.2, PALETA.linha, true)
    })
  }
  blocos.push({
    secao,
    altura: ALT + 9,
    desenhar: (y) => {
      cartao(M, y, `Pagamento — ${doc.formaPagamento || "a combinar"}`, pagamento)
      cartao(M + COL + 8, y, "Prazo e validade", prazo)
    },
  })

  // Incluso / Não incluso lado a lado (uma coluna some quando vazia).
  const colunas = [
    { titulo: "Incluso", itens: doc.premissas.filter((s) => s?.trim()), tipo: "ok" as const },
    { titulo: "Não incluso", itens: doc.exclusoes.filter((s) => s?.trim()), tipo: "nao" as const },
  ].filter((col) => col.itens.length)
  if (colunas.length) {
    const larg = colunas.length === 2 ? COL : LARG
    const numeros = colunas.map(() => num())
    blocos.push({
      secao,
      altura: 13,
      manterComProximo: true,
      desenhar: (y) => colunas.forEach((col, i) => tituloSecao(c, numeros[i], col.titulo, M + i * (COL + 8), y, larg)),
    })
    const quebradas = colunas.map((col) => col.itens.map((it) => quebrar(c, it, larg - 6, 9.5)))
    const total = Math.max(...quebradas.map((q) => q.length))
    for (let i = 0; i < total; i++) {
      const alt = Math.max(...quebradas.map((q) => q[i]?.length ?? 0)) * passo(9.5, 1.45) + 3.6
      blocos.push({
        secao,
        altura: alt + (i === total - 1 ? 9 : 0),
        desenhar: (y) =>
          quebradas.forEach((q, k) => {
            const linhas = q[i]
            if (!linhas) return
            const x = M + k * (COL + 8)
            const base = y + 1.8 + 9.5 * PT
            if (colunas[k].tipo === "ok") {
              c.pdf.setDrawColor(...rgb(PALETA.verde))
              c.pdf.setLineWidth(0.45)
              c.pdf.lines([[0.9, 0.9], [1.8, -2]], x, base - 1.3)
            } else {
              escrever(c, "—", x, base, { peso: "bold", tam: 9.5, cor: PALETA.vermelho })
            }
            escrever(c, linhas, x + 6, base, { tam: 9.5, cor: PALETA.texto, lh: 1.45 })
            if (i < q.length - 1) linhaH(c, x, x + larg, y + alt)
          }),
      })
    }
  }

  if (doc.observacoes?.trim()) {
    blocos.push(secaoBloco(c, secao, num(), "Observações"), ...blocosTexto(c, secao, doc.observacoes, 9.5))
  }

  const assinatura = assinaturaDoDocumento(doc, empresa.razaoSocial)
  const temImagem = !!empresa.assinaturaDataUrl
  blocos.push(secaoBloco(c, secao, num(), "Aceite"))
  blocos.push({
    secao,
    altura: 8 + (temImagem ? 18 : 12) + 14,
    desenhar: (y) => {
      escrever(c, "Ao assinar, as partes concordam com o escopo, os valores e as condições descritos nesta proposta.", M, y + 4, { tam: 9.5, cor: PALETA.texto })
      const yl = y + 8 + (temImagem ? 18 : 12)
      const larg = (LARG - 16) / 2
      if (temImagem) {
        const prop = proporcao(c, empresa.assinaturaDataUrl)
        imagem(c, empresa.assinaturaDataUrl, "assinatura", M, yl - 16, Math.min(50, prop ? 15 / prop : 40), 15)
      }
      linhaH(c, M, M + larg, yl, PALETA.tinta)
      escrever(c, assinatura.nome, M, yl + 5, { peso: "bold", tam: 9.5, cor: PALETA.tinta })
      const cargo = [assinatura.cargo, empresa.razaoSocial || EMPRESA_PADRAO.razaoSocial].filter(Boolean).join(" · ")
      escrever(c, quebrar(c, cargo, larg, 8.5)[0] ?? "", M, yl + 9.5, { tam: 8.5, cor: PALETA.cinza })
      const x2 = M + larg + 16
      linhaH(c, x2, x2 + larg, yl, PALETA.tinta)
      escrever(c, doc.contato || doc.cliente, x2, yl + 5, { peso: "bold", tam: 9.5, cor: PALETA.tinta })
      if (doc.contato) escrever(c, quebrar(c, doc.cliente, larg, 8.5)[0] ?? "", x2, yl + 9.5, { tam: 8.5, cor: PALETA.cinza })
    },
  })
  return blocos
}

// ── Montagem ───────────────────────────────────────────────────────────

function montarBlocos(c: Ctx): Bloco[] {
  let n = 0
  const num = () => ++n
  // Ordem da revisão da IEX: institucional primeiro, depois o projeto.
  const blocos: Bloco[] = [
    secaoBloco(c, "Quem somos", num(), "Quem somos"),
    blocoQuemSomos(c, "Quem somos"),
    ...INSTITUCIONAL.quemSomos.flatMap((p) => blocosTexto(c, "Quem somos", p, 10.5)),
    ...blocosMetodologia(c, num),
  ]
  const secao = "Apresentação"
  blocos.push(
    secaoBloco(c, secao, num(), "Apresentação", true),
    ...blocosTexto(c, secao, c.doc.apresentacao || APRESENTACAO_PADRAO, 10.5),
  )
  const ficha = blocoFicha(c, secao)
  if (ficha) blocos.push(secaoBloco(c, secao, num(), "Dados do empreendimento"), ficha)
  blocos.push(...blocosEscopo(c, num), ...blocosCondicoes(c, num))
  return blocos
}

export function montarPdf(doc: PropostaDoc, empresa: EmpresaDoc, recursos: RecursosDoc): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" })
  const c: Ctx = { pdf, rec: recursos, doc, empresa, usar: registrarFontes(pdf, recursos.fontes) }
  desenharCapa(c)
  const blocos = montarBlocos(c)
  const paginas = paginar(blocos, BASE - TOPO)
  const total = paginas.length + 1
  paginas.forEach((indices, i) => {
    pdf.addPage()
    desenharMoldura(c, blocos[indices[0]].secao, i + 2, total)
    let y = TOPO
    for (const k of indices) {
      blocos[k].desenhar(y)
      y += blocos[k].altura
    }
  })
  return pdf
}

// Gera o PDF da proposta (PRD 008). Carrega fonte e imagens na primeira vez.
export async function gerarPdf(doc: PropostaDoc, empresa: EmpresaDoc, recursos?: RecursosDoc): Promise<Blob> {
  return montarPdf(doc, empresa, recursos ?? (await carregarRecursos())).output("blob")
}
```

- [ ] **Step 4: Rodar os testes do PDF**

Run: `npx vitest run lib/document/pdf.test.ts`
Expected: PASS nos 7 testes. Se o teste de 6 páginas der outro número, imprima as alturas com `paginar`. Conta esperada (área útil 249 mm): Quem somos = título 13 + painel 107 + texto ~67 ≈ 187; Metodologia ≈ 176; Apresentação 13 + texto ~31 + título 13 + ficha 39 + título 13 + 3 disciplinas (~35 cada) ≈ 214; resto do escopo 2 × 35 + total 30 ≈ 100; Condições. Ajuste o espaçamento do bloco que estourou, não a contagem esperada.

- [ ] **Step 5: Tornar as chamadas assíncronas**

Em cada ponto, `gerarPdf(` vira `await gerarPdf(` (todas as funções já são `async`):

- `app/propostas/page.tsx:269`: `baixarBlob(await gerarPdf(bundle.doc, bundle.empresa), ...)`
- `app/propostas/page.tsx:722`: `const blob = dados.anexo === "word" ? await gerarWord(bundle.doc, bundle.empresa) : await gerarPdf(bundle.doc, bundle.empresa)`
- `app/propostas/nova/page.tsx:1141`: `baixarBlob(await gerarPdf(docBundle.doc, docBundle.empresa), ...)`
- `app/propostas/nova/page.tsx:1181`: `... : await gerarPdf(docBundle.doc, docBundle.empresa)`
- `components/proposal-drawer.tsx:135`: `baixarBlob(await gerarPdf(bundle.doc, bundle.empresa), ...)`
- `components/proposal-drawer.tsx:160`: `const blob = await gerarPdf(bundle.doc, bundle.empresa)`

Run: `grep -rn "gerarPdf(" app components | grep -v "await gerarPdf\|import"`
Expected: nenhuma linha.

- [ ] **Step 6: Tipos e suíte completa**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc sem saída; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add lib/document/pdf.ts lib/document/pdf.test.ts app/propostas/page.tsx app/propostas/nova/page.tsx components/proposal-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(documento): PDF da proposta no layout Modelo A v2

Capa diagonal, Quem somos com foto, mapa e números, metodologia, escopo
paginado e condições. gerarPdf passa a ser assíncrono (carrega fonte e
imagens uma vez).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Conferência visual do PDF e ponto de parada

**Files:** nenhum no repositório. Saídas na scratchpad (`$SCRATCH`, a mesma usada por `$MODELOS` no Task 1, sem o sufixo `/modelos`).

- [ ] **Step 1: Gerar o PDF de exemplo a partir do código do app**

Create a temporary test file `lib/document/pdf.visual.test.ts` (não commitar):

```ts
import { writeFileSync } from "node:fs"
import { it } from "vitest"
import { docExemplo, empresaExemplo, itensExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { montarPdf } from "./pdf"

const saida = process.env.SAIDA_PDF
it.runIf(saida)("grava PDFs de exemplo", () => {
  const r = recursosDoDisco({ fontes: true })
  writeFileSync(`${saida}/app-exemplo.pdf`, Buffer.from(montarPdf(docExemplo(), empresaExemplo(), r).output("arraybuffer")))
  const itens = itensExemplo(12)
  const longo = docExemplo({ itens, total: itens.reduce((s, i) => s + i.valor, 0), observacoes: "Prazo conta a partir do recebimento do arquitetônico." })
  writeFileSync(`${saida}/app-longo.pdf`, Buffer.from(montarPdf(longo, empresaExemplo(), r).output("arraybuffer")))
})
```

Run: `SAIDA_PDF=$SCRATCH npx vitest run lib/document/pdf.visual.test.ts`
Expected: PASS; `app-exemplo.pdf` (6 páginas) e `app-longo.pdf` (6 páginas ou mais) na scratchpad.

- [ ] **Step 2: Renderizar no Chrome (poppler) e no PDFKit**

```bash
cd $SCRATCH && pdftoppm -r 45 -png app-exemplo.pdf vis/ex && pdftoppm -r 45 -png app-longo.pdf vis/lg
for i in 0 1 2 3 4; do swift modelos/pk.swift app-exemplo.pdf $i vis/pk-$i.png; done
```

Expected: PNGs gerados. (`modelos/pk.swift` é o script PDFKit criado na conversa.)

- [ ] **Step 3: Comparar com o Modelo A v2**

Read: `vis/ex-*.png`, `vis/pk-*.png` e `modelos/prev/v-*.png` (Modelo A v2).
Conferir: capa diagonal e faixa; logo IEX PROJETOS; Quem somos com foto inteira (sem corte no PDFKit), mapa e 3 números alinhados e o texto da IEX abaixo do painel; metodologia sem "Etapas"; Apresentação + ficha 3×2 + início do escopo na mesma página; escopo com ícones certos; total em navy; condições com etiquetas de % e prazo em "dias úteis"; Incluso / Não incluso com as listas da IEX; rodapé com YRM e "NN / 06"; no `app-longo`, o escopo continua na página seguinte com o cabeçalho e sem disciplina partida.
Se algo divergir: corrigir em `pdf.ts`, rodar `npx vitest run lib/document` e repetir os Steps 1 a 3.

- [ ] **Step 4: Apagar o teste temporário**

Run: `rm lib/document/pdf.visual.test.ts && git status --short`
Expected: árvore limpa (ou só correções feitas no Step 3, que devem ser commitadas com `fix(documento): ...`).

- [ ] **Step 5: PONTO DE PARADA — enviar ao Arthur**

Copiar `app-exemplo.pdf` para `~/Downloads/IEX-modelos-proposta/IEX Projetos - PDF gerado pelo app.pdf`, enviar com SendUserFile e **esperar aprovação** antes do Task 6. Informar que a capa e a data usam a data de hoje e que os dados são de exemplo.

---

### Task 6: Prévia na tela

**Files:**
- Rewrite: `components/document-preview.tsx`
- Modify: `app/globals.css` (fim do arquivo)
- Test: `components/document-preview.test.ts`

**Interfaces:**
- Consumes: Task 2 (`PALETA`, `INSTITUCIONAL`, funções); Task 3 (`CAMINHO_IMAGEM`, `CAMINHO_ICONE`); `assinaturaDoDocumento`, `brl`, `identificacaoDocumento`.
- Produces: `DocumentPreview({ data }: { data: DocumentData })` e `interface DocumentData`, com a mesma assinatura e os mesmos campos de hoje (usado em `app/propostas/nova/page.tsx:2005`).

- [ ] **Step 1: Escrever o teste**

Create `components/document-preview.test.ts`:

```ts
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { docExemplo } from "@/test/documento-exemplo"
import { DocumentPreview } from "./document-preview"

const html = (parcial = {}) => renderToStaticMarkup(createElement(DocumentPreview, { data: docExemplo(parcial) }))

describe("DocumentPreview", () => {
  it("mostra as 5 folhas do Modelo A v2", () => {
    expect(html().match(/<section/g)).toHaveLength(5)
  })
  it("traz valores com centavos, institucional e rodapé YRM", () => {
    const h = html()
    expect(h).toContain("123.160,00")
    expect(h).toContain("30.400,00")
    expect(h).toContain("Quem somos")
    expect(h).toContain("Credibilidade")
    expect(h).not.toContain("Etapas deste projeto")
    expect(h).toContain("1.400")
    expect(h).toContain("Powered by YRM Strategy Lab")
    expect(h).toContain("/documento/socios.png")
    expect(h).toContain("/documento/icones/eletrica.png")
  })
  it("mostra observações só quando existem", () => {
    expect(html()).not.toContain("Observações")
    expect(html({ observacoes: "Prazo a partir do arquitetônico." })).toContain("Observações")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run components/document-preview.test.ts`
Expected: FAIL (a prévia atual tem 0 `<section` de folha e não contém "Quem somos").

- [ ] **Step 3: Declarar a fonte da prévia**

Acrescentar ao fim de `app/globals.css`:

```css
/* Fonte do documento da proposta (prévia). Os mesmos TTF que o PDF embute. */
@font-face { font-family: "Manrope Documento"; src: url("/fonts/manrope-400.ttf") format("truetype"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Manrope Documento"; src: url("/fonts/manrope-600.ttf") format("truetype"); font-weight: 600; font-display: swap; }
@font-face { font-family: "Manrope Documento"; src: url("/fonts/manrope-700.ttf") format("truetype"); font-weight: 700; font-display: swap; }
@font-face { font-family: "Manrope Documento"; src: url("/fonts/manrope-800.ttf") format("truetype"); font-weight: 800; font-display: swap; }
```

- [ ] **Step 4: Reescrever `components/document-preview.tsx`**

Replace todo o conteúdo:

```tsx
import type { CSSProperties, ReactNode } from "react"
import {
  APRESENTACAO_PADRAO, EMPRESA_PADRAO, INSTITUCIONAL, PALETA, RODAPE_PADRAO, contatoRodape, dataPorExtenso,
  fichaEmpreendimento, formatarArea, formatarPercentual, iconeDisciplina, mesAno, percentual, rotuloParcela,
  subtituloCapa, tituloCapa,
} from "@/lib/document/layout-a"
import { CAMINHO_ICONE, CAMINHO_IMAGEM } from "@/lib/document/recursos"
import { assinaturaDoDocumento, brl } from "@/lib/document/tipos"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"

export interface DocumentData {
  numero: string
  versao: number
  apresentacao: string
  cliente: string
  contato: string
  empreendimento: string
  cidade: string
  uf: string
  area: number
  tipo: string
  itens: { disciplina: string; valor: number; escopo?: string[] }[]
  total: number
  formaPagamento: string
  parcelas?: { desc: string; valor: number }[]
  prazoExecucao: string
  validade: string
  premissas: string[]
  exclusoes: string[]
  observacoes: string
  responsavel: string
  assinaturaNome?: string
  assinaturaCargo?: string
}

// Prévia do documento no layout "Modelo A v2" (spec 2026-10-01). Reproduz a
// geometria do PDF em milímetros: --mm vale 1/210 da largura da prévia
// (container query), então a folha escala com a tela sem distorcer.
const mm = (n: number) => `calc(var(--mm) * ${n})`
const FONTE = '"Manrope Documento", Manrope, ui-sans-serif, system-ui, sans-serif'
const pad = (n: number) => String(n).padStart(2, "0")
const TOTAL_FOLHAS = 5

function f(tam: number, peso = 400, cor: string = PALETA.tinta, extra: CSSProperties = {}): CSSProperties {
  return { fontSize: mm(tam * 0.3528), fontWeight: peso, color: cor, margin: 0, ...extra }
}
const caixaAlta = (em: number): CSSProperties => ({ textTransform: "uppercase", letterSpacing: `${em}em` })

function Folha({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      className="relative w-full overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/70"
      style={{ minHeight: mm(297), ...style }}
    >
      {children}
    </section>
  )
}

function FolhaInterna({ secao, numero, identificacao, children }: { secao: string; numero: number; identificacao: string; children: ReactNode }) {
  return (
    <Folha style={{ display: "flex", flexDirection: "column" }}>
      <header style={{ height: mm(15), background: PALETA.navy, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${mm(18)}` }}>
        <img src={CAMINHO_IMAGEM.logoBranco} alt="IEX Projetos" style={{ height: mm(9.5), display: "block" }} />
        <span style={{ ...f(7.5, 400, PALETA.branco), ...caixaAlta(0.16) }}>{secao}</span>
        <span style={f(7.5, 400, PALETA.branco)}>{identificacao}</span>
      </header>
      <div style={{ flex: 1, padding: `${mm(12)} ${mm(18)} ${mm(8)}` }}>{children}</div>
      <footer style={{ margin: `0 ${mm(18)} ${mm(6)}`, paddingTop: mm(3), borderTop: `1px solid ${PALETA.linha}`, display: "flex", justifyContent: "space-between", gap: mm(4) }}>
        <div>
          <p style={f(7, 400, PALETA.cinza)}>{contatoRodape(EMPRESA_PADRAO)}</p>
          <p style={f(6.5, 400, PALETA.cinzaClaro, { marginTop: mm(1) })}>{RODAPE_PADRAO}</p>
        </div>
        <span style={f(7, 400, PALETA.cinza)}>{pad(numero)} / {pad(TOTAL_FOLHAS)}</span>
      </footer>
    </Folha>
  )
}

function TituloSecao({ n, children, style }: { n: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: mm(3), margin: `${mm(4)} 0 ${mm(5)}`, ...style }}>
      <span style={f(10, 400, PALETA.dourado)}>{pad(n)}</span>
      <h2 style={f(17, 800, PALETA.navy, { letterSpacing: "-0.01em" })}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: PALETA.linha, transform: "translateY(-0.25em)" }} />
    </div>
  )
}

function Icone({ id, caixa, tamanho }: { id: Parameters<typeof CAMINHO_ICONE>[0]; caixa: number; tamanho: number }) {
  return (
    <span style={{ width: mm(caixa), height: mm(caixa), borderRadius: mm(2.5), background: PALETA.faixa, display: "grid", placeItems: "center", flex: "none" }}>
      <img src={CAMINHO_ICONE(id)} alt="" style={{ width: mm(tamanho), height: mm(tamanho) }} />
    </span>
  )
}

function Capa({ data, identificacao }: { data: DocumentData; identificacao: string }) {
  const hoje = new Date()
  const titulo = tituloCapa(data.empreendimento)
  const colunas: [string, string, string][] = [
    ["Cliente", data.cliente, data.contato ? `A/C ${data.contato}` : ""],
    ["Proposta", identificacao, ""],
    ["Emitida em", dataPorExtenso(hoje), data.validade ? `Validade: ${data.validade}` : ""],
  ]
  return (
    <Folha>
      <div style={{ position: "absolute", inset: 0, background: PALETA.navyCapa, clipPath: "polygon(0 0, 100% 0, 100% 62%, 0 78%)" }}>
        <img src={CAMINHO_IMAGEM.capaRede} alt="" style={{ position: "absolute", left: mm(70), top: mm(26), width: mm(150) }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: PALETA.dourado, clipPath: "polygon(0 78%, 100% 62%, 100% 63.6%, 0 79.6%)" }} />
      <img src={CAMINHO_IMAGEM.logoBranco} alt="IEX Projetos" style={{ position: "absolute", left: mm(18), top: mm(18), width: mm(32) }} />
      <span style={{ position: "absolute", top: mm(20), right: mm(18), border: `1px solid ${PALETA.bordaChip}`, borderRadius: mm(3.5), padding: `${mm(1.4)} ${mm(3.5)}`, ...f(7.5, 400, PALETA.branco), ...caixaAlta(0.18) }}>
        Proposta {mesAno(hoje)}
      </span>
      <div style={{ position: "absolute", left: mm(18), top: mm(106), width: mm(125) }}>
        <p style={{ ...f(9, 700, PALETA.dourado), ...caixaAlta(0.2) }}>Proposta técnica e comercial</p>
        <h1 style={f(38, 800, PALETA.branco, { lineHeight: 1.02, letterSpacing: "-0.03em", marginTop: mm(5), display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" })}>
          {titulo.flatMap((l, i) => (i ? [<br key={`br-${i}`} />, l] : [l]))}
        </h1>
        <p style={f(10.5, 400, PALETA.suaveNoNavy, { lineHeight: 1.6, marginTop: mm(6) })}>{subtituloCapa(data.itens)}</p>
      </div>
      <div style={{ position: "absolute", left: mm(18), right: mm(18), bottom: mm(18), display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: mm(6) }}>
        {colunas.map(([rotulo, valor, sub]) => (
          <div key={rotulo} style={{ borderLeft: `${mm(0.7)} solid ${PALETA.dourado}`, paddingLeft: mm(4) }}>
            <p style={{ ...f(7.5, 400, PALETA.cinza), ...caixaAlta(0.12) }}>{rotulo}</p>
            <p style={f(10.5, 700, PALETA.tinta, { marginTop: mm(1.5) })}>{valor || "—"}</p>
            {sub && <p style={f(8.5, 400, PALETA.cinza, { marginTop: mm(0.5) })}>{sub}</p>}
          </div>
        ))}
      </div>
    </Folha>
  )
}

// Painel navy com foto, mapa e números (revisão da IEX: sem título nem resumo
// dentro do painel; o texto institucional vem logo abaixo).
function QuemSomos() {
  return (
    <div style={{ height: mm(100), borderRadius: mm(3), background: PALETA.painel, position: "relative", overflow: "hidden", marginBottom: mm(7) }}>
      <img src={CAMINHO_IMAGEM.socios} alt={INSTITUCIONAL.socios} style={{ position: "absolute", left: mm(4), bottom: 0, height: mm(86) }} />
      <div style={{ position: "absolute", left: mm(8), bottom: mm(6), background: PALETA.navyCapa, borderRadius: mm(1.5), padding: `${mm(1.5)} ${mm(3)}` }}>
        <p style={f(8, 700, PALETA.branco)}>{INSTITUCIONAL.socios}</p>
        <p style={f(7, 400, PALETA.suaveNoPainel)}>{INSTITUCIONAL.sociosLegenda}</p>
      </div>
      <img src={CAMINHO_IMAGEM.mapa} alt="Mapa do Brasil" style={{ position: "absolute", left: mm(74), top: mm(18), width: mm(62) }} />
      <div style={{ position: "absolute", right: mm(8), top: mm(14), width: mm(28), display: "grid", gap: mm(6) }}>
        {INSTITUCIONAL.numeros.map((n) => (
          <div key={n.rotulo} style={{ borderLeft: `${mm(0.7)} solid ${PALETA.dourado}`, paddingLeft: mm(3), lineHeight: 1 }}>
            <p style={f(7.5, 400, PALETA.suaveNoPainel, { minHeight: mm(3) })}>{n.prefixo}</p>
            <p style={f(24, 800, PALETA.branco, { letterSpacing: "-0.02em", margin: `${mm(0.8)} 0 ${mm(1.2)}` })}>{n.valor}</p>
            <p style={f(7.8, 600, PALETA.azulClaro, { lineHeight: 1.3 })}>{n.rotulo}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DocumentPreview({ data }: { data: DocumentData }) {
  const identificacao = identificacaoDocumento(data.numero, data.versao)
  const assinatura = assinaturaDoDocumento(data)
  const ficha = fichaEmpreendimento(data)
  const inclusos = data.premissas.filter((s) => s?.trim())
  const excluidos = data.exclusoes.filter((s) => s?.trim())
  let n = 0
  const num = () => ++n

  // Ordem da revisão da IEX: institucional primeiro, depois o projeto.
  return (
    <div
      className="proposal-document mx-auto max-w-3xl space-y-6"
      style={{ containerType: "inline-size", fontFamily: FONTE, ["--mm" as string]: "calc(100cqw / 210)" } as CSSProperties}
    >
      <Capa data={data} identificacao={identificacao} />

      <FolhaInterna secao="Quem somos" numero={2} identificacao={identificacao}>
        <TituloSecao n={num()}>Quem somos</TituloSecao>
        <QuemSomos />
        {INSTITUCIONAL.quemSomos.map((p) => (
          <p key={p.slice(0, 24)} style={f(10.5, 400, PALETA.texto, { lineHeight: 1.65, marginBottom: mm(5) })}>{p}</p>
        ))}
      </FolhaInterna>

      <FolhaInterna secao="Metodologia" numero={3} identificacao={identificacao}>
        <TituloSecao n={num()}>Como trabalhamos</TituloSecao>
        <div style={{ position: "relative", height: mm(56), marginBottom: mm(9) }}>
          <img src={CAMINHO_IMAGEM.metodologia} alt="" style={{ width: "100%", height: "100%", display: "block" }} />
          <div style={{ position: "absolute", left: mm(6), bottom: mm(5) }}>
            <p style={{ ...f(8, 400, PALETA.branco), ...caixaAlta(0.14) }}>Engenharia integrada</p>
            <p style={f(13, 700, PALETA.branco, { marginTop: mm(1) })}>{INSTITUCIONAL.metodologiaChamada}</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: mm(4), marginBottom: mm(4) }}>
          {INSTITUCIONAL.diferenciais.map((d) => (
            <div key={d.titulo} style={{ border: `1px solid ${PALETA.linha}`, borderRadius: mm(3), padding: mm(5) }}>
              <Icone id={d.icone} caixa={9} tamanho={5.4} />
              <p style={f(10.5, 700, PALETA.navy, { marginTop: mm(3) })}>{d.titulo}</p>
              <p style={f(8.4, 400, PALETA.textoCard, { lineHeight: 1.55, marginTop: mm(1.5) })}>{d.texto}</p>
            </div>
          ))}
        </div>
        <TituloSecao n={num()}>Nossas especialidades</TituloSecao>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: mm(3) }}>
          {INSTITUCIONAL.especialidades.map((e) => (
            <div key={e.titulo} style={{ background: PALETA.faixa, borderRadius: mm(3), padding: mm(4.5), borderTop: `${mm(0.7)} solid ${PALETA.dourado}` }}>
              <p style={f(9.5, 700, PALETA.navy, { lineHeight: 1.25 })}>{e.titulo}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: `${mm(2)} 0 0` }}>
                {e.itens.map((it) => <li key={it} style={f(7.8, 400, PALETA.textoCard, { lineHeight: 1.55 })}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </FolhaInterna>

      <FolhaInterna secao="Apresentação" numero={4} identificacao={identificacao}>
        <TituloSecao n={num()}>Apresentação</TituloSecao>
        <p style={f(10.5, 400, PALETA.texto, { lineHeight: 1.65, whiteSpace: "pre-line", marginBottom: mm(6) })}>{data.apresentacao || APRESENTACAO_PADRAO}</p>
        {ficha.length > 0 && (
          <>
            <TituloSecao n={num()}>Dados do empreendimento</TituloSecao>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${PALETA.linha}`, borderRadius: mm(3), overflow: "hidden", marginBottom: mm(4) }}>
              {ficha.map(([rotulo, valor]) => (
                <div key={rotulo} style={{ padding: `${mm(4)} ${mm(5)}`, borderRight: `1px solid ${PALETA.linha}`, borderBottom: `1px solid ${PALETA.linha}`, marginRight: -1, marginBottom: -1 }}>
                  <p style={{ ...f(7, 400, PALETA.cinza), ...caixaAlta(0.14) }}>{rotulo}</p>
                  <p style={f(10, 700, PALETA.tinta, { marginTop: mm(1.5) })}>{valor}</p>
                </div>
              ))}
            </div>
          </>
        )}
        <TituloSecao n={num()}>Escopo por disciplina</TituloSecao>
        {data.itens.map((item, i) => (
          <div key={`${item.disciplina}-${i}`} style={{ display: "grid", gridTemplateColumns: `${mm(11)} 1fr auto`, gap: mm(5), padding: `${mm(5.5)} 0`, borderBottom: `1px solid ${PALETA.linha}`, alignItems: "start" }}>
            <Icone id={iconeDisciplina(item.disciplina)} caixa={11} tamanho={5.2} />
            <div>
              <p style={f(11.5, 700, PALETA.navy)}>{item.disciplina}</p>
              {item.escopo && item.escopo.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: `${mm(2)} 0 0` }}>
                  {item.escopo.map((e, k) => (
                    <li key={k} style={f(9, 400, PALETA.textoCard, { lineHeight: 1.6, paddingLeft: mm(4), position: "relative" })}>
                      <span style={{ position: "absolute", left: 0, top: "0.8em", width: mm(1.6), height: 1, background: PALETA.dourado }} />
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p style={f(11, 700, PALETA.tinta, { whiteSpace: "nowrap" })}>{brl(item.valor)}</p>
          </div>
        ))}
        <div style={{ marginTop: mm(8), background: PALETA.navy, borderRadius: mm(3), padding: `${mm(7)} ${mm(8)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ ...f(8, 700, PALETA.dourado), ...caixaAlta(0.2) }}>Investimento total</p>
            <p style={f(9, 400, PALETA.suaveNoNavy, { marginTop: mm(1.5) })}>{data.area > 0 ? `Valor global para ${formatarArea(data.area)}` : "Valor global da proposta"}</p>
          </div>
          <p style={f(24, 800, PALETA.branco, { letterSpacing: "-0.01em" })}>{brl(data.total)}</p>
        </div>
      </FolhaInterna>

      <FolhaInterna secao="Condições comerciais" numero={5} identificacao={identificacao}>
        <TituloSecao n={num()}>Condições comerciais</TituloSecao>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: mm(8), marginBottom: mm(4) }}>
          <div style={{ border: `1px solid ${PALETA.linha}`, borderRadius: mm(3), padding: mm(6) }}>
            <p style={{ ...f(8, 700, PALETA.cinza), ...caixaAlta(0.12), marginBottom: mm(3) }}>Pagamento — {data.formaPagamento || "a combinar"}</p>
            {(data.parcelas ?? []).length ? (
              (data.parcelas ?? []).map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: mm(4), padding: `${mm(2.4)} 0`, borderBottom: `1px dashed ${PALETA.linha}` }}>
                  <span style={f(9.5, 400, PALETA.tinta)}>
                    <span style={{ ...f(7, 700, PALETA.dourado), background: PALETA.douradoSuave, borderRadius: mm(2.3), padding: `${mm(0.6)} ${mm(2)}`, marginRight: mm(2) }}>
                      {formatarPercentual(percentual(p.valor, data.total))}
                    </span>
                    {rotuloParcela(p.desc)}
                  </span>
                  <b style={f(9.5, 700, PALETA.tinta, { whiteSpace: "nowrap" })}>{brl(p.valor)}</b>
                </div>
              ))
            ) : (
              <p style={f(9.5, 400, PALETA.tinta)}>{data.formaPagamento || "A combinar"}</p>
            )}
          </div>
          <div style={{ border: `1px solid ${PALETA.linha}`, borderRadius: mm(3), padding: mm(6) }}>
            <p style={{ ...f(8, 700, PALETA.cinza), ...caixaAlta(0.12), marginBottom: mm(3) }}>Prazo e validade</p>
            {[["Prazo de execução", data.prazoExecucao], ["Validade da proposta", data.validade]].map(([rotulo, valor]) => (
              <div key={rotulo} style={{ display: "flex", justifyContent: "space-between", gap: mm(4), padding: `${mm(2.4)} 0`, borderBottom: `1px dashed ${PALETA.linha}` }}>
                <span style={f(9.5, 400, PALETA.tinta)}>{rotulo}</span>
                <b style={f(9.5, 700, PALETA.tinta)}>{valor || "—"}</b>
              </div>
            ))}
          </div>
        </div>
        {(inclusos.length > 0 || excluidos.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: inclusos.length && excluidos.length ? "1fr 1fr" : "1fr", gap: mm(8) }}>
            {[
              { titulo: "Incluso", itens: inclusos, marca: "✓", cor: PALETA.verde },
              { titulo: "Não incluso", itens: excluidos, marca: "—", cor: PALETA.vermelho },
            ]
              .filter((col) => col.itens.length)
              .map((col) => (
                <div key={col.titulo}>
                  <TituloSecao n={num()}>{col.titulo}</TituloSecao>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {col.itens.map((it) => (
                      <li key={it} style={f(9.5, 400, PALETA.texto, { lineHeight: 1.55, padding: `${mm(1.8)} 0 ${mm(1.8)} ${mm(6)}`, position: "relative", borderBottom: `1px solid ${PALETA.linha}` })}>
                        <span style={{ position: "absolute", left: 0, color: col.cor, fontWeight: 800 }}>{col.marca}</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
        {data.observacoes?.trim() && (
          <>
            <TituloSecao n={num()}>Observações</TituloSecao>
            <p style={f(9.5, 400, PALETA.texto, { lineHeight: 1.65, whiteSpace: "pre-line" })}>{data.observacoes}</p>
          </>
        )}
        <TituloSecao n={num()}>Aceite</TituloSecao>
        <p style={f(9.5, 400, PALETA.texto)}>Ao assinar, as partes concordam com o escopo, os valores e as condições descritos nesta proposta.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: mm(16), marginTop: mm(14) }}>
          <div style={{ borderTop: `1px solid ${PALETA.tinta}`, paddingTop: mm(3) }}>
            <p style={f(9.5, 700, PALETA.tinta)}>{assinatura.nome}</p>
            <p style={f(8.5, 400, PALETA.cinza)}>{assinatura.cargo} · {EMPRESA_PADRAO.razaoSocial}</p>
          </div>
          <div style={{ borderTop: `1px solid ${PALETA.tinta}`, paddingTop: mm(3) }}>
            <p style={f(9.5, 700, PALETA.tinta)}>{data.contato || data.cliente}</p>
            {data.contato && <p style={f(8.5, 400, PALETA.cinza)}>{data.cliente}</p>}
          </div>
        </div>
      </FolhaInterna>
    </div>
  )
}
```

- [ ] **Step 5: Rodar o teste e os tipos**

Run: `npx vitest run components/document-preview.test.ts && npx tsc --noEmit -p .`
Expected: PASS; tsc sem saída.

- [ ] **Step 6: Conferência visual da prévia**

A tela real exige login, então a conferência renderiza o componente fora do app. Create a temporary `components/document-preview.visual.test.ts` (não commitar):

```ts
import { writeFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { it } from "vitest"
import { docExemplo } from "@/test/documento-exemplo"
import { DocumentPreview } from "./document-preview"

const saida = process.env.SAIDA_PREVIA
it.runIf(saida)("grava a prévia em HTML", () => {
  const raiz = process.cwd()
  const corpo = renderToStaticMarkup(createElement(DocumentPreview, { data: docExemplo() })).replaceAll('src="/', `src="file://${raiz}/public/`)
  const fontes = [400, 600, 700, 800].map((w) => `@font-face{font-family:"Manrope Documento";src:url(file://${raiz}/public/fonts/manrope-${w}.ttf);font-weight:${w}}`).join("")
  writeFileSync(`${saida}/previa.html`, `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script><style>${fontes}body{background:#eef1f5;padding:24px}</style></head><body>${corpo}</body></html>`)
})
```

Run:
```bash
SAIDA_PREVIA=$SCRATCH npx vitest run components/document-preview.visual.test.ts
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=5000 --window-size=820,5600 --screenshot=$SCRATCH/previa.png "file://$SCRATCH/previa.html"
```

Read: `$SCRATCH/previa.png`. Comparar com `app-exemplo.pdf` do Task 5: mesma capa, Quem somos, metodologia, escopo, condições; sem texto estourando a folha. Corrigir e repetir se preciso.

Run: `rm components/document-preview.visual.test.ts`

- [ ] **Step 7: Commit**

```bash
git add components/document-preview.tsx components/document-preview.test.ts app/globals.css
git commit -m "$(cat <<'EOF'
feat(documento): prévia da proposta no layout Modelo A v2

Folhas A4 com a mesma geometria do PDF (mm via container query), lendo
paleta e conteúdo de layout-a.ts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Word no layout Modelo A v2

**Files:**
- Rewrite: `lib/document/word.ts`
- Test: `lib/document/word.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml` (`jszip` dev)

**Interfaces:**
- Consumes: Tasks 2 e 3; `dataUrlParaImagem` (`util.ts`); `assinaturaDoDocumento`, `brl`; `identificacaoDocumento`.
- Produces:
  - `montarWord(doc: PropostaDoc, empresa: EmpresaDoc, recursos: RecursosDoc): Document`
  - `gerarWord(doc: PropostaDoc, empresa: EmpresaDoc, recursos?: RecursosDoc): Promise<Blob>` (já era assíncrono; as chamadas não mudam)

- [ ] **Step 1: Instalar o jszip para o teste**

Run: `pnpm add -D jszip`
Expected: `jszip` em `devDependencies`.

- [ ] **Step 2: Escrever os testes**

Create `lib/document/word.test.ts`:

```ts
import { Packer, type Document } from "docx"
import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { docExemplo, empresaExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { RECURSOS_VAZIOS } from "./recursos"
import { montarWord } from "./word"

async function xml(documento: Document) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(documento))
  const ler = (padrao: RegExp) =>
    Promise.all(Object.keys(zip.files).filter((f) => padrao.test(f)).map((f) => zip.file(f)!.async("string"))).then((s) => s.join(""))
  return { corpo: await ler(/^word\/document\.xml$/), rodape: await ler(/^word\/footer\d+\.xml$/), cabecalho: await ler(/^word\/header\d+\.xml$/) }
}

describe("montarWord", () => {
  it("traz capa, Quem somos, valores com centavos e condições", async () => {
    const { corpo } = await xml(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: false })))
    for (const trecho of ["Clínica Vida Plena", "Projetos executivos de:", "Quem somos", "Credibilidade", "1.400", "123.160,00", "30.400,00", "36.948,00", "Como trabalhamos", "Não incluso", "CREA", "Alderi Sousa"]) {
      expect(corpo, trecho).toContain(trecho)
    }
  })
  it("põe a marca e o rodapé YRM em cabeçalho e rodapé", async () => {
    const { rodape, cabecalho } = await xml(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: false })))
    expect(rodape).toContain("Powered by YRM Strategy Lab")
    expect(rodape).toContain("IEX Projetos")
    expect(cabecalho).toContain("20260928-01")
  })
  it("não falha sem imagens", async () => {
    const { corpo } = await xml(montarWord(docExemplo({ parcelas: [], observacoes: "Obs." }), empresaExemplo({ dadosBancarios: null }), RECURSOS_VAZIOS))
    expect(corpo).toContain("Parcelado por etapa")
    expect(corpo).toContain("Obs.")
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run lib/document/word.test.ts`
Expected: FAIL, `montarWord` não exportado.

- [ ] **Step 4: Reescrever `lib/document/word.ts`**

Replace todo o conteúdo:

```ts
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun, Packer,
  PageNumber, Paragraph, ShadingType, Table, TableAnchorType, TableCell, TableRow, TextRun, TextWrappingType,
  VerticalAlign, VerticalPositionRelativeFrom, WidthType,
} from "docx"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"
import {
  APRESENTACAO_PADRAO, EMPRESA_PADRAO, INSTITUCIONAL, PALETA, RODAPE_PADRAO, contatoRodape, dataPorExtenso,
  fichaEmpreendimento, formatarArea, formatarPercentual, iconeDisciplina, linhasBancarias, percentual,
  rotuloParcela, subtituloCapa, tituloCapa,
} from "./layout-a"
import { carregarRecursos, type PesoFonte, type RecursosDoc } from "./recursos"
import { assinaturaDoDocumento, brl, type EmpresaDoc, type PropostaDoc } from "./tipos"
import { dataUrlParaImagem } from "./util"

// Word da proposta no layout "Modelo A v2" (spec 2026-10-01). O Word não
// desenha a capa diagonal: ela entra como imagem atrás do texto, que segue
// editável. O resto são tabelas sombreadas. Medidas em mm convertidas para
// twips (texto, células) e pixels a 96 dpi (imagens).

const TW = 56.7
const PX = 3.78
const PAGINA = { width: 11906, height: 16838 }
const MARGEM = Math.round(18 * TW)
const LARG = PAGINA.width - 2 * MARGEM
const FONTE = "Manrope"
const hx = (cor: string) => cor.replace("#", "").toUpperCase()
const pad = (n: number) => String(n).padStart(2, "0")

type Filho = Paragraph | Table
type Alinhamento = (typeof AlignmentType)[keyof typeof AlignmentType]

const NENHUMA = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const SEM_BORDAS = { top: NENHUMA, bottom: NENHUMA, left: NENHUMA, right: NENHUMA }
const borda = (cor: string, tam = 4) => ({ style: BorderStyle.SINGLE, size: tam, color: hx(cor) })

interface OpcoesRun { peso?: PesoFonte; tam: number; cor: string; caixaAlta?: boolean; espaco?: number }

function run(texto: string, o: OpcoesRun) {
  return new TextRun({
    text: o.caixaAlta ? texto.toUpperCase() : texto,
    font: FONTE,
    bold: (o.peso ?? "regular") !== "regular",
    size: Math.round(o.tam * 2),
    color: hx(o.cor),
    characterSpacing: o.espaco ? Math.round(o.tam * 20 * o.espaco) : undefined,
  })
}

interface OpcoesPar { alinhar?: Alinhamento; antes?: number; depois?: number; manterProximo?: boolean; quebraAntes?: boolean; bordaInferior?: string; bordaSuperior?: string }

function par(filhos: (TextRun | ImageRun)[], o: OpcoesPar = {}) {
  return new Paragraph({
    children: filhos,
    alignment: o.alinhar,
    keepNext: o.manterProximo,
    keepLines: true,
    pageBreakBefore: o.quebraAntes,
    spacing: { before: Math.round((o.antes ?? 0) * TW), after: Math.round((o.depois ?? 1.5) * TW) },
    border: o.bordaInferior || o.bordaSuperior
      ? {
          ...(o.bordaInferior ? { bottom: { ...borda(o.bordaInferior), space: 4 } } : {}),
          ...(o.bordaSuperior ? { top: { ...borda(o.bordaSuperior), space: 4 } } : {}),
        }
      : undefined,
  })
}

function dimensoes(bytes: Uint8Array, tipo: string): { w: number; h: number } | null {
  if (tipo === "png" && bytes.length > 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { w: v.getUint32(16), h: v.getUint32(20) }
  }
  if (tipo === "jpg") {
    let i = 2
    while (i + 9 < bytes.length && bytes[i] === 0xff) {
      const marca = bytes[i + 1]
      const tam = (bytes[i + 2] << 8) | bytes[i + 3]
      if (marca >= 0xc0 && marca <= 0xc3) return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] }
      i += 2 + tam
    }
  }
  return null
}

function imagemRun(url: string | null | undefined, larguraMm: number, alturaMm?: number): ImageRun | null {
  const img = dataUrlParaImagem(url)
  if (!img) return null
  const d = dimensoes(img.data, img.tipo)
  const altura = alturaMm ?? (d ? (larguraMm * d.h) / d.w : larguraMm)
  const largura = alturaMm && d && !larguraMm ? (alturaMm * d.w) / d.h : larguraMm
  return new ImageRun({ type: img.tipo, data: img.data, transformation: { width: Math.round(largura * PX), height: Math.round(altura * PX) } })
}

interface OpcoesCel { largura: number; fundo?: string; margem?: number; alinharV?: (typeof VerticalAlign)[keyof typeof VerticalAlign]; colunas?: number; bordas?: Partial<Record<"top" | "bottom" | "left" | "right", ReturnType<typeof borda>>> }

function celula(filhos: Filho[], o: OpcoesCel) {
  const m = Math.round((o.margem ?? 0) * TW)
  return new TableCell({
    children: filhos.length ? filhos : [par([])],
    width: { size: o.largura, type: WidthType.DXA },
    columnSpan: o.colunas,
    verticalAlign: o.alinharV,
    shading: o.fundo ? { type: ShadingType.CLEAR, color: "auto", fill: hx(o.fundo) } : undefined,
    margins: { top: m, bottom: m, left: m, right: m },
    borders: { ...SEM_BORDAS, ...o.bordas },
  })
}

const linhaT = (celulas: TableCell[]) => new TableRow({ children: celulas, cantSplit: true })

function tabela(linhas: TableRow[], larguras: number[], extra: Partial<ConstructorParameters<typeof Table>[0]> = {}) {
  return new Table({
    rows: linhas,
    columnWidths: larguras,
    width: { size: larguras.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: { ...SEM_BORDAS, insideHorizontal: NENHUMA, insideVertical: NENHUMA },
    ...extra,
  })
}

const dividir = (total: number, pesos: number[]) => {
  const soma = pesos.reduce((a, b) => a + b, 0)
  const partes = pesos.map((p) => Math.floor((total * p) / soma))
  partes[partes.length - 1] += total - partes.reduce((a, b) => a + b, 0)
  return partes
}

function tituloSecao(n: number, titulo: string, quebraAntes = false) {
  return par(
    [run(`${pad(n)}   `, { tam: 10, cor: PALETA.dourado }), run(titulo, { peso: "extrabold", tam: 17, cor: PALETA.navy })],
    { antes: quebraAntes ? 0 : 6, depois: 4, manterProximo: true, quebraAntes, bordaInferior: PALETA.linha },
  )
}

// ── Capa ────────────────────────────────────────────────────────────────

function capa(doc: PropostaDoc, rec: RecursosDoc): Filho[] {
  const hoje = new Date()
  const primeira: (TextRun | ImageRun)[] = []
  const fundo = dataUrlParaImagem(rec.imagens.capaWord)
  if (fundo) {
    primeira.push(new ImageRun({
      type: fundo.tipo,
      data: fundo.data,
      transformation: { width: Math.round(210 * PX), height: Math.round(297 * PX) },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
        behindDocument: true,
        allowOverlap: true,
        wrap: { type: TextWrappingType.NONE },
      },
    }))
  }
  const logo = imagemRun(rec.imagens.logoBranco, 32)
  if (logo) primeira.push(logo)
  const larguras = dividir(LARG, [1.3, 1, 1])
  const colunas: [string, string, string][] = [
    ["Cliente", doc.cliente, doc.contato ? `A/C ${doc.contato}` : ""],
    ["Proposta", identificacaoDocumento(doc.numero, doc.versao), ""],
    ["Emitida em", dataPorExtenso(hoje), doc.validade ? `Validade: ${doc.validade}` : ""],
  ]
  return [
    par(primeira, { depois: 0 }),
    par([run("Proposta técnica e comercial", { peso: "bold", tam: 9, cor: PALETA.dourado, caixaAlta: true, espaco: 0.2 })], { antes: 61, depois: 3 }),
    ...tituloCapa(doc.empreendimento).map((l) => par([run(l, { peso: "extrabold", tam: 38, cor: PALETA.branco })], { depois: 0 })),
    par([run(subtituloCapa(doc.itens), { tam: 10.5, cor: PALETA.suaveNoNavy })], { antes: 5 }),
    tabela(
      [linhaT(colunas.map(([rotulo, valor, sub], i) =>
        celula([
          par([run(rotulo, { tam: 7.5, cor: PALETA.cinza, caixaAlta: true, espaco: 0.12 })], { depois: 1 }),
          par([run(valor || "—", { peso: "bold", tam: 10.5, cor: PALETA.tinta })], { depois: 0.5 }),
          ...(sub ? [par([run(sub, { tam: 8.5, cor: PALETA.cinza })], { depois: 0 })] : []),
        ], { largura: larguras[i], margem: 1, bordas: { left: borda(PALETA.dourado, 12) } }),
      ))],
      larguras,
      { float: { horizontalAnchor: TableAnchorType.PAGE, verticalAnchor: TableAnchorType.PAGE, absoluteHorizontalPosition: MARGEM, absoluteVerticalPosition: Math.round(262 * TW) } },
    ),
  ]
}

// ── Cabeçalho e rodapé ─────────────────────────────────────────────────

function cabecalho(doc: PropostaDoc, rec: RecursosDoc) {
  const l = dividir(LARG, [1, 2.5, 1.5])
  const logo = imagemRun(rec.imagens.logoBranco, 12)
  const cel = (filhos: Filho[], largura: number) => celula(filhos, { largura, fundo: PALETA.navy, margem: 2, alinharV: VerticalAlign.CENTER })
  return new Header({
    children: [tabela([linhaT([
      cel([par(logo ? [logo] : [run("IEX PROJETOS", { peso: "bold", tam: 9, cor: PALETA.branco })], { depois: 0 })], l[0]),
      cel([par([run("Proposta técnica e comercial", { tam: 7.5, cor: PALETA.branco, caixaAlta: true, espaco: 0.16 })], { alinhar: AlignmentType.CENTER, depois: 0 })], l[1]),
      cel([par([run(identificacaoDocumento(doc.numero, doc.versao), { tam: 7.5, cor: PALETA.branco })], { alinhar: AlignmentType.RIGHT, depois: 0 })], l[2]),
    ])], l)],
  })
}

function rodape(empresa: EmpresaDoc) {
  const l = [LARG - 1500, 1500]
  return new Footer({
    children: [tabela([linhaT([
      celula([
        par([run(contatoRodape(empresa), { tam: 7, cor: PALETA.cinza })], { depois: 0.5 }),
        par([run(empresa.textoRodape || RODAPE_PADRAO, { tam: 6.5, cor: PALETA.cinzaClaro })], { depois: 0 }),
      ], { largura: l[0], margem: 1, bordas: { top: borda(PALETA.linha) } }),
      celula([
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONTE, size: 14, color: hx(PALETA.cinza) })],
        }),
      ], { largura: l[1], margem: 1, bordas: { top: borda(PALETA.linha) } }),
    ])], l)],
  })
}

// ── Quem somos e apresentação ──────────────────────────────────────────

// Painel com foto, mapa e números; o texto institucional da IEX vem em
// parágrafos abaixo (montarWord).
function quemSomos(rec: RecursosDoc): Table {
  const l = dividir(LARG, [3.3, 3.6, 2.96])
  const socios = imagemRun(rec.imagens.socios, 52)
  const mapa = imagemRun(rec.imagens.mapa, 58)
  const numeros = INSTITUCIONAL.numeros.flatMap((n) => [
    ...(n.prefixo ? [par([run(n.prefixo, { tam: 7.5, cor: PALETA.suaveNoPainel })], { depois: 0 })] : []),
    par([run(n.valor, { peso: "extrabold", tam: 24, cor: PALETA.branco })], { depois: 0 }),
    par([run(n.rotulo, { peso: "semibold", tam: 7.8, cor: PALETA.azulClaro })], { depois: 4 }),
  ])
  const cel = (filhos: Filho[], largura: number, alinharV = VerticalAlign.CENTER) => celula(filhos, { largura, fundo: PALETA.painel, margem: 4, alinharV })
  return tabela([
    linhaT([
      cel([
        par(socios ? [socios] : [], { depois: 1 }),
        par([run(INSTITUCIONAL.socios, { peso: "bold", tam: 8, cor: PALETA.branco })], { depois: 0 }),
        par([run(INSTITUCIONAL.sociosLegenda, { tam: 7, cor: PALETA.suaveNoPainel })], { depois: 0 }),
      ], l[0], VerticalAlign.BOTTOM),
      cel([par(mapa ? [mapa] : [], { alinhar: AlignmentType.CENTER, depois: 0 })], l[1]),
      cel(numeros, l[2]),
    ]),
  ], l)
}

function ficha(doc: PropostaDoc): Table | null {
  const campos = fichaEmpreendimento(doc)
  if (!campos.length) return null
  const l = dividir(LARG, [1, 1, 1])
  const linhas: TableRow[] = []
  for (let i = 0; i < campos.length; i += 3) {
    const grupo = campos.slice(i, i + 3)
    linhas.push(linhaT(l.map((largura, k) => {
      const campo = grupo[k]
      return celula(campo ? [
        par([run(campo[0], { tam: 7, cor: PALETA.cinza, caixaAlta: true, espaco: 0.14 })], { depois: 1 }),
        par([run(campo[1], { peso: "bold", tam: 10, cor: PALETA.tinta })], { depois: 0 }),
      ] : [], { largura, margem: 3, bordas: { top: borda(PALETA.linha), bottom: borda(PALETA.linha), left: borda(PALETA.linha), right: borda(PALETA.linha) } })
    })))
  }
  return tabela(linhas, l)
}

// ── Metodologia ────────────────────────────────────────────────────────

function metodologia(rec: RecursosDoc, num: () => number): Filho[] {
  const foto = imagemRun(rec.imagens.metodologia, 174, 56)
  const l3 = dividir(LARG, [1, 1, 1])
  const l4 = dividir(LARG, [1, 1, 1, 1])
  const bordaCard = { top: borda(PALETA.linha), bottom: borda(PALETA.linha), left: borda(PALETA.linha), right: borda(PALETA.linha) }
  return [
    tituloSecao(num(), "Como trabalhamos", true),
    ...(foto ? [par([foto], { depois: 2 })] : []),
    par([
      run("Engenharia integrada  ", { tam: 8, cor: PALETA.cinza, caixaAlta: true, espaco: 0.14 }),
      run(INSTITUCIONAL.metodologiaChamada, { peso: "bold", tam: 12, cor: PALETA.navy }),
    ], { depois: 4 }),
    tabela([linhaT(INSTITUCIONAL.diferenciais.map((d, i) => {
      const icone = imagemRun(rec.icones[d.icone], 6)
      return celula([
        par(icone ? [icone] : [], { depois: 2 }),
        par([run(d.titulo, { peso: "bold", tam: 10.5, cor: PALETA.navy })], { depois: 1 }),
        par([run(d.texto, { tam: 8.4, cor: PALETA.textoCard })], { depois: 0 }),
      ], { largura: l3[i], margem: 4, bordas: bordaCard })
    }))], l3),
    tituloSecao(num(), "Nossas especialidades"),
    tabela([linhaT(INSTITUCIONAL.especialidades.map((e, i) =>
      celula([
        par([run(e.titulo, { peso: "bold", tam: 9.5, cor: PALETA.navy })], { depois: 1.5 }),
        ...e.itens.map((it) => par([run(it, { tam: 7.8, cor: PALETA.textoCard })], { depois: 0.5 })),
      ], { largura: l4[i], fundo: PALETA.faixa, margem: 3.5, bordas: { top: borda(PALETA.dourado, 12), left: borda(PALETA.branco, 12), right: borda(PALETA.branco, 12) } }),
    ))], l4),
  ]
}

// ── Escopo ─────────────────────────────────────────────────────────────

function escopo(doc: PropostaDoc, rec: RecursosDoc, num: () => number): Filho[] {
  const l = [Math.round(14 * TW), LARG - Math.round(14 * TW) - Math.round(38 * TW), Math.round(38 * TW)]
  const linhas = doc.itens.map((item) => {
    const icone = imagemRun(rec.icones[iconeDisciplina(item.disciplina)], 6)
    const bordas = { bottom: borda(PALETA.linha) }
    return linhaT([
      celula([par(icone ? [icone] : [], { depois: 0 })], { largura: l[0], margem: 2, bordas }),
      celula([
        par([run(item.disciplina, { peso: "bold", tam: 11.5, cor: PALETA.navy })], { depois: 1 }),
        ...(item.escopo ?? []).map((e) => par([run("–  ", { tam: 9, cor: PALETA.dourado }), run(e, { tam: 9, cor: PALETA.textoCard })], { depois: 0.5 })),
      ], { largura: l[1], margem: 2, bordas }),
      celula([par([run(brl(item.valor), { peso: "bold", tam: 11, cor: PALETA.tinta })], { alinhar: AlignmentType.RIGHT, depois: 0 })], { largura: l[2], margem: 2, bordas }),
    ])
  })
  const lt = dividir(LARG, [1.4, 1])
  return [
    // Sem quebra: o escopo continua na página da apresentação (revisão da IEX).
    tituloSecao(num(), "Escopo por disciplina"),
    ...(linhas.length ? [tabela(linhas, l)] : []),
    par([], { depois: 3 }),
    tabela([linhaT([
      celula([
        par([run("Investimento total", { peso: "bold", tam: 8, cor: PALETA.dourado, caixaAlta: true, espaco: 0.2 })], { depois: 1 }),
        par([run(doc.area > 0 ? `Valor global para ${formatarArea(doc.area)}` : "Valor global da proposta", { tam: 9, cor: PALETA.suaveNoNavy })], { depois: 0 }),
      ], { largura: lt[0], fundo: PALETA.navy, margem: 6, alinharV: VerticalAlign.CENTER }),
      celula([par([run(brl(doc.total), { peso: "extrabold", tam: 24, cor: PALETA.branco })], { alinhar: AlignmentType.RIGHT, depois: 0 })], { largura: lt[1], fundo: PALETA.navy, margem: 6, alinharV: VerticalAlign.CENTER }),
    ])], lt),
  ]
}

// ── Condições ──────────────────────────────────────────────────────────

function cartao(titulo: string, linhas: [string, string, string?][], largura: number): Table {
  const l = dividir(largura, [1.6, 1])
  const bordaCard = borda(PALETA.linha)
  return tabela([
    linhaT([celula([par([run(titulo, { peso: "bold", tam: 8, cor: PALETA.cinza, caixaAlta: true, espaco: 0.12 })], { depois: 0 })], { largura, colunas: 2, margem: 3, bordas: { top: bordaCard, left: bordaCard, right: bordaCard } })]),
    ...linhas.map(([rotulo, valor, pill], i) => {
      const ultima = i === linhas.length - 1
      const bordas = { left: bordaCard, right: bordaCard, bottom: ultima ? bordaCard : borda(PALETA.linha, 2) }
      return linhaT([
        celula([par([...(pill ? [run(`${pill}  `, { peso: "bold", tam: 8, cor: PALETA.dourado })] : []), run(rotulo, { tam: 9.5, cor: PALETA.tinta })], { depois: 0 })], { largura: l[0], margem: 2.5, bordas: { ...bordas, right: NENHUMA } }),
        celula([par([run(valor, { peso: "bold", tam: 9.5, cor: PALETA.tinta })], { alinhar: AlignmentType.RIGHT, depois: 0 })], { largura: l[1], margem: 2.5, bordas: { ...bordas, left: NENHUMA } }),
      ])
    }),
  ], l)
}

function condicoes(doc: PropostaDoc, empresa: EmpresaDoc, num: () => number): Filho[] {
  const gap = Math.round(8 * TW)
  const col = Math.floor((LARG - gap) / 2)
  const pagamento: [string, string, string?][] = (doc.parcelas ?? []).length
    ? (doc.parcelas ?? []).map((p) => [rotuloParcela(p.desc), brl(p.valor), formatarPercentual(percentual(p.valor, doc.total))])
    : [[doc.formaPagamento || "A combinar", ""]]
  const banco = linhasBancarias(empresa.dadosBancarios)
  const prazo: [string, string][] = [
    ["Prazo de execução", doc.prazoExecucao || "—"],
    ["Validade da proposta", doc.validade || "—"],
    ...(banco.length ? [["Dados bancários", banco.join("\n")] as [string, string]] : []),
  ]
  const filhos: Filho[] = [
    tituloSecao(num(), "Condições comerciais", true),
    tabela([linhaT([
      celula([cartao(`Pagamento — ${doc.formaPagamento || "a combinar"}`, pagamento, col)], { largura: col }),
      celula([], { largura: gap }),
      celula([cartao("Prazo e validade", prazo, col)], { largura: col }),
    ])], [col, gap, col]),
  ]

  const colunas = [
    { titulo: "Incluso", itens: doc.premissas.filter((s) => s?.trim()), marca: "✓", cor: PALETA.verde },
    { titulo: "Não incluso", itens: doc.exclusoes.filter((s) => s?.trim()), marca: "—", cor: PALETA.vermelho },
  ].filter((c) => c.itens.length)
  if (colunas.length) {
    const larguras = colunas.length === 2 ? [col, gap, col] : [LARG]
    const blocos = colunas.map((c) => [
      tituloSecao(num(), c.titulo),
      ...c.itens.map((it) => par([run(`${c.marca}  `, { peso: "bold", tam: 9.5, cor: c.cor }), run(it, { tam: 9.5, cor: PALETA.texto })], { depois: 1, bordaInferior: PALETA.linha })),
    ])
    filhos.push(tabela([linhaT(
      colunas.length === 2
        ? [celula(blocos[0], { largura: col }), celula([], { largura: gap }), celula(blocos[1], { largura: col })]
        : [celula(blocos[0], { largura: LARG })],
    )], larguras))
  }

  if (doc.observacoes?.trim()) {
    filhos.push(tituloSecao(num(), "Observações"), par([run(doc.observacoes, { tam: 9.5, cor: PALETA.texto })], { depois: 3 }))
  }

  const assinatura = assinaturaDoDocumento(doc, empresa.razaoSocial)
  const imagemAssinatura = imagemRun(empresa.assinaturaDataUrl, 0, 15)
  filhos.push(
    tituloSecao(num(), "Aceite"),
    par([run("Ao assinar, as partes concordam com o escopo, os valores e as condições descritos nesta proposta.", { tam: 9.5, cor: PALETA.texto })], { depois: 4 }),
    tabela([linhaT([
      celula([
        par(imagemAssinatura ? [imagemAssinatura] : [], { antes: imagemAssinatura ? 0 : 10, depois: 0 }),
        par([run(assinatura.nome, { peso: "bold", tam: 9.5, cor: PALETA.tinta })], { depois: 0.5, bordaSuperior: PALETA.tinta }),
        par([run(`${assinatura.cargo} · ${empresa.razaoSocial || EMPRESA_PADRAO.razaoSocial}`, { tam: 8.5, cor: PALETA.cinza })], { depois: 0 }),
      ], { largura: col, alinharV: VerticalAlign.BOTTOM }),
      celula([], { largura: gap }),
      celula([
        par([run(doc.contato || doc.cliente, { peso: "bold", tam: 9.5, cor: PALETA.tinta })], { depois: 0.5, bordaSuperior: PALETA.tinta }),
        ...(doc.contato ? [par([run(doc.cliente, { tam: 8.5, cor: PALETA.cinza })], { depois: 0 })] : []),
      ], { largura: col, alinharV: VerticalAlign.BOTTOM }),
    ])], [col, gap, col]),
  )
  return filhos
}

// ── Montagem ───────────────────────────────────────────────────────────

export function montarWord(doc: PropostaDoc, empresa: EmpresaDoc, rec: RecursosDoc): Document {
  let n = 0
  const num = () => ++n
  const tabelaFicha = ficha(doc)
  const margens = { top: Math.round(27 * TW), bottom: Math.round(24 * TW), left: MARGEM, right: MARGEM, header: Math.round(6 * TW), footer: Math.round(8 * TW) }
  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 20, color: hx(PALETA.tinta) } } } },
    sections: [
      {
        properties: { page: { size: PAGINA, margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM } } },
        children: capa(doc, rec),
      },
      {
        properties: { page: { size: PAGINA, margin: margens } },
        headers: { default: cabecalho(doc, rec) },
        footers: { default: rodape(empresa) },
        // Ordem da revisão da IEX: institucional primeiro, depois o projeto.
        children: [
          tituloSecao(num(), "Quem somos"),
          quemSomos(rec),
          ...INSTITUCIONAL.quemSomos.map((p, i) => par([run(p, { tam: 10.5, cor: PALETA.texto })], { antes: i ? 0 : 5, depois: 4 })),
          ...metodologia(rec, num),
          tituloSecao(num(), "Apresentação", true),
          par([run(doc.apresentacao || APRESENTACAO_PADRAO, { tam: 10.5, cor: PALETA.texto })], { depois: 4 }),
          ...(tabelaFicha ? [tituloSecao(num(), "Dados do empreendimento"), tabelaFicha] : []),
          ...escopo(doc, rec, num),
          ...condicoes(doc, empresa, num),
        ],
      },
    ],
  })
}

// Gera o .docx da proposta (PRD 008). Carrega imagens na primeira vez.
export async function gerarWord(doc: PropostaDoc, empresa: EmpresaDoc, recursos?: RecursosDoc): Promise<Blob> {
  return Packer.toBlob(montarWord(doc, empresa, recursos ?? (await carregarRecursos())))
}
```

Nota sobre `imagemRun(url, 0, 15)` na assinatura: com largura 0 e altura dada, a largura sai da proporção da imagem (ramo `alturaMm && d && !larguraMm`). Sem dimensões legíveis a imagem fica 15 × 15 mm. Se o tsc reclamar de `float`/`TableAnchorType` ou de `floating.wrap`, conferir os nomes em `node_modules/docx/dist/index.d.ts` (`ITableFloatOptions`, `IFloating`) e ajustar sem mudar o comportamento.

- [ ] **Step 5: Rodar os testes e os tipos**

Run: `npx vitest run lib/document/word.test.ts && npx tsc --noEmit -p .`
Expected: PASS; tsc sem saída.

- [ ] **Step 6: Gerar o .docx de exemplo para conferência**

Temporary `lib/document/word.visual.test.ts` (não commitar):

```ts
import { writeFileSync } from "node:fs"
import { Packer } from "docx"
import { it } from "vitest"
import { docExemplo, empresaExemplo } from "@/test/documento-exemplo"
import { recursosDoDisco } from "@/test/recursos-documento"
import { montarWord } from "./word"

const saida = process.env.SAIDA_WORD
it.runIf(saida)("grava o .docx de exemplo", async () => {
  writeFileSync(`${saida}/app-exemplo.docx`, await Packer.toBuffer(montarWord(docExemplo(), empresaExemplo(), recursosDoDisco({ fontes: false }))))
})
```

Run: `SAIDA_WORD=$SCRATCH npx vitest run lib/document/word.visual.test.ts && qlmanage -t -s 900 -o $SCRATCH $SCRATCH/app-exemplo.docx`
Read: `$SCRATCH/app-exemplo.docx.png` (prévia do Quick Look da 1ª página; LibreOffice não está instalado).
Expected: capa com fundo diagonal, logo e título brancos. As demais páginas o Arthur confere abrindo o .docx.

Run: `rm lib/document/word.visual.test.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/document/word.ts lib/document/word.test.ts package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(documento): Word da proposta no layout Modelo A v2

Capa com fundo em imagem e texto editável por cima; Quem somos, escopo,
total e condições em tabelas sombreadas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Documentação e validação final

**Files:**
- Modify: `docs/02-mock-contract.md` (fim), `docs/12-execution-roadmap.md` (fim), `docs/01-prd.md` (seção "Documento (PRD 008) — estrutura")

- [ ] **Step 1: Adendo ao contrato do mock**

Acrescentar ao fim de `docs/02-mock-contract.md`:

```markdown
---

## Adendo (Documento Modelo A v2 — 01/10/2026)

Divergência autorizada pelo Arthur, a pedido da IEX:

- **Layout do documento (PDF, prévia e Word)**: o documento sóbrio de cabeçalho
  institucional deu lugar ao "Modelo A v2", escolhido pela IEX entre três modelos
  apresentados.
  - *Por quê*: a proposta do produto previa um documento "dentro da identidade
    visual da IEX, com imagens de engenharia e elementos gráficos modernos".
  - *Substituição*: capa diagonal navy com faixa dourada; "Quem somos" com
    foto dos sócios, mapa, números de impacto e o texto institucional da IEX;
    metodologia (BIM, diferenciais, especialidades); apresentação, dados do
    empreendimento e escopo por disciplina com ícones; condições em cartões.
    Ordem e textos conforme a revisão da IEX de 01/10/2026.
    Paleta fixa da marca; conteúdo institucional fixo em
    `lib/document/layout-a.ts`.
  - *Preservado*: conteúdo completo do PRD 008 (cliente, obra, área,
    disciplinas, escopo, valores, total, premissas, exclusões, pagamento, prazo,
    validade, observações, assinatura), hierarquia, rodapé
    "Powered by YRM Strategy Lab", jornada do wizard e paginação adaptativa.
  - *Fora da prévia*: imagem da assinatura e dados bancários (a prévia não
    recebe os dados da empresa).
  - *Documentação impactada*: este adendo, `docs/01-prd.md` (estrutura do
    documento), `docs/12-execution-roadmap.md`, spec e plano em
    `docs/superpowers/`.
```

- [ ] **Step 2: Estrutura do documento no PRD**

Em `docs/01-prd.md`, substituir a linha logo abaixo de `## Documento (PRD 008) — estrutura` por:

```markdown
Layout "Modelo A v2" (01/10/2026), igual em PDF, prévia e Word: **capa** (empreendimento, disciplinas, cliente, nº/versão, data, validade) → **quem somos** (foto dos sócios, mapa, números e texto institucional — conteúdo fixo) → **metodologia** (BIM, diferenciais, especialidades — conteúdo fixo) → **apresentação e escopo** (texto da proposta, dados do empreendimento, disciplinas com escopo e valor, investimento total) → **condições** (pagamento com %, prazo, validade, dados bancários, incluso/não incluso, observações, aceite). Rodapé com contato da empresa e "Powered by YRM Strategy Lab". Fonte única: `lib/document/layout-a.ts`.
```

- [ ] **Step 3: Roadmap**

Acrescentar ao fim de `docs/12-execution-roadmap.md`:

```markdown

### Documento da proposta no layout Modelo A v2 (01/10/2026)

- [x] Módulo `lib/document/layout-a.ts`: paleta, conteúdo institucional fixo, regras de formatação e `paginar`.
- [x] Recursos estáticos em `public/documento` e `public/fonts` (Manrope, OFL), gerados por `scripts/documento/rasterizar.mjs`; middleware deixa de interceptar fontes.
- [x] PDF reescrito (`montarPdf`/`gerarPdf`, agora assíncrono), prévia em folhas A4 e Word em tabelas sombreadas, os três no mesmo layout.
- Validação: `pnpm test` ✓, `tsc --noEmit` ✓, `pnpm build` ✓; PDF conferido no Chrome e no PDFKit (motor do iPhone); prévia conferida renderizada fora do app; Word conferido pelo Arthur.
- Decisões: jsPDF no navegador (sem Chromium no Easypanel); conteúdo institucional fixo no código; paleta fixa (a cor primária de Configurações não afeta o documento); Quem somos do Word como tabela nativa.
- Docs impactados: `docs/02-mock-contract.md` (adendo), `docs/01-prd.md`, spec e plano em `docs/superpowers/`.

**Próxima ação:** a IEX validar um PDF real gerado em produção; trocar os números institucionais exige editar `INSTITUCIONAL` em `layout-a.ts`.
```

- [ ] **Step 4: Validação completa**

Run: `npx vitest run && npx tsc --noEmit -p . && pnpm build 2>&1 | tail -5`
Expected: todos os testes passam; tsc sem saída; build termina listando as rotas.

Run: `git checkout -- next-env.d.ts 2>/dev/null; git status --short`
Expected: só os três docs modificados.

- [ ] **Step 5: Commit**

```bash
git add docs/02-mock-contract.md docs/01-prd.md docs/12-execution-roadmap.md
git commit -m "$(cat <<'EOF'
docs: documento da proposta no layout Modelo A v2 — adendo, PRD e roadmap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Entregar**

Enviar ao Arthur o .docx de exemplo (Task 7) e um resumo. **Não** fazer push para a `main`; perguntar se sobe a branch ou abre PR.
