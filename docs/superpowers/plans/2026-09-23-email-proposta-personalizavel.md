# E-mail da proposta personalizável — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** modelo padrão de e-mail (assunto + corpo com variáveis) nas Configurações e assinatura por usuário (HTML montado ou imagem PNG/JPG) anexada a todo envio de proposta.

**Architecture:** duas unidades puras e testáveis (`lib/email/modelo.ts` renderiza variáveis; `lib/email/assinatura.ts` monta a assinatura e o corpo final em texto + HTML). Um carregador server-only (`lib/email/contexto.ts`) lê modelo, marca e perfil pela sessão. Server actions expõem leitura/escrita; `enviarProposta` passa a enviar `multipart` com imagens inline (CID) e `Reply-To` de quem envia. UI: aba "E-mail" nas Configurações, seção de assinatura no "Meu perfil", compositor pré-preenchido.

**Tech Stack:** Next.js (App Router, server actions), Supabase (Postgres + Storage bucket público `branding`), nodemailer, zod, vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-09-23-email-proposta-personalizavel-design.md`

## Global Constraints

- Sem issue/Linear: este projeto não usa as convenções da Escale. Commits sem `ESC-`.
- Mensagens de commit em português, formato `tipo(escopo): descrição`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Variáveis: sintaxe `{{nome}}`, espaços internos tolerados; conhecida sem valor → vazio; desconhecida → mantida literalmente.
- Limites: assunto ≤ 200 caracteres, corpo ≤ 5.000; imagem de assinatura PNG/JPG ≤ 500 KB.
- O corpo é sempre texto puro; todo valor interpolado em HTML passa por escape.
- Salvar modelo exige `exigirAdmin()`; assinatura só altera o próprio usuário (filtro por `auth_user_id` da sessão). Assinatura do envio é resolvida no servidor pela sessão, nunca pelo cliente.
- `from` do SMTP inalterado (Titan rejeita remetente diferente); `replyTo` = e-mail de contato de quem envia.
- Falha ao baixar imagem não bloqueia o envio; entra no `detalhe` do log.
- Migração aditiva e idempotente, com registro em `public._iex_migrations`.
- Comandos de validação: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/email/html.ts` | criar | `escaparHtml`, `textoParaHtml` |
| `lib/email/modelo.ts` | criar | variáveis, padrão, renderização, valores da proposta |
| `lib/email/assinatura.ts` | criar | montagem da assinatura e do corpo final |
| `lib/email/contexto.ts` | criar | server-only: carrega modelo/marca/perfil, baixa imagens |
| `lib/email/smtp.ts` | modificar | `html`, `replyTo`, anexos com `cid` |
| `lib/actions/email-modelo.ts` | criar | `obterModeloEmail`, `salvarModeloEmail` |
| `lib/actions/assinatura.ts` | criar | `obterMinhaAssinatura`, `salvarMinhaAssinatura`, `uploadImagemAssinatura`, `previaMinhaAssinatura` |
| `lib/actions/email.ts` | modificar | `prepararEmailProposta`; `enviarProposta` com HTML/inline/replyTo |
| `supabase/migrations/0119_email_modelo_assinatura.sql` | criar | colunas novas |
| `scripts/validate-migration-0119.mjs` | criar | confere colunas e check |
| `components/config-email-modelo.tsx` | criar | aba "E-mail" |
| `app/configuracoes/page.tsx` | modificar | registrar a aba |
| `components/assinatura-email-form.tsx` | criar | campos de assinatura (controlado) |
| `components/perfil-dialog.tsx` | modificar | carregar/salvar assinatura |
| `components/email-composer.tsx` | modificar | conteúdo inicial via props + prévia da assinatura |
| `app/propostas/nova/page.tsx`, `app/propostas/page.tsx` | modificar | preparar e-mail antes de abrir o compositor |
| `docs/02-mock-contract.md`, `docs/12-execution-roadmap.md`, `docs/14-checklist-operacional-propostas.md` | modificar | divergência, progresso, operação |

---

### Task 1: Renderização do modelo (`html.ts` + `modelo.ts`)

**Files:**
- Create: `lib/email/html.ts`
- Create: `lib/email/modelo.ts`
- Test: `lib/email/modelo.test.ts`

**Interfaces:**
- Produces:
  - `escaparHtml(s: string): string`
  - `textoParaHtml(texto: string): string`
  - `VARIAVEIS_EMAIL: readonly { token: VariavelEmail; rotulo: string }[]`
  - `type VariavelEmail`, `type ValoresEmail = Partial<Record<VariavelEmail, string>>`
  - `LIMITE_ASSUNTO = 200`, `LIMITE_CORPO = 5000`, `ASSUNTO_PADRAO`, `CORPO_PADRAO`
  - `modeloEfetivo(m: { assunto: string | null; corpo: string | null }): { assunto: string; corpo: string }`
  - `renderizarModelo(texto: string, valores: ValoresEmail): string`
  - `tokensDesconhecidos(texto: string): string[]`
  - `valoresDaProposta(doc: PropostaDoc, empresa: { razaoSocial: string }, remetente: { nome: string; cargo: string | null }): ValoresEmail`
  - `VALORES_EXEMPLO: Record<VariavelEmail, string>`

- [ ] **Step 1: Escrever o teste que falha**

`lib/email/modelo.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { brl, type PropostaDoc } from "@/lib/document/tipos"
import { escaparHtml, textoParaHtml } from "./html"
import {
  ASSUNTO_PADRAO,
  CORPO_PADRAO,
  modeloEfetivo,
  renderizarModelo,
  tokensDesconhecidos,
  valoresDaProposta,
} from "./modelo"

const doc: PropostaDoc = {
  numero: "20260923-01",
  versao: 2,
  apresentacao: "",
  cliente: "Construtora Alfa",
  contato: "Maria Souza",
  empreendimento: "Residencial Aurora",
  cidade: "Recife",
  uf: "PE",
  area: 1000,
  tipo: "Residencial",
  itens: [],
  total: 48500,
  formaPagamento: "",
  prazoExecucao: "60 dias",
  validade: "30 dias",
  premissas: [],
  exclusoes: [],
  observacoes: "",
  responsavel: "Arthur Brito",
}

describe("renderizarModelo", () => {
  it("substitui variáveis conhecidas, tolerando espaços internos", () => {
    expect(renderizarModelo("Olá {{contato}}, {{ cliente }}!", { contato: "Maria", cliente: "Alfa" })).toBe(
      "Olá Maria, Alfa!",
    )
  })

  it("variável conhecida sem valor vira vazio", () => {
    expect(renderizarModelo("[{{cidade}}]", {})).toBe("[]")
  })

  it("variável desconhecida fica como está", () => {
    expect(renderizarModelo("Oi {{apelido}} {{Cliente}}", { cliente: "Alfa" })).toBe("Oi {{apelido}} {{Cliente}}")
  })
})

describe("tokensDesconhecidos", () => {
  it("lista tokens desconhecidos sem repetir", () => {
    expect(tokensDesconhecidos("{{cliente}} {{xyz}} {{ xyz }} {{Nome}}")).toEqual(["xyz", "Nome"])
  })

  it("devolve vazio quando só há conhecidos", () => {
    expect(tokensDesconhecidos(CORPO_PADRAO + ASSUNTO_PADRAO)).toEqual([])
  })
})

describe("modeloEfetivo", () => {
  it("usa o padrão quando o campo está nulo ou em branco", () => {
    expect(modeloEfetivo({ assunto: null, corpo: "   " })).toEqual({ assunto: ASSUNTO_PADRAO, corpo: CORPO_PADRAO })
  })

  it("mantém o texto configurado", () => {
    expect(modeloEfetivo({ assunto: "A", corpo: "B" })).toEqual({ assunto: "A", corpo: "B" })
  })
})

describe("valoresDaProposta", () => {
  it("mapeia documento, empresa e remetente", () => {
    const v = valoresDaProposta(doc, { razaoSocial: "IEX Engenharia" }, { nome: "Arthur", cargo: null })
    expect(v).toMatchObject({
      cliente: "Construtora Alfa",
      contato: "Maria Souza",
      empreendimento: "Residencial Aurora",
      numero: "20260923-01 · V2",
      cidade: "Recife",
      uf: "PE",
      valor_total: brl(48500),
      validade: "30 dias",
      prazo: "60 dias",
      empresa: "IEX Engenharia",
      remetente_nome: "Arthur",
      remetente_cargo: "",
    })
  })

  it("reproduz o assunto padrão de antes", () => {
    const v = valoresDaProposta(doc, { razaoSocial: "IEX" }, { nome: "A", cargo: null })
    expect(renderizarModelo(ASSUNTO_PADRAO, v)).toBe("Proposta comercial 20260923-01 · V2 — Residencial Aurora")
  })
})

describe("html", () => {
  it("escapa os cinco caracteres especiais", () => {
    expect(escaparHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;")
  })

  it("converte quebras de linha em <br> depois de escapar", () => {
    expect(textoParaHtml("a<b\r\nc\nd")).toBe("a&lt;b<br>c<br>d")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/email/modelo.test.ts`
Expected: FAIL — `Failed to resolve import "./html"`.

- [ ] **Step 3: Implementar**

`lib/email/html.ts`:

```ts
// Escape mínimo para interpolar texto em HTML de e-mail. Todo conteúdo vindo de
// usuário (corpo, variáveis, campos da assinatura) passa por aqui.
const ENTIDADES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTIDADES[c])
}

// O corpo do e-mail é texto puro: escapa e preserva as quebras de linha.
export function textoParaHtml(texto: string): string {
  return escaparHtml(texto).replace(/\r?\n/g, "<br>")
}
```

