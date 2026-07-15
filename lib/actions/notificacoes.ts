"use server"

import { createClient } from "@/lib/supabase/server"

// Produtor de eventos de notificação (Frente C / Onda 2).
//
// sincronizarNotificacoes deriva notificações de "proposta sem retorno" a partir
// do estado atual das propostas (status = "Enviada" há >= LIMITE_DIAS dias sem
// mudança de status). É idempotente: só cria a notificação que ainda não existe
// para aquela proposta (dedup por tipo+proposta, reforçado pelo índice único
// parcial da migração 0114). É barato e seguro chamar a cada abertura do sino.
//
// Eventos de mudança de status (aprovada/perdida) ainda NÃO são produzidos aqui —
// exigiriam um gancho no fluxo de transição de status (fn_transicionar_status /
// proposal-drawer, ambos fora do escopo editável desta frente). Ver o retorno.

const LIMITE_DIAS = 7

function tabelaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|could not find the table|schema cache/i.test(error.message ?? "")
  )
}

interface PropostaSemRetornoRow {
  id: string
  numero: string
  cliente_nome: string | null
  empreendimento: string | null
  data_envio: string | null
  responsavel_id: string | null
  status: string
}

export async function sincronizarNotificacoes(): Promise<{ ok: boolean; criadas: number }> {
  try {
    const supabase = await createClient()

    // Propostas enviadas (candidatas a "sem retorno").
    const { data: propostas, error: propErr } = await supabase
      .from("propostas")
      .select("id,numero,cliente_nome,empreendimento,data_envio,responsavel_id,status")
      .eq("status", "Enviada")
      .eq("arquivada", false)
    if (propErr) {
      if (!tabelaAusente(propErr)) console.error("Sincronização de notificações falhou:", propErr)
      return { ok: false, criadas: 0 }
    }

    const agora = Date.now()
    const vencidas = (propostas as PropostaSemRetornoRow[]).filter((p) => {
      if (!p.data_envio) return false
      const dias = Math.floor((agora - new Date(p.data_envio + "T00:00:00").getTime()) / 86400000)
      return dias >= LIMITE_DIAS
    })
    if (vencidas.length === 0) return { ok: true, criadas: 0 }

    // Notificações "sem_retorno" já existentes — evita recriar (a UNIQUE parcial é rede de segurança).
    const { data: existentes, error: exErr } = await supabase
      .from("notificacoes")
      .select("proposta_id")
      .eq("tipo", "sem_retorno")
    if (exErr) {
      if (!tabelaAusente(exErr)) console.error("Sincronização de notificações falhou:", exErr)
      return { ok: false, criadas: 0 }
    }
    const jaTem = new Set((existentes ?? []).map((e) => e.proposta_id))

    const novas = vencidas
      .filter((p) => !jaTem.has(p.id))
      .map((p) => {
        const rotulo = p.empreendimento?.trim() || p.cliente_nome?.trim() || p.numero
        return {
          usuario_id: p.responsavel_id, // null => visível a todos
          tipo: "sem_retorno",
          titulo: "Proposta sem retorno",
          descricao: `${p.numero} — ${rotulo} está há mais de ${LIMITE_DIAS} dias aguardando resposta.`,
          proposta_id: p.id,
          href: `/propostas?open=${p.id}`,
          lida: false,
        }
      })
    if (novas.length === 0) return { ok: true, criadas: 0 }

    const { error: insErr } = await supabase.from("notificacoes").insert(novas)
    if (insErr) {
      // 23505 = corrida (outra sincronização inseriu antes) — não é erro real.
      if ((insErr as { code?: string }).code === "23505") return { ok: true, criadas: 0 }
      if (!tabelaAusente(insErr)) console.error("Sincronização de notificações falhou:", insErr)
      return { ok: false, criadas: 0 }
    }
    return { ok: true, criadas: novas.length }
  } catch (e) {
    console.error("Sincronização de notificações falhou:", e)
    return { ok: false, criadas: 0 }
  }
}
