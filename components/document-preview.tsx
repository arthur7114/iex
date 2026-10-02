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
                {e.itens.map((it, i) => <li key={`${i}-${it}`} style={f(7.8, 400, PALETA.textoCard, { lineHeight: 1.55 })}>{it}</li>)}
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
          <div key={`${item.disciplina}-${i}`} className="avoid-break" style={{ display: "grid", gridTemplateColumns: `${mm(11)} 1fr auto`, gap: mm(5), padding: `${mm(5.5)} 0`, borderBottom: `1px solid ${PALETA.linha}`, alignItems: "start" }}>
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
        <div className="avoid-break" style={{ marginTop: mm(8), background: PALETA.navy, borderRadius: mm(3), padding: `${mm(7)} ${mm(8)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    {col.itens.map((it, i) => (
                      <li key={`${i}-${it}`} style={f(9.5, 400, PALETA.texto, { lineHeight: 1.55, padding: `${mm(1.8)} 0 ${mm(1.8)} ${mm(6)}`, position: "relative", borderBottom: `1px solid ${PALETA.linha}` })}>
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