`lib/email/modelo.ts`:

```ts
import { brl, type PropostaDoc } from "@/lib/document/tipos"
import { identificacaoDocumento } from "@/lib/propostas/identificadores"

// Modelo padrão do e-mail de envio da proposta (Configurações › E-mail).
// Sintaxe {{variavel}}; desconhecidas ficam literais para o erro ser visível.

export const VARIAVEIS_EMAIL = [
  { token: "cliente", rotulo: "Cliente" },
  { token: "contato", rotulo: "Contato" },
  { token: "empreendimento", rotulo: "Empreendimento" },
  { token: "numero", rotulo: "Nº da proposta" },
  { token: "cidade", rotulo: "Cidade" },
  { token: "uf", rotulo: "UF" },
  { token: "valor_total", rotulo: "Valor total" },
  { token: "validade", rotulo: "Validade" },
  { token: "prazo", rotulo: "Prazo" },
  { token: "empresa", rotulo: "Empresa" },
  { token: "remetente_nome", rotulo: "Seu nome" },
  { token: "remetente_cargo", rotulo: "Seu cargo" },
] as const

export type VariavelEmail = (typeof VARIAVEIS_EMAIL)[number]["token"]
export type ValoresEmail = Partial<Record<VariavelEmail, string>>

export const LIMITE_ASSUNTO = 200
export const LIMITE_CORPO = 5000

// Mesmo texto que o compositor usava fixo no código, agora com variáveis.
export const ASSUNTO_PADRAO = "Proposta comercial {{numero}} — {{empreendimento}}"
export const CORPO_PADRAO = [
  "Prezados,",
  "",
  "Segue em anexo a proposta comercial referente ao empreendimento {{empreendimento}}.",
  "",
  "Permanecemos à disposição para esclarecimentos e ajustes que se façam necessários.",
  "",
  "Atenciosamente,",
  "{{empresa}}",
].join("\n")

// Dados fictícios da prévia nas Configurações.
export const VALORES_EXEMPLO: Record<VariavelEmail, string> = {
  cliente: "Construtora Alfa",
  contato: "Maria Souza",
  empreendimento: "Residencial Aurora",
  numero: "20260923-01 · V2",
  cidade: "Recife",
  uf: "PE",
  valor_total: brl(48500),
  validade: "30 dias",
  prazo: "60 dias",
  empresa: "IEX Engenharia",
  remetente_nome: "Seu nome",
  remetente_cargo: "Seu cargo",
}

const CONHECIDAS = new Set<string>(VARIAVEIS_EMAIL.map((v) => v.token))
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g

export function modeloEfetivo(m: { assunto: string | null; corpo: string | null }): {
  assunto: string
  corpo: string
} {
  return {
    assunto: m.assunto?.trim() ? m.assunto : ASSUNTO_PADRAO,
    corpo: m.corpo?.trim() ? m.corpo : CORPO_PADRAO,
  }
}

export function renderizarModelo(texto: string, valores: ValoresEmail): string {
  return texto.replace(TOKEN, (original, nome: string) =>
    CONHECIDAS.has(nome) ? (valores[nome as VariavelEmail] ?? "") : original,
  )
}

export function tokensDesconhecidos(texto: string): string[] {
  const achados = new Set<string>()
  for (const m of texto.matchAll(TOKEN)) {
    if (!CONHECIDAS.has(m[1])) achados.add(m[1])
  }
  return [...achados]
}

export function valoresDaProposta(
  doc: PropostaDoc,
  empresa: { razaoSocial: string },
  remetente: { nome: string; cargo: string | null },
): ValoresEmail {
  return {
    cliente: doc.cliente,
    contato: doc.contato,
    empreendimento: doc.empreendimento,
    numero: identificacaoDocumento(doc.numero, doc.versao),
    cidade: doc.cidade,
    uf: doc.uf,
    valor_total: brl(doc.total),
    validade: doc.validade,
    prazo: doc.prazoExecucao,
    empresa: empresa.razaoSocial,
    remetente_nome: remetente.nome,
    remetente_cargo: remetente.cargo ?? "",
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run lib/email/modelo.test.ts`
Expected: PASS (todos os testes).

- [ ] **Step 5: Commit**

```bash
git add lib/email/html.ts lib/email/modelo.ts lib/email/modelo.test.ts
git commit -m "feat(email): renderização do modelo de e-mail com variáveis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Montagem da assinatura e do corpo final (`assinatura.ts`)

**Files:**
- Create: `lib/email/assinatura.ts`
- Test: `lib/email/assinatura.test.ts`

**Interfaces:**
- Consumes: `escaparHtml`, `textoParaHtml` (Task 1).
- Produces:
  - `type ModoAssinatura = "html" | "imagem"`
  - `interface DadosAssinatura { modo: ModoAssinatura | null; nome: string; cargo: string | null; telefone: string | null; email: string | null; fotoPath: string | null; imagemPath: string | null }`
  - `interface MarcaEmpresa { razaoSocial: string; logoPath: string | null; corPrimaria: string | null }`
  - `interface ImagemAssinatura { cid: string; path: string }`
  - `interface AssinaturaMontada { html: string; texto: string; imagens: ImagemAssinatura[] }`
  - `type ResolverImagem = (img: ImagemAssinatura) => string`
  - `corDaMarca(raw: string | null | undefined): string` (sempre `#rrggbb`)
  - `montarAssinatura(d: DadosAssinatura, marca: MarcaEmpresa, src: ResolverImagem): AssinaturaMontada`
  - `montarCorpoEmail(corpo: string, assinatura: AssinaturaMontada): { texto: string; html: string }`
  - `srcInline: ResolverImagem` (devolve `cid:<cid>`)

- [ ] **Step 1: Escrever o teste que falha**

`lib/email/assinatura.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  corDaMarca,
  montarAssinatura,
  montarCorpoEmail,
  srcInline,
  type DadosAssinatura,
  type MarcaEmpresa,
} from "./assinatura"

const base: DadosAssinatura = {
  modo: "html",
  nome: "Arthur Brito",
  cargo: "Diretor Comercial",
  telefone: "(81) 99999-0000",
  email: "arthur@iex.com",
  fotoPath: "assinaturas/u1/foto-1.png",
  imagemPath: null,
}
const marca: MarcaEmpresa = { razaoSocial: "IEX Engenharia", logoPath: "logo/1.png", corPrimaria: "#1A2B3C" }

describe("corDaMarca", () => {
  it("normaliza hex de 6 dígitos com ou sem #", () => {
    expect(corDaMarca("1A2B3C")).toBe("#1a2b3c")
    expect(corDaMarca("#1a2b3c")).toBe("#1a2b3c")
  })

  it("cai no navy padrão para oklch, vazio ou inválido", () => {
    expect(corDaMarca("oklch(0.3 0.1 250)")).toBe("#243658")
    expect(corDaMarca(null)).toBe("#243658")
  })
})

describe("montarAssinatura — modo HTML", () => {
  it("inclui foto, dados, logo e cor, com CIDs", () => {
    const a = montarAssinatura(base, marca, srcInline)
    expect(a.imagens).toEqual([
      { cid: "assinatura-foto", path: "assinaturas/u1/foto-1.png" },
      { cid: "assinatura-logo", path: "logo/1.png" },
    ])
    expect(a.html).toContain('src="cid:assinatura-foto"')
    expect(a.html).toContain('src="cid:assinatura-logo"')
    expect(a.html).toContain("Arthur Brito")
    expect(a.html).toContain("Diretor Comercial")
    expect(a.html).toContain('href="mailto:arthur@iex.com"')
    expect(a.html).toContain("#1a2b3c")
    expect(a.texto).toBe("Arthur Brito\nDiretor Comercial\n(81) 99999-0000\narthur@iex.com\nIEX Engenharia")
  })

  it("sem foto nem logo: sem imagens e com a razão social em texto", () => {
    const a = montarAssinatura({ ...base, fotoPath: null, cargo: null, telefone: null }, { ...marca, logoPath: null }, srcInline)
    expect(a.imagens).toEqual([])
    expect(a.html).not.toContain("<img")
    expect(a.html).toContain("IEX Engenharia")
    expect(a.texto).toBe("Arthur Brito\narthur@iex.com\nIEX Engenharia")
  })

  it("escapa HTML nos campos", () => {
    const a = montarAssinatura({ ...base, nome: "<script>x</script>" }, marca, srcInline)
    expect(a.html).not.toContain("<script>")
    expect(a.html).toContain("&lt;script&gt;")
  })

  it("modo nulo equivale a HTML", () => {
    expect(montarAssinatura({ ...base, modo: null }, marca, srcInline).html).toContain("Arthur Brito")
  })
})

describe("montarAssinatura — modo imagem", () => {
  it("usa só a imagem enviada", () => {
    const a = montarAssinatura({ ...base, modo: "imagem", imagemPath: "assinaturas/u1/imagem-1.png" }, marca, srcInline)
    expect(a.imagens).toEqual([{ cid: "assinatura-imagem", path: "assinaturas/u1/imagem-1.png" }])
    expect(a.html).toContain('src="cid:assinatura-imagem"')
    expect(a.html).not.toContain("assinatura-foto")
  })

  it("sem arquivo cai para HTML", () => {
    const a = montarAssinatura({ ...base, modo: "imagem", imagemPath: null }, marca, srcInline)
    expect(a.html).toContain("assinatura-foto")
  })

  it("o resolvedor define o src (prévia usa URL pública)", () => {
    const a = montarAssinatura({ ...base, modo: "imagem", imagemPath: "p.png" }, marca, (i) => `https://cdn/${i.path}`)
    expect(a.html).toContain('src="https://cdn/p.png"')
  })
})

