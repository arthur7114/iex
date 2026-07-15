import { createClient } from "@/lib/supabase/client"

// ---------------------------------------------------------------------------
// Histórico visível da proposta (Onda 2 · Frente B).
// Leitura agregada e tipada de tudo que aconteceu com uma proposta ao longo do
// tempo, unificado numa única linha do tempo (mais recente primeiro):
//   - versões geradas do documento        (versoes_proposta)
//   - alterações de preço + justificativas (ajustes_preco)
//   - envios de e-mail e seus resultados   (envios_email)
//   - eventos de ciclo de vida / status    (proposta_eventos)
// Cada tipo de entrada carrega uma `categoria` semântica para que a UI possa
// diferenciar visualmente mudanças COMERCIAIS de mudanças de STATUS.
// ---------------------------------------------------------------------------

export type CategoriaHistorico =
  | "comercial" // alteração de preço
  | "status" // transição de status da proposta
  | "documento" // versão do documento gerada
  | "email" // envio por e-mail
  | "sistema" // ciclo de vida (criada, editada, importada)

export type StatusEnvio = "enviado" | "simulado" | "falha"

export interface HistoricoVersao {
  id: string
  tipo: "versao"
  categoria: "documento"
  data: string
  versao: number
  valorTotal: number
}

export interface HistoricoAjuste {
  id: string
  tipo: "ajuste"
  categoria: "comercial"
  data: string
  disciplina: string
  valorSugerido: number
  valorFinal: number
  variacaoPct: number
  justificativa: string | null
}

export interface HistoricoEmail {
  id: string
  tipo: "email"
  categoria: "email"
  data: string
  destinatario: string
  copias: string | null
  assunto: string
  status: StatusEnvio
  anexoTipo: string | null
}

export interface HistoricoEvento {
  id: string
  tipo: "evento"
  categoria: "status" | "sistema"
  data: string
  acao: string
  usuario: string
}

export type ItemHistorico =
  | HistoricoVersao
  | HistoricoAjuste
  | HistoricoEmail
  | HistoricoEvento

// Ordena por timestamp — lida tanto com datas puras (YYYY-MM-DD) quanto ISO.
function ts(v: string): number {
  const n = new Date(v).getTime()
  return Number.isNaN(n) ? 0 : n
}

// Um "Status alterado para ..." (fn_transicionar_status) é mudança de status;
// os demais eventos (criada/editada/importada) são ciclo de vida.
function categoriaEvento(acao: string): "status" | "sistema" {
  return /status/i.test(acao) ? "status" : "sistema"
}

// Carrega a linha do tempo completa da proposta (mais recente primeiro).
// Cada fonte é lida de forma independente: uma falha isolada (ex.: uma tabela
// sem linhas ou RLS restritiva) não derruba o histórico inteiro.
export async function carregarHistorico(propostaId: string): Promise<ItemHistorico[]> {
  const supabase = createClient()

  const [versoes, ajustes, emails, eventos] = await Promise.allSettled([
    supabase
      .from("versoes_proposta")
      .select("versao, valor_total, created_at")
      .eq("proposta_id", propostaId),
    supabase
      .from("ajustes_preco")
      .select("id, disciplina_nome, valor_sugerido, valor_final, variacao_pct, justificativa, created_at")
      .eq("proposta_id", propostaId),
    supabase
      .from("envios_email")
      .select("id, destinatario, copias, assunto, status, anexo_tipo, enviado_em, created_at")
      .eq("proposta_id", propostaId),
    supabase
      .from("proposta_eventos")
      .select("id, acao, usuario_nome, data")
      .eq("proposta_id", propostaId),
  ])

  const itens: ItemHistorico[] = []

  if (versoes.status === "fulfilled" && versoes.value.data) {
    for (const v of versoes.value.data as any[]) {
      itens.push({
        id: `versao-${v.versao}`,
        tipo: "versao",
        categoria: "documento",
        data: v.created_at,
        versao: Number(v.versao),
        valorTotal: Number(v.valor_total),
      })
    }
  }

  if (ajustes.status === "fulfilled" && ajustes.value.data) {
    for (const a of ajustes.value.data as any[]) {
      itens.push({
        id: `ajuste-${a.id}`,
        tipo: "ajuste",
        categoria: "comercial",
        data: a.created_at,
        disciplina: a.disciplina_nome,
        valorSugerido: Number(a.valor_sugerido),
        valorFinal: Number(a.valor_final),
        variacaoPct: Number(a.variacao_pct),
        justificativa: a.justificativa ?? null,
      })
    }
  }

  if (emails.status === "fulfilled" && emails.value.data) {
    for (const e of emails.value.data as any[]) {
      itens.push({
        id: `email-${e.id}`,
        tipo: "email",
        categoria: "email",
        data: e.enviado_em ?? e.created_at,
        destinatario: e.destinatario,
        copias: e.copias ?? null,
        assunto: e.assunto,
        status: (e.status as StatusEnvio) ?? "enviado",
        anexoTipo: e.anexo_tipo ?? null,
      })
    }
  }

  if (eventos.status === "fulfilled" && eventos.value.data) {
    for (const ev of eventos.value.data as any[]) {
      itens.push({
        id: `evento-${ev.id}`,
        tipo: "evento",
        categoria: categoriaEvento(ev.acao ?? ""),
        data: ev.data,
        acao: ev.acao ?? "",
        usuario: ev.usuario_nome ?? "—",
      })
    }
  }

  // Se TODAS as fontes falharem, propaga o erro para a UI mostrar o estado de erro.
  const results = [versoes, ajustes, emails, eventos]
  if (results.every((r) => r.status === "rejected")) {
    const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult
    throw first.reason instanceof Error ? first.reason : new Error("Falha ao carregar o histórico.")
  }

  return itens.sort((a, b) => ts(b.data) - ts(a.data))
}