describe("montarCorpoEmail", () => {
  it("junta corpo e assinatura em texto e em HTML escapado", () => {
    const a = { html: "<table>ass</table>", texto: "Arthur", imagens: [] }
    const r = montarCorpoEmail("Olá <Maria>\nTudo bem?", a)
    expect(r.texto).toBe("Olá <Maria>\nTudo bem?\n\n--\nArthur")
    expect(r.html).toContain("Olá &lt;Maria&gt;<br>Tudo bem?")
    expect(r.html).toContain("<table>ass</table>")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/email/assinatura.test.ts`
Expected: FAIL — `Failed to resolve import "./assinatura"`.

- [ ] **Step 3: Implementar**

`lib/email/assinatura.ts`:

```ts
import { escaparHtml, textoParaHtml } from "./html"

// Assinatura do e-mail de quem envia a proposta. Pura: recebe caminhos no
// storage e um resolvedor de `src` — `cid:` no envio real, URL pública na prévia.

export type ModoAssinatura = "html" | "imagem"

export interface DadosAssinatura {
  modo: ModoAssinatura | null
  nome: string
  cargo: string | null
  telefone: string | null
  email: string | null
  fotoPath: string | null
  imagemPath: string | null
}

export interface MarcaEmpresa {
  razaoSocial: string
  logoPath: string | null
  corPrimaria: string | null
}

export interface ImagemAssinatura {
  cid: string
  path: string
}

export interface AssinaturaMontada {
  html: string
  texto: string
  imagens: ImagemAssinatura[]
}

export type ResolverImagem = (img: ImagemAssinatura) => string

export const srcInline: ResolverImagem = (img) => `cid:${img.cid}`

// Mesmo navy institucional dos documentos (lib/document/word.ts). Cores em
// oklch não são convertíveis no servidor (sem canvas) e caem no padrão.
const COR_PADRAO = "#243658"

export function corDaMarca(raw: string | null | undefined): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw?.trim() ?? "")
  return m ? `#${m[1].toLowerCase()}` : COR_PADRAO
}

function limpo(s: string | null | undefined): string | null {
  const t = s?.trim()
  return t ? t : null
}

export function montarAssinatura(d: DadosAssinatura, marca: MarcaEmpresa, src: ResolverImagem): AssinaturaMontada {
  const nome = d.nome.trim()
  const cargo = limpo(d.cargo)
  const telefone = limpo(d.telefone)
  const email = limpo(d.email)
  const razao = limpo(marca.razaoSocial)
  const texto = [nome, cargo, telefone, email, razao].filter(Boolean).join("\n")

  if (d.modo === "imagem" && d.imagemPath) {
    const img = { cid: "assinatura-imagem", path: d.imagemPath }
    return {
      html: `<p style="margin:16px 0 0"><img src="${escaparHtml(src(img))}" alt="${escaparHtml(nome)}" style="display:block;max-width:600px;height:auto;border:0"></p>`,
      texto,
      imagens: [img],
    }
  }

  const cor = corDaMarca(marca.corPrimaria)
  const imagens: ImagemAssinatura[] = []
  const foto = d.fotoPath ? { cid: "assinatura-foto", path: d.fotoPath } : null
  const logo = marca.logoPath ? { cid: "assinatura-logo", path: marca.logoPath } : null
  if (foto) imagens.push(foto)
  if (logo) imagens.push(logo)

  const celulaFoto = foto
    ? `<td valign="top" style="padding-right:12px"><img src="${escaparHtml(src(foto))}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:32px;border:0"></td>`
    : ""
  const linhas = [
    `<div style="font-weight:bold;font-size:14px;color:#111111">${escaparHtml(nome)}</div>`,
    cargo ? `<div>${escaparHtml(cargo)}</div>` : "",
    telefone ? `<div>${escaparHtml(telefone)}</div>` : "",
    email
      ? `<div><a href="mailto:${escaparHtml(email)}" style="color:${cor};text-decoration:none">${escaparHtml(email)}</a></div>`
      : "",
    logo
      ? `<div style="padding-top:8px"><img src="${escaparHtml(src(logo))}" alt="${escaparHtml(razao ?? "")}" height="32" style="display:block;height:32px;width:auto;border:0"></div>`
      : razao
        ? `<div style="padding-top:4px;color:#666666">${escaparHtml(razao)}</div>`
        : "",
  ].join("")

  const html =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#333333"><tr>` +
    celulaFoto +
    `<td valign="top" style="border-left:3px solid ${cor};padding-left:12px">${linhas}</td>` +
    `</tr></table>`

  return { html, texto, imagens }
}

// Corpo final nas duas partes do multipart. O corpo nunca é tratado como HTML.
export function montarCorpoEmail(corpo: string, assinatura: AssinaturaMontada): { texto: string; html: string } {
  return {
    texto: `${corpo}\n\n--\n${assinatura.texto}`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">${textoParaHtml(corpo)}</div>` +
      assinatura.html,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run lib/email/assinatura.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/assinatura.ts lib/email/assinatura.test.ts
git commit -m "feat(email): montagem da assinatura (HTML ou imagem) e do corpo multipart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Migração 0119 + script de validação

**Files:**
- Create: `supabase/migrations/0119_email_modelo_assinatura.sql`
- Create: `scripts/validate-migration-0119.mjs`

**Interfaces:**
- Produces (colunas): `config_empresa.email_assunto_modelo text`, `config_empresa.email_corpo_modelo text`, `usuarios.assinatura_modo text check in ('html','imagem')`, `usuarios.assinatura_telefone text`, `usuarios.assinatura_email text`, `usuarios.assinatura_foto_path text`, `usuarios.assinatura_imagem_path text`.

- [ ] **Step 1: Escrever a migração**

`supabase/migrations/0119_email_modelo_assinatura.sql`:

```sql
-- 0119_email_modelo_assinatura.sql
-- E-mail da proposta personalizável.
--  * config_empresa: modelo padrão (assunto + corpo) com variáveis {{...}},
--    renderizado por lib/email/modelo.ts. Nulo => texto padrão do código.
--  * usuarios: assinatura de e-mail de quem envia, em modo 'html' (montada a
--    partir dos campos) ou 'imagem' (PNG/JPG no bucket branding). Nulo => 'html'.
--  Migração ADITIVA e idempotente (segue o estilo de 0110/0118). Sem backfill.
begin;

alter table public.config_empresa
  add column if not exists email_assunto_modelo text,
  add column if not exists email_corpo_modelo text;

alter table public.usuarios
  add column if not exists assinatura_modo text,
  add column if not exists assinatura_telefone text,
  add column if not exists assinatura_email text,
  add column if not exists assinatura_foto_path text,
  add column if not exists assinatura_imagem_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuarios_assinatura_modo_check'
  ) then
    alter table public.usuarios
      add constraint usuarios_assinatura_modo_check
      check (assinatura_modo is null or assinatura_modo in ('html', 'imagem'));
  end if;
end $$;

insert into public._iex_migrations (name, applied_at)
select '0119_email_modelo_assinatura.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0119_email_modelo_assinatura.sql');

commit;
```

- [ ] **Step 2: Escrever o script de validação**

`scripts/validate-migration-0119.mjs`:

```js
// Valida as colunas criadas pela migration 0119 (modelo de e-mail + assinatura).
// Os nomes conferidos são os que lib/email/contexto.ts e as actions leem.
// Uso: node scripts/validate-migration-0119.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const colunas = async (tabela) => {
  const r = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [tabela],
  )
  return new Set(r.rows.map((x) => x.column_name))
}

const empresa = await colunas('config_empresa')
for (const c of ['email_assunto_modelo', 'email_corpo_modelo']) check(`config_empresa.${c}`, empresa.has(c))

const usuarios = await colunas('usuarios')
for (const c of [
  'assinatura_modo',
  'assinatura_telefone',
  'assinatura_email',
  'assinatura_foto_path',
  'assinatura_imagem_path',
]) check(`usuarios.${c}`, usuarios.has(c))

const chk = await client.query(
  `select 1 from pg_constraint where conname = 'usuarios_assinatura_modo_check'`,
)
check('check usuarios_assinatura_modo_check', chk.rowCount === 1)

const reg = await client.query(
  `select 1 from public._iex_migrations where name = '0119_email_modelo_assinatura.sql'`,
)
check('registro em _iex_migrations', reg.rowCount === 1)

await client.end()
console.log(`\n${ok} ok, ${fail} falha(s)`)
process.exit(fail ? 1 : 0)
```

- [ ] **Step 3: Aplicar e validar (somente com autorização)**

Aplicar em banco remoto é ação externa: **perguntar ao usuário antes**. Com autorização e credenciais em `.env.local`, aplicar pelo mesmo caminho usado nas migrações anteriores (Supabase CLI / SQL editor) e rodar:

Run: `node scripts/validate-migration-0119.mjs`
Expected: `9 ok, 0 falha(s)` (7 colunas + check + registro).

Sem autorização: seguir adiante; o item fica no checklist (Task 9).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0119_email_modelo_assinatura.sql scripts/validate-migration-0119.mjs
git commit -m "feat(db): colunas de modelo de e-mail e assinatura por usuário (0119)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Envio com HTML, imagens inline e Reply-To

**Files:**
- Modify: `lib/email/smtp.ts` (interface `MensagemEmail` e `sendMail`)
- Create: `lib/email/contexto.ts`
- Modify: `lib/actions/email.ts` (adiciona `prepararEmailProposta`, altera `enviarProposta`)
- Test: `lib/actions/email.test.ts`

**Interfaces:**
- Consumes: `modeloEfetivo`, `renderizarModelo`, `valoresDaProposta` (Task 1); `montarAssinatura`, `montarCorpoEmail`, `srcInline`, tipos (Task 2); colunas (Task 3); `UsuarioSessao` de `lib/actions/_auth.ts`.
- Produces:
  - `MensagemEmail` ganha `html?: string`, `replyTo?: string`, anexos `{ nome; base64; mime; cid?: string }`.
  - `lib/email/contexto.ts`:
    - `interface ContextoEnvio { modelo: { assunto: string | null; corpo: string | null }; marca: MarcaEmpresa; assinatura: DadosAssinatura; cargo: string | null }`
    - `carregarContextoEnvio(usuario: UsuarioSessao): Promise<ContextoEnvio>` (nunca lança)
    - `urlPublicaBranding(path: string): string`
    - `baixarImagensInline(imgs: ImagemAssinatura[]): Promise<{ anexos: { nome: string; base64: string; mime: string; cid: string }[]; falhas: string[] }>`
  - `lib/actions/email.ts`:
    - `prepararEmailProposta(doc: PropostaDoc): Promise<{ ok: true; assunto: string; corpo: string; assinaturaHtml: string } | { ok: false; error: string }>`

- [ ] **Step 1: Escrever o teste que falha**

`lib/actions/email.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

// vi.mock é içado acima dos imports: o que a fábrica usa precisa vir de vi.hoisted.
const { enviarEmail, inserts } = vi.hoisted(() => ({
  enviarEmail: vi.fn(async (_msg: unknown) => "<msg-id>"),
  inserts: [] as { tabela: string; row: Record<string, unknown> }[],
}))

vi.mock("@/lib/email/smtp", () => ({
  smtpConfigurado: () => true,
  enviarEmail,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ tabela, row })
        return { error: null }
      },
    }),
  }),
}))
vi.mock("./_auth", () => ({
  exigirSessao: async () => ({
    ok: true,
    user: { authUserId: "a1", usuarioId: "u1", nome: "Arthur", email: "login@iex.com", funcao: "Editor" },
  }),
}))
vi.mock("@/lib/email/contexto", () => ({
  carregarContextoEnvio: async () => ({
    modelo: { assunto: "Proposta {{numero}} para {{cliente}}", corpo: null },
    marca: { razaoSocial: "IEX Engenharia", logoPath: "logo/1.png", corPrimaria: null },
    assinatura: {
      modo: "html",
      nome: "Arthur",
      cargo: "Diretor",
      telefone: null,
      email: "arthur@iex.com",
      fotoPath: null,
      imagemPath: null,
    },
    cargo: "Diretor",
  }),
  urlPublicaBranding: (p: string) => `https://cdn/${p}`,
  baixarImagensInline: async () => ({
    anexos: [{ nome: "assinatura-logo.png", base64: "AAA", mime: "image/png", cid: "assinatura-logo" }],
    falhas: [],
  }),
}))

import { enviarProposta, prepararEmailProposta } from "./email"

beforeEach(() => {
  enviarEmail.mockClear()
  inserts.length = 0
})

describe("enviarProposta", () => {
  it("envia texto + HTML com assinatura, imagem inline, anexo e replyTo", async () => {
    const r = await enviarProposta({
      propostaId: "p1",
      destinatario: "cliente@x.com",
      assunto: "Assunto",
      corpo: "Olá <Maria>",
      anexoTipo: "pdf",
      anexoNome: "p.pdf",
      anexoBase64: "PDF",
    })
    expect(r).toEqual({ ok: true, simulado: false, providerId: "<msg-id>" })
    const msg = enviarEmail.mock.calls[0][0] as Record<string, unknown>
    expect(msg.replyTo).toBe("arthur@iex.com")
    expect(msg.texto).toBe("Olá <Maria>\n\n--\nArthur\nDiretor\narthur@iex.com\nIEX Engenharia")
    expect(msg.html).toContain("Olá &lt;Maria&gt;")
    expect(msg.html).toContain('src="cid:assinatura-logo"')
    expect(msg.anexos).toEqual([
      { nome: "assinatura-logo.png", base64: "AAA", mime: "image/png", cid: "assinatura-logo" },
      { nome: "p.pdf", base64: "PDF", mime: "application/pdf" },
    ])
    const envio = inserts.find((i) => i.tabela === "envios_email")!
    expect(envio.row.corpo).toBe("Olá <Maria>")
  })
})

describe("prepararEmailProposta", () => {
  it("renderiza o modelo com os dados da proposta e a prévia da assinatura", async () => {
    const r = await prepararEmailProposta({
      numero: "20260923-01",
      versao: 1,
      apresentacao: "",
      cliente: "Alfa",
      contato: "Maria",
      empreendimento: "Aurora",
      cidade: "Recife",
      uf: "PE",
      area: 0,
      tipo: "",
      itens: [],
      total: 0,
      formaPagamento: "",
      prazoExecucao: "",
      validade: "",
      premissas: [],
      exclusoes: [],
      observacoes: "",
      responsavel: "Arthur",
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.assunto).toBe("Proposta 20260923-01 · V1 para Alfa")
    expect(r.corpo).toContain("empreendimento Aurora.")
    expect(r.corpo.endsWith("IEX Engenharia")).toBe(true)
    expect(r.assinaturaHtml).toContain('src="https://cdn/logo/1.png"')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/actions/email.test.ts`
Expected: FAIL — `prepararEmailProposta is not a function` / módulo `@/lib/email/contexto` inexistente.

- [ ] **Step 3: Estender `lib/email/smtp.ts`**

Substituir a interface e o `sendMail`:

```ts
export interface MensagemEmail {
  para: string
  copias?: string[]
  assunto: string
  texto: string
  // Parte HTML do multipart (opcional). Imagens referenciadas por `cid:` vêm em `anexos`.
  html?: string
  // Endereço de resposta — quem enviou a proposta. O `from` continua sendo a caixa autenticada.
  replyTo?: string
  anexos?: { nome: string; base64: string; mime: string; cid?: string }[]
}
```

```ts
  const info = await obterTransporte().sendMail({
    from: remetente,
    to: msg.para,
    cc: msg.copias?.length ? msg.copias : undefined,
    replyTo: msg.replyTo,
    subject: msg.assunto,
    text: msg.texto,
    html: msg.html,
    attachments: msg.anexos?.map((a) => ({
      filename: a.nome,
      content: Buffer.from(a.base64, "base64"),
      contentType: a.mime,
      // Com cid, o nodemailer anexa como inline (Content-Disposition: inline).
      cid: a.cid,
    })),
  })
```

- [ ] **Step 4: Criar `lib/email/contexto.ts`**

```ts
import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { UsuarioSessao } from "@/lib/actions/_auth"
import type { DadosAssinatura, ImagemAssinatura, MarcaEmpresa, ModoAssinatura } from "./assinatura"

// Tudo o que o envio precisa além do que o cliente manda: modelo, marca e a
// assinatura de QUEM ENVIA — resolvida pela sessão, nunca pelo cliente.

export interface ContextoEnvio {
  modelo: { assunto: string | null; corpo: string | null }
  marca: MarcaEmpresa
  assinatura: DadosAssinatura
  cargo: string | null
}

export function urlPublicaBranding(path: string): string {
  return createAdminClient().storage.from("branding").getPublicUrl(path).data.publicUrl
}

// Não lança: sem banco, o envio segue com o texto padrão e a assinatura mínima.
export async function carregarContextoEnvio(usuario: UsuarioSessao): Promise<ContextoEnvio> {
  try {
    return await lerContexto(usuario)
  } catch {
    return {
      modelo: { assunto: null, corpo: null },
      marca: { razaoSocial: "", logoPath: null, corPrimaria: null },
      assinatura: { modo: null, nome: usuario.nome, cargo: null, telefone: null, email: usuario.email, fotoPath: null, imagemPath: null },
      cargo: null,
    }
  }
}

async function lerContexto(usuario: UsuarioSessao): Promise<ContextoEnvio> {
  const admin = createAdminClient()
  const [empresa, perfil] = await Promise.all([
    admin
      .from("config_empresa")
      .select("razao_social,logo_path,cor_primaria,email_assunto_modelo,email_corpo_modelo")
      .eq("id", 1)
      .maybeSingle()
      .then((r) => r.data, () => null),
    admin
      .from("usuarios")
      .select("nome,cargo,email,assinatura_modo,assinatura_telefone,assinatura_email,assinatura_foto_path,assinatura_imagem_path")
      .eq("auth_user_id", usuario.authUserId)
      .maybeSingle()
      .then((r) => r.data, () => null),
  ])

  const cargo = (perfil?.cargo as string | null) ?? null
  return {
    modelo: {
      assunto: (empresa?.email_assunto_modelo as string | null) ?? null,
      corpo: (empresa?.email_corpo_modelo as string | null) ?? null,
    },
    marca: {
      razaoSocial: (empresa?.razao_social as string | null) ?? "",
      logoPath: (empresa?.logo_path as string | null) ?? null,
      corPrimaria: (empresa?.cor_primaria as string | null) ?? null,
    },
    assinatura: {
      modo: (perfil?.assinatura_modo as ModoAssinatura | null) ?? null,
      nome: (perfil?.nome as string | null) ?? usuario.nome,
      cargo,
      telefone: (perfil?.assinatura_telefone as string | null) ?? null,
      email: (perfil?.assinatura_email as string | null) || (perfil?.email as string | null) || usuario.email,
      fotoPath: (perfil?.assinatura_foto_path as string | null) ?? null,
      imagemPath: (perfil?.assinatura_imagem_path as string | null) ?? null,
    },
    cargo,
  }
}

// Baixa as imagens da assinatura para anexar inline. Falha individual não
// bloqueia o envio: a imagem é omitida e reportada em `falhas`.
export async function baixarImagensInline(
  imgs: ImagemAssinatura[],
): Promise<{ anexos: { nome: string; base64: string; mime: string; cid: string }[]; falhas: string[] }> {
  const admin = createAdminClient()
  const anexos: { nome: string; base64: string; mime: string; cid: string }[] = []
  const falhas: string[] = []
  for (const img of imgs) {
    const { data, error } = await admin.storage.from("branding").download(img.path)
    if (error || !data) {
      falhas.push(img.cid)
      continue
    }
    const ext = img.path.split(".").pop()?.toLowerCase() ?? "png"
    anexos.push({
      nome: `${img.cid}.${ext}`,
      base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
      mime: data.type || (ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png"),
      cid: img.cid,
    })
  }
  return { anexos, falhas }
}
```

- [ ] **Step 5: Alterar `lib/actions/email.ts`**

Imports no topo (substituir os atuais):

```ts
"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { exigirSessao } from "./_auth"
import { enviarEmail, smtpConfigurado } from "@/lib/email/smtp"
import { baixarImagensInline, carregarContextoEnvio, urlPublicaBranding } from "@/lib/email/contexto"
import { montarAssinatura, montarCorpoEmail, srcInline } from "@/lib/email/assinatura"
import { modeloEfetivo, renderizarModelo, valoresDaProposta } from "@/lib/email/modelo"
import type { PropostaDoc } from "@/lib/document/tipos"
```

Nova action (antes de `enviarProposta`):

```ts
// Conteúdo inicial do compositor: modelo das Configurações renderizado com a
// proposta e com quem está logado, mais a prévia da assinatura (URLs públicas).
export async function prepararEmailProposta(
  doc: PropostaDoc,
): Promise<{ ok: true; assunto: string; corpo: string; assinaturaHtml: string } | { ok: false; error: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = await carregarContextoEnvio(guard.user)
  const modelo = modeloEfetivo(ctx.modelo)
  const valores = valoresDaProposta(doc, ctx.marca, { nome: ctx.assinatura.nome, cargo: ctx.cargo })
  const assinatura = montarAssinatura(ctx.assinatura, ctx.marca, (img) => urlPublicaBranding(img.path))
  return {
    ok: true,
    assunto: renderizarModelo(modelo.assunto, valores),
    corpo: renderizarModelo(modelo.corpo, valores),
    assinaturaHtml: assinatura.html,
  }
}
```

Em `enviarProposta`, logo após `const configurado = smtpConfigurado()`, adicionar:

```ts
  // Assinatura de quem envia, sempre pela sessão.
  const ctx = await carregarContextoEnvio(guard.user)
  const assinatura = montarAssinatura(ctx.assinatura, ctx.marca, srcInline)
  const mensagem = montarCorpoEmail(input.corpo, assinatura)
  let falhasImagem: string[] = []
```

Substituir o bloco `if (configurado) { try { providerId = await enviarEmail({...}) } ... }` por:

```ts
  if (configurado) {
    try {
      const inline = await baixarImagensInline(assinatura.imagens)
      falhasImagem = inline.falhas
      providerId = await enviarEmail({
        para: input.destinatario,
        copias: input.copias,
        assunto: input.assunto,
        texto: mensagem.texto,
        html: mensagem.html,
        replyTo: ctx.assinatura.email ?? undefined,
        anexos: [...inline.anexos, { nome: input.anexoNome, base64: input.anexoBase64, mime }],
      })
    } catch (e) {
      erro = (e as Error).message
    }
  }
```

No insert de `logs_uso`, trocar `detalhe` por:

```ts
    detalhe:
      (erro ? `Falha: ${erro}` : simulado ? `Simulado para ${input.destinatario}` : `Enviado para ${input.destinatario}`) +
      (falhasImagem.length ? ` (sem imagem: ${falhasImagem.join(", ")})` : ""),
```

`envios_email.corpo` continua `input.corpo` (sem mudança).

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm vitest run lib/actions/email.test.ts`
Expected: PASS.

Run: `pnpm test`
Expected: PASS (suíte toda).

- [ ] **Step 7: Commit**

```bash
git add lib/email/smtp.ts lib/email/contexto.ts lib/actions/email.ts lib/actions/email.test.ts
git commit -m "feat(email): envio com modelo, assinatura HTML inline e Reply-To de quem envia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Actions de modelo e de assinatura

**Files:**
- Create: `lib/actions/email-modelo.ts`
- Create: `lib/actions/assinatura.ts`

**Interfaces:**
- Consumes: `exigirSessao`, `exigirAdmin`; `LIMITE_ASSUNTO`, `LIMITE_CORPO` (Task 1); `montarAssinatura`, `ModoAssinatura` (Task 2); `carregarContextoEnvio`, `urlPublicaBranding` (Task 4).
- Produces:
  - `interface ModeloEmail { assunto: string; corpo: string }` (string vazia = usar padrão)
  - `obterModeloEmail(): Promise<ModeloEmail>`
  - `salvarModeloEmail(input: ModeloEmail): Promise<{ ok: boolean; error?: string }>`
  - `interface MinhaAssinatura { modo: ModoAssinatura; telefone: string; email: string; emailLogin: string; fotoPath: string | null; fotoUrl: string | null; imagemPath: string | null; imagemUrl: string | null }`
  - `obterMinhaAssinatura(): Promise<MinhaAssinatura | null>`
  - `salvarMinhaAssinatura(input: { modo: ModoAssinatura; telefone: string; email: string; fotoPath: string | null; imagemPath: string | null }): Promise<{ ok: boolean; error?: string }>`
  - `uploadImagemAssinatura(tipo: "foto" | "imagem", formData: FormData): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }>`
  - `previaMinhaAssinatura(): Promise<string>` (HTML com URLs públicas; `""` sem sessão)

Sem teste unitário próprio: são adaptadores finos sobre Supabase; a regra está nas unidades puras (Tasks 1–2) e é exercitada na verificação manual da Task 8.

- [ ] **Step 1: Criar `lib/actions/email-modelo.ts`**

```ts
"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirAdmin, exigirSessao } from "./_auth"
import { LIMITE_ASSUNTO, LIMITE_CORPO } from "@/lib/email/modelo"

// Modelo padrão do e-mail de proposta (Configurações › E-mail). String vazia
// significa "usar o texto padrão" — gravado como nulo.
export interface ModeloEmail {
  assunto: string
  corpo: string
}

const schema = z.object({
  assunto: z.string().max(LIMITE_ASSUNTO),
  corpo: z.string().max(LIMITE_CORPO),
})

export async function obterModeloEmail(): Promise<ModeloEmail> {
  const guard = await exigirSessao()
  if (!guard.ok) return { assunto: "", corpo: "" }
  const { data } = await createAdminClient()
    .from("config_empresa")
    .select("email_assunto_modelo,email_corpo_modelo")
    .eq("id", 1)
    .maybeSingle()
  return {
    assunto: (data?.email_assunto_modelo as string | null) ?? "",
    corpo: (data?.email_corpo_modelo as string | null) ?? "",
  }
}

export async function salvarModeloEmail(input: ModeloEmail): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const v = schema.safeParse(input)
  if (!v.success) {
    return { ok: false, error: `O assunto aceita até ${LIMITE_ASSUNTO} caracteres e o corpo até ${LIMITE_CORPO}.` }
  }
  const admin = createAdminClient()
  const { error } = await admin.from("config_empresa").upsert(
    {
      id: 1,
      email_assunto_modelo: v.data.assunto.trim() || null,
      email_corpo_modelo: v.data.corpo.trim() ? v.data.corpo : null,
    },
    { onConflict: "id" },
  )
  if (error) return { ok: false, error: error.message }
  await admin.from("logs_uso").insert({
    usuario_id: guard.user.usuarioId,
    usuario_nome: guard.user.nome,
    acao: "Modelo de e-mail atualizado",
    entidade: "Configurações",
  })
  return { ok: true }
}
```

- [ ] **Step 2: Criar `lib/actions/assinatura.ts`**

```ts
"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirSessao } from "./_auth"
import { montarAssinatura, type ModoAssinatura } from "@/lib/email/assinatura"
import { carregarContextoEnvio, urlPublicaBranding } from "@/lib/email/contexto"

// Assinatura de e-mail do PRÓPRIO usuário. Mesma regra de atualizarMeuPerfil:
// escreve com service-role, sempre filtrando pelo auth_user_id da sessão.

export interface MinhaAssinatura {
  modo: ModoAssinatura
  telefone: string
  email: string // vazio = usa o e-mail do login
  emailLogin: string
  fotoPath: string | null
  fotoUrl: string | null
  imagemPath: string | null
  imagemUrl: string | null
}

const TIPOS_IMAGEM = ["image/png", "image/jpeg"]
const MAX_BYTES = 500 * 1024

const schema = z.object({
  modo: z.enum(["html", "imagem"]),
  telefone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]),
  fotoPath: z.string().nullable(),
  imagemPath: z.string().nullable(),
})

export async function obterMinhaAssinatura(): Promise<MinhaAssinatura | null> {
  const guard = await exigirSessao()
  if (!guard.ok) return null
  const { data } = await createAdminClient()
    .from("usuarios")
    .select("assinatura_modo,assinatura_telefone,assinatura_email,assinatura_foto_path,assinatura_imagem_path")
    .eq("auth_user_id", guard.user.authUserId)
    .maybeSingle()
  const fotoPath = (data?.assinatura_foto_path as string | null) ?? null
  const imagemPath = (data?.assinatura_imagem_path as string | null) ?? null
  return {
    modo: (data?.assinatura_modo as ModoAssinatura | null) ?? "html",
    telefone: (data?.assinatura_telefone as string | null) ?? "",
    email: (data?.assinatura_email as string | null) ?? "",
    emailLogin: guard.user.email ?? "",
    fotoPath,
    fotoUrl: fotoPath ? urlPublicaBranding(fotoPath) : null,
    imagemPath,
    imagemUrl: imagemPath ? urlPublicaBranding(imagemPath) : null,
  }
}

export async function salvarMinhaAssinatura(input: {
  modo: ModoAssinatura
  telefone: string
  email: string
  fotoPath: string | null
  imagemPath: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }
  const v = schema.safeParse(input)
  if (!v.success) return { ok: false, error: "Confira o telefone e o e-mail da assinatura." }

  // Só aceita imagens da pasta do próprio usuário: impede apontar para arquivo alheio.
  const pasta = `assinaturas/${guard.user.usuarioId}/`
  for (const p of [v.data.fotoPath, v.data.imagemPath]) {
    if (p && (!p.startsWith(pasta) || p.includes(".."))) return { ok: false, error: "Imagem inválida." }
  }

  const { error } = await createAdminClient()
    .from("usuarios")
    .update({
      assinatura_modo: v.data.modo,
      assinatura_telefone: v.data.telefone || null,
      assinatura_email: v.data.email || null,
      assinatura_foto_path: v.data.fotoPath,
      assinatura_imagem_path: v.data.imagemPath,
    })
    .eq("auth_user_id", guard.user.authUserId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function uploadImagemAssinatura(
  tipo: "foto" | "imagem",
  formData: FormData,
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }
  const file = formData.get("file") as File | null
  if (!file) return { ok: false, error: "Arquivo ausente." }
  if (!TIPOS_IMAGEM.includes(file.type)) return { ok: false, error: "Use uma imagem PNG ou JPG." }
  if (file.size > MAX_BYTES) return { ok: false, error: "A imagem deve ter até 500 KB." }

  const ext = file.type === "image/png" ? "png" : "jpg"
  const path = `assinaturas/${guard.user.usuarioId}/${tipo}-${Date.now()}.${ext}`
  const { error } = await createAdminClient()
    .storage.from("branding")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, path, url: urlPublicaBranding(path) }
}

// Prévia da assinatura de quem está logado (Configurações › E-mail).
export async function previaMinhaAssinatura(): Promise<string> {
  const guard = await exigirSessao()
  if (!guard.ok) return ""
  const ctx = await carregarContextoEnvio(guard.user)
  return montarAssinatura(ctx.assinatura, ctx.marca, (img) => urlPublicaBranding(img.path)).html
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/email-modelo.ts lib/actions/assinatura.ts
git commit -m "feat(email): actions de modelo de e-mail e assinatura do usuário

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Aba "E-mail" nas Configurações

**Files:**
- Create: `components/config-email-modelo.tsx`
- Modify: `app/configuracoes/page.tsx` (TabsList ~linha 335-339; TabsContent após ~linha 813; import)

**Interfaces:**
- Consumes: `obterModeloEmail`, `salvarModeloEmail`, `ModeloEmail` (Task 5); `previaMinhaAssinatura` (Task 5); `VARIAVEIS_EMAIL`, `VALORES_EXEMPLO`, `LIMITE_ASSUNTO`, `LIMITE_CORPO`, `modeloEfetivo`, `renderizarModelo`, `tokensDesconhecidos` (Task 1); `textoParaHtml` (Task 1).
- Produces: `ConfigEmailModelo` (componente sem props).

- [ ] **Step 1: Criar o componente**

`components/config-email-modelo.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { obterModeloEmail, salvarModeloEmail } from "@/lib/actions/email-modelo"
import { previaMinhaAssinatura } from "@/lib/actions/assinatura"
import { textoParaHtml } from "@/lib/email/html"
import {
  ASSUNTO_PADRAO,
  CORPO_PADRAO,
  LIMITE_ASSUNTO,
  LIMITE_CORPO,
  VALORES_EXEMPLO,
  VARIAVEIS_EMAIL,
  modeloEfetivo,
  renderizarModelo,
  tokensDesconhecidos,
} from "@/lib/email/modelo"

type Campo = "assunto" | "corpo"

// Modelo padrão do e-mail de envio da proposta. Campos vazios = texto padrão.
export function ConfigEmailModelo() {
  const [assunto, setAssunto] = useState("")
  const [corpo, setCorpo] = useState("")
  const [assinaturaHtml, setAssinaturaHtml] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const assuntoRef = useRef<HTMLInputElement>(null)
  const corpoRef = useRef<HTMLTextAreaElement>(null)
  const ultimoCampo = useRef<Campo>("corpo")

  useEffect(() => {
    Promise.all([obterModeloEmail(), previaMinhaAssinatura()])
      .then(([m, html]) => {
        setAssunto(m.assunto)
        setCorpo(m.corpo)
        setAssinaturaHtml(html)
      })
      .catch(() => toast.error("Não foi possível carregar o modelo de e-mail."))
      .finally(() => setCarregando(false))
  }, [])

  // Insere o token na posição do cursor do último campo focado.
  function inserir(token: string) {
    const texto = `{{${token}}}`
    const campo = ultimoCampo.current
    const el = campo === "assunto" ? assuntoRef.current : corpoRef.current
    const atual = campo === "assunto" ? assunto : corpo
    const ini = el?.selectionStart ?? atual.length
    const fim = el?.selectionEnd ?? atual.length
    const novo = atual.slice(0, ini) + texto + atual.slice(fim)
    if (campo === "assunto") setAssunto(novo)
    else setCorpo(novo)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(ini + texto.length, ini + texto.length)
    })
  }

  async function salvar() {
    setSalvando(true)
    try {
      const res = await salvarModeloEmail({ assunto, corpo })
      if (res.ok) toast.success("Modelo de e-mail salvo.")
      else toast.error(res.error ?? "Não foi possível salvar o modelo.")
    } catch {
      toast.error("Não foi possível salvar o modelo.")
    } finally {
      setSalvando(false)
    }
  }

  const efetivo = modeloEfetivo({ assunto, corpo })
  const desconhecidos = tokensDesconhecidos(`${assunto}\n${corpo}`)

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">E-mail da proposta</h3>
        <p className="text-sm text-muted-foreground">
          Texto padrão do e-mail de envio. Quem envia ainda pode editar antes de mandar. A assinatura é de cada
          pessoa e fica em Meu perfil.
        </p>
      </div>
      <Separator />

      <div className="space-y-1.5">
        <Label>Variáveis</Label>
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS_EMAIL.map((v) => (
            <Button
              key={v.token}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => inserir(v.token)}
              disabled={carregando}
              title={`Insere {{${v.token}}}`}
            >
              {v.rotulo}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email-modelo-assunto">Assunto</Label>
        <Input
          id="email-modelo-assunto"
          ref={assuntoRef}
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          onFocus={() => (ultimoCampo.current = "assunto")}
          placeholder={ASSUNTO_PADRAO}
          maxLength={LIMITE_ASSUNTO}
          disabled={carregando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-modelo-corpo">Corpo</Label>
        <Textarea
          id="email-modelo-corpo"
          ref={corpoRef}
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          onFocus={() => (ultimoCampo.current = "corpo")}
          placeholder={CORPO_PADRAO}
          maxLength={LIMITE_CORPO}
          rows={10}
          disabled={carregando}
        />
        <p className="text-xs text-muted-foreground">Em branco, usamos o texto padrão mostrado no campo.</p>
      </div>

      {desconhecidos.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-[oklch(0.45_0.13_75)] dark:text-[oklch(0.82_0.11_75)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Variáveis não reconhecidas, enviadas como estão: {desconhecidos.map((t) => `{{${t}}}`).join(", ")}
        </p>
      )}

      <div className="space-y-1.5">
        <Label>Prévia (dados de exemplo)</Label>
        <div className="rounded-md border border-border bg-white p-4 text-[#222]">
          <p className="mb-3 border-b border-neutral-200 pb-2 text-sm font-semibold">
            {renderizarModelo(efetivo.assunto, VALORES_EXEMPLO)}
          </p>
          <div
            className="text-sm"
            dangerouslySetInnerHTML={{
              __html: textoParaHtml(renderizarModelo(efetivo.corpo, VALORES_EXEMPLO)) + assinaturaHtml,
            }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={carregando || salvando}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          Salvar modelo
        </Button>
      </div>
    </Card>
  )
}
```

`dangerouslySetInnerHTML` é seguro aqui: o corpo passa por `textoParaHtml` e a assinatura é gerada por `montarAssinatura`, que escapa todos os campos.

- [ ] **Step 2: Registrar a aba em `app/configuracoes/page.tsx`**

Import (junto aos demais `@/components`):

```tsx
import { ConfigEmailModelo } from "@/components/config-email-modelo"
```

No `TabsList`, após `<TabsTrigger value="notificacoes">Notificações</TabsTrigger>`:

```tsx
            <TabsTrigger value="email">E-mail</TabsTrigger>
```

Após o bloco `{/* Notificações */} <TabsContent value="notificacoes" ...>...</TabsContent>`:

```tsx
          {/* E-mail da proposta */}
          <TabsContent value="email" className="mt-5">
            <ConfigEmailModelo />
          </TabsContent>
```

- [ ] **Step 3: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sem erros.

Verificação no navegador (preview do dev server): abrir `/configuracoes`, aba **E-mail**; clicar numa variável com o cursor no corpo insere o token; digitar `{{xyz}}` mostra o aviso; a prévia atualiza ao digitar; salvar como Editor mostra "Ação restrita a administradores."; como Administrador mostra "Modelo de e-mail salvo." e persiste ao recarregar.

- [ ] **Step 4: Commit**

```bash
git add components/config-email-modelo.tsx app/configuracoes/page.tsx
git commit -m "feat(configuracoes): aba E-mail com modelo padrão, variáveis e prévia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Assinatura no "Meu perfil"

**Files:**
- Create: `components/assinatura-email-form.tsx`
- Modify: `components/perfil-dialog.tsx`

**Interfaces:**
- Consumes: `obterMinhaAssinatura`, `salvarMinhaAssinatura`, `uploadImagemAssinatura`, `MinhaAssinatura` (Task 5); `ModoAssinatura` (Task 2).
- Produces: `AssinaturaEmailForm({ valor, onChange, desabilitado })` controlado, onde `valor: MinhaAssinatura`.

- [ ] **Step 1: Criar `components/assinatura-email-form.tsx`**

```tsx
"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { uploadImagemAssinatura, type MinhaAssinatura } from "@/lib/actions/assinatura"
import type { ModoAssinatura } from "@/lib/email/assinatura"

// Campos da assinatura de e-mail (controlado pelo PerfilDialog, que salva junto
// com nome e cargo). Upload sobe na hora; o caminho só vale depois de salvar.
export function AssinaturaEmailForm({
  valor,
  onChange,
  desabilitado,
}: {
  valor: MinhaAssinatura
  onChange: (v: MinhaAssinatura) => void
  desabilitado?: boolean
}) {
  const [enviando, setEnviando] = useState<"foto" | "imagem" | null>(null)
  const fotoInput = useRef<HTMLInputElement>(null)
  const imagemInput = useRef<HTMLInputElement>(null)

  async function subir(tipo: "foto" | "imagem", file: File | undefined) {
    if (!file) return
    setEnviando(tipo)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadImagemAssinatura(tipo, fd)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onChange(
        tipo === "foto"
          ? { ...valor, fotoPath: res.path, fotoUrl: res.url }
          : { ...valor, imagemPath: res.path, imagemUrl: res.url },
      )
    } catch {
      toast.error("Não foi possível enviar a imagem.")
    } finally {
      setEnviando(null)
    }
  }

  const modos: { id: ModoAssinatura; rotulo: string }[] = [
    { id: "html", rotulo: "Montada" },
    { id: "imagem", rotulo: "Imagem" },
  ]

  return (
    <div className="space-y-3">
      <div>
        <Label>Assinatura de e-mail</Label>
        <p className="text-xs text-muted-foreground">Vai no fim de toda proposta que você enviar.</p>
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de assinatura">
        {modos.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={valor.modo === m.id}
            disabled={desabilitado}
            onClick={() => onChange({ ...valor, modo: m.id })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
              valor.modo === m.id
                ? "border-primary bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:bg-secondary/50",
            )}
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      {valor.modo === "html" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {valor.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={valor.fotoUrl} alt="" className="h-12 w-12 rounded-full border border-border object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full border border-dashed border-border" />
            )}
            <input
              ref={fotoInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => subir("foto", e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={desabilitado || enviando !== null}
              onClick={() => fotoInput.current?.click()}
            >
              {enviando === "foto" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {valor.fotoUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            {valor.fotoPath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={desabilitado}
                onClick={() => onChange({ ...valor, fotoPath: null, fotoUrl: null })}
                aria-label="Remover foto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assinatura-telefone">Telefone</Label>
              <Input
                id="assinatura-telefone"
                value={valor.telefone}
                onChange={(e) => onChange({ ...valor, telefone: e.target.value })}
                placeholder="(81) 99999-0000"
                maxLength={40}
                disabled={desabilitado}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assinatura-email">E-mail de contato</Label>
              <Input
                id="assinatura-email"
                type="email"
                value={valor.email}
                onChange={(e) => onChange({ ...valor, email: e.target.value })}
                placeholder={valor.emailLogin}
                maxLength={120}
                disabled={desabilitado}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Nome e cargo vêm dos campos acima; logo e cor, da Identidade visual da empresa. As respostas do cliente
            vão para o e-mail de contato.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {valor.imagemUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor.imagemUrl} alt="Assinatura" className="max-h-32 max-w-full rounded border border-border" />
          )}
          <input
            ref={imagemInput}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => subir("imagem", e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={desabilitado || enviando !== null}
            onClick={() => imagemInput.current?.click()}
          >
            {enviando === "imagem" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {valor.imagemUrl ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG ou JPG até 500 KB, exibida com até 600px de largura. Sem imagem, usamos a assinatura montada.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrar em `components/perfil-dialog.tsx`**

Imports adicionais:

```tsx
import { Separator } from "@/components/ui/separator"
import { AssinaturaEmailForm } from "@/components/assinatura-email-form"
import { obterMinhaAssinatura, salvarMinhaAssinatura, type MinhaAssinatura } from "@/lib/actions/assinatura"
```

Estado (após `const [salvando, setSalvando] = useState(false)`):

```tsx
  const [assinatura, setAssinatura] = useState<MinhaAssinatura | null>(null)
```

Carregar ao abrir — substituir o `useEffect` existente por:

```tsx
  // Reabrir o diálogo descarta edições não salvas e volta ao perfil vigente.
  useEffect(() => {
    if (!open) return
    setNome(usuario.nome)
    setCargo(usuario.cargo ?? "")
    setAssinatura(null)
    let ativo = true
    obterMinhaAssinatura()
      .then((a) => ativo && setAssinatura(a))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [open, usuario.nome, usuario.cargo])
```

Em `salvar`, depois de `if (!res.ok || !res.perfil) { ... return }` e antes de `onSalvo(res.perfil)`:

```tsx
      if (assinatura) {
        const resAss = await salvarMinhaAssinatura({
          modo: assinatura.modo,
          telefone: assinatura.telefone,
          email: assinatura.email,
          fotoPath: assinatura.fotoPath,
          imagemPath: assinatura.imagemPath,
        })
        if (!resAss.ok) {
          toast.error(resAss.error ?? "Não foi possível salvar a assinatura.")
          return
        }
      }
```

`<DialogContent>` → `<DialogContent className="max-h-[90vh] overflow-y-auto">`.

Dentro de `<div className="space-y-4 py-4">`, após o bloco "Permissão de acesso":

```tsx
            <Separator />
            {assinatura ? (
              <AssinaturaEmailForm valor={assinatura} onChange={setAssinatura} desabilitado={salvando} />
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Carregando assinatura…
              </p>
            )}
```

Atualizar o `DialogDescription` para: `Como você aparece na plataforma, nas propostas que gerar e nos e-mails que enviar.`

- [ ] **Step 3: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sem erros.

Navegador: abrir Meu perfil; alternar Montada/Imagem; enviar foto PNG (aparece o avatar); enviar arquivo > 500 KB mostra "A imagem deve ter até 500 KB."; salvar e reabrir mantém os valores.

- [ ] **Step 4: Commit**

```bash
git add components/assinatura-email-form.tsx components/perfil-dialog.tsx
git commit -m "feat(perfil): assinatura de e-mail montada ou em imagem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Compositor pré-preenchido nos dois fluxos de envio

**Files:**
- Modify: `components/email-composer.tsx`
- Modify: `app/propostas/nova/page.tsx` (estado ~linha 191; efeito após `setDocBundle`; render ~linha 1982)
- Modify: `app/propostas/page.tsx` (`EnviarDialog`, ~linhas 665-790)
- Modify: `lib/email/modelo.ts` (helper de fallback local)
- Test: `lib/email/modelo.test.ts`

**Interfaces:**
- Consumes: `prepararEmailProposta` (Task 4); `ASSUNTO_PADRAO`, `CORPO_PADRAO`, `renderizarModelo`, `valoresDaProposta` (Task 1).
- Produces:
  - `rascunhoPadrao(doc: PropostaDoc, razaoSocial: string): { assunto: string; corpo: string }` em `lib/email/modelo.ts`
  - `interface EmailInicial { assunto: string; corpo: string; assinaturaHtml: string }` em `components/email-composer.tsx`
  - `EmailComposer` props: `{ destinatarioInicial: string; numero: string; versao: number; inicial: EmailInicial; onEnviar }` (remove `empreendimento`)

- [ ] **Step 1: Teste do fallback (falha)**

Adicionar em `lib/email/modelo.test.ts` (acrescentar `rascunhoPadrao` ao import de `./modelo`):

```ts
describe("rascunhoPadrao", () => {
  it("renderiza o padrão só com o documento, sem remetente", () => {
    const r = rascunhoPadrao(doc, "IEX Engenharia")
    expect(r.assunto).toBe("Proposta comercial 20260923-01 · V2 — Residencial Aurora")
    expect(r.corpo.endsWith("IEX Engenharia")).toBe(true)
  })
})
```

Run: `pnpm vitest run lib/email/modelo.test.ts`
Expected: FAIL — `rascunhoPadrao is not a function`.

- [ ] **Step 2: Implementar o helper**

Ao fim de `lib/email/modelo.ts`:

```ts
// Fallback do compositor quando o servidor não responde: texto padrão com os
// dados que o cliente já tem. A assinatura é aplicada no envio de qualquer forma.
export function rascunhoPadrao(doc: PropostaDoc, razaoSocial: string): { assunto: string; corpo: string } {
  const valores = valoresDaProposta(doc, { razaoSocial }, { nome: "", cargo: null })
  return { assunto: renderizarModelo(ASSUNTO_PADRAO, valores), corpo: renderizarModelo(CORPO_PADRAO, valores) }
}
```

Run: `pnpm vitest run lib/email/modelo.test.ts`
Expected: PASS.

- [ ] **Step 3: Alterar `components/email-composer.tsx`**

Remover o import de `identificacaoDocumento` (manter `nomeDocumentoVersionado`). Adicionar, depois de `ResultadoEnvio`:

```tsx
// Conteúdo inicial vindo de prepararEmailProposta (modelo das Configurações +
// assinatura de quem está logado).
export interface EmailInicial {
  assunto: string
  corpo: string
  assinaturaHtml: string
}
```

Assinatura do componente: trocar `empreendimento` por `inicial`:

```tsx
export function EmailComposer({
  destinatarioInicial,
  numero,
  versao,
  inicial,
  onEnviar,
}: {
  destinatarioInicial: string
  numero: string
  versao: number
  inicial: EmailInicial
  onEnviar: (dados: {
    destinatario: string
    copias: string
    assunto: string
    corpo: string
    anexo: "pdf" | "word"
  }) => Promise<ResultadoEnvio>
}) {
```

Estados de assunto/corpo:

```tsx
  const [assunto, setAssunto] = useState(inicial.assunto)
  const [corpo, setCorpo] = useState(inicial.corpo)
```

Logo após o bloco do `Textarea` do corpo (antes de "Anexo"):

```tsx
      {inicial.assinaturaHtml && (
        <div className="space-y-1.5">
          <Label>Assinatura</Label>
          <div
            className="rounded-md border border-border bg-white p-3 text-[#222]"
            // HTML gerado por montarAssinatura, com todos os campos escapados.
            dangerouslySetInnerHTML={{ __html: inicial.assinaturaHtml }}
          />
          <p className="text-xs text-muted-foreground">Edite a sua assinatura em Meu perfil.</p>
        </div>
      )}
```

- [ ] **Step 4: Alterar `app/propostas/page.tsx` (`EnviarDialog`)**

Imports: acrescentar `prepararEmailProposta` ao import de `@/lib/actions/email`, `type EmailInicial` ao import de `@/components/email-composer`, e `import { rascunhoPadrao } from "@/lib/email/modelo"`.

Trocar o estado do bundle para carregar também o e-mail:

```tsx
  const [bundle, setBundle] = useState<{ doc: PropostaDoc; empresa: EmpresaDoc; email: EmailInicial } | null>(null)
```

Substituir o `.then((b) => { ... })` do efeito por:

```tsx
      .then(async (b) => {
        if (!ativo) return
        if (!b) {
          setErro(true)
          return
        }
        const prep = await prepararEmailProposta(b.doc).catch(() => null)
        const email: EmailInicial =
          prep && prep.ok
            ? { assunto: prep.assunto, corpo: prep.corpo, assinaturaHtml: prep.assinaturaHtml }
            : { ...rascunhoPadrao(b.doc, b.empresa.razaoSocial), assinaturaHtml: "" }
        if (ativo) setBundle({ ...b, email })
      })
```

No render do `EmailComposer`, trocar `empreendimento={proposta?.empreendimento || ""}` por `inicial={bundle.email}`.

- [ ] **Step 5: Alterar `app/propostas/nova/page.tsx`**

Imports: acrescentar `prepararEmailProposta` ao import de `@/lib/actions/email`, `type EmailInicial` ao import de `@/components/email-composer`, e `import { rascunhoPadrao } from "@/lib/email/modelo"`.

Após `const [docBundle, setDocBundle] = useState<...>(null)` (~linha 191):

```tsx
  const [emailInicial, setEmailInicial] = useState<EmailInicial | null>(null)

  // Prepara o e-mail (modelo + assinatura) sempre que um documento é gerado.
  useEffect(() => {
    if (!docBundle) {
      setEmailInicial(null)
      return
    }
    let ativo = true
    setEmailInicial(null)
    prepararEmailProposta(docBundle.doc)
      .catch(() => null)
      .then((prep) => {
        if (!ativo) return
        setEmailInicial(
          prep && prep.ok
            ? { assunto: prep.assunto, corpo: prep.corpo, assinaturaHtml: prep.assinaturaHtml }
            : { ...rascunhoPadrao(docBundle.doc, docBundle.empresa.razaoSocial), assinaturaHtml: "" },
        )
      })
    return () => {
      ativo = false
    }
  }, [docBundle])
```

No render (~linha 1981), substituir o `<div className="no-print"><EmailComposer ... /></div>` por:

```tsx
            <div className="no-print">
              {emailInicial ? (
                <EmailComposer
                  destinatarioInicial={email}
                  numero={generatedDoc.numero}
                  versao={generatedDoc.versao}
                  inicial={emailInicial}
                  onEnviar={handleEnviarEmail}
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  Preparando e-mail…
                </div>
              )}
            </div>
```

Se `nomeObra` deixar de ser usado em algum lugar só por causa desta troca, o lint acusará; manter se ainda for usado no restante da página.

- [ ] **Step 6: Verificar**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint`
Expected: tudo verde.

Navegador: em `/propostas`, abrir "Enviar" de uma proposta → assunto/corpo vêm do modelo configurado na Task 6 com os dados da proposta; a prévia da assinatura aparece abaixo do corpo. Repetir no fim do wizard `/propostas/nova`. Sem SMTP configurado, enviar mostra "Envio simulado" (fluxo inalterado).

- [ ] **Step 7: Commit**

```bash
git add lib/email/modelo.ts lib/email/modelo.test.ts components/email-composer.tsx app/propostas/page.tsx app/propostas/nova/page.tsx
git commit -m "feat(propostas): compositor abre com o modelo da empresa e a assinatura de quem envia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentação e validação final

**Files:**
- Modify: `docs/02-mock-contract.md`
- Modify: `docs/12-execution-roadmap.md`
- Modify: `docs/14-checklist-operacional-propostas.md`
- Modify: `docs/superpowers/specs/2026-09-23-email-proposta-personalizavel-design.md` (seção 3: assinatura de `prepararEmailProposta(doc)`)

- [ ] **Step 1: Mock contract** — acrescentar ao fim de `docs/02-mock-contract.md`:

```markdown
## Divergência declarada — e-mail da proposta personalizável (23/09/2026)

- **Diverge:** o compositor de e-mail deixa de ter assunto/corpo fixos; Configurações ganha a aba "E-mail"; Meu perfil ganha a seção "Assinatura de e-mail".
- **Por quê:** o texto precisa ser da empresa, não do código, e o cliente precisa saber quem enviou e como responder.
- **Substitui por:** modelo padrão com variáveis `{{...}}` (`lib/email/modelo.ts`), assinatura por usuário em HTML montado ou imagem (`lib/email/assinatura.ts`), `Reply-To` com o e-mail de contato de quem envia.
- **Spec:** `docs/superpowers/specs/2026-09-23-email-proposta-personalizavel-design.md`.
```

- [ ] **Step 2: Roadmap** — acrescentar ao fim de `docs/12-execution-roadmap.md`:

```markdown
### E-mail da proposta personalizável (23/09/2026)

- [x] Modelo padrão (assunto + corpo) com variáveis em Configurações › E-mail (`components/config-email-modelo.tsx`, `lib/actions/email-modelo.ts`). Vazio = texto padrão anterior.
- [x] Assinatura por usuário em Meu perfil: montada (foto, nome, cargo, telefone, e-mail, logo/cor da empresa) ou imagem PNG/JPG ≤ 500 KB (`components/assinatura-email-form.tsx`, `lib/actions/assinatura.ts`).
- [x] Envio multipart texto + HTML, imagens inline (CID), `Reply-To` de quem envia (`lib/email/assinatura.ts`, `lib/email/contexto.ts`, `lib/email/smtp.ts`, `lib/actions/email.ts`).
- [x] Migração `0119_email_modelo_assinatura.sql` + `scripts/validate-migration-0119.mjs`.
- Validação: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` (preencher com o resultado real).
- Decisões: corpo sempre texto puro; cores oklch caem no navy padrão na assinatura (sem canvas no servidor); falha de imagem não bloqueia envio.
- Docs impactados: `docs/02-mock-contract.md`, `docs/14-checklist-operacional-propostas.md`.

**Próxima ação:** aplicar a 0119 no banco remoto, configurar o modelo e as assinaturas, e fazer um envio real conferindo HTML no Gmail e no Outlook.
```

- [ ] **Step 3: Checklist operacional** — em `docs/14-checklist-operacional-propostas.md`, na seção "Banco e implantação", acrescentar:

```markdown
- [ ] Aplicar `0119_email_modelo_assinatura.sql` e rodar `node scripts/validate-migration-0119.mjs`.
```

e na seção de e-mail:

```markdown
- [ ] Configurar o modelo em Configurações › E-mail e a assinatura de cada vendedor em Meu perfil.
- [ ] Envio real: conferir assinatura com imagens no Gmail e no Outlook, e que "Responder" vai para quem enviou.
```

- [ ] **Step 4: Spec** — na seção 3 da spec, trocar `prepararEmailProposta(propostaId, versao)` que lê ... o documento` por `prepararEmailProposta(doc)`, que recebe o `PropostaDoc` já carregado no cliente e lê modelo e perfil da sessão`.

- [ ] **Step 5: Validação completa**

Run: `pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build`
Expected: tudo verde. Se `.agent/scripts/checklist.py` existir, rodar `python3 .agent/scripts/checklist.py .` e registrar o resultado. Anotar o resultado real no item "Validação" do roadmap.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs: e-mail da proposta personalizável — contrato, roadmap e checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
