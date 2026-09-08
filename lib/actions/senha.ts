"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { corpoRedefinicao, enviarLinkDeAcesso } from "@/lib/auth/link-acesso"

const emailSchema = z.string().trim().email()

// Janela mínima entre pedidos para o mesmo e-mail. Best-effort: em ambiente
// serverless o mapa é por instância, então isto reduz repetição acidental e
// rajadas simples, mas não é uma garantia global de rate limit.
const JANELA_MS = 60_000
const ultimoPedido = new Map<string, number>()

function throttled(email: string): boolean {
  const agora = Date.now()
  const anterior = ultimoPedido.get(email)
  if (anterior && agora - anterior < JANELA_MS) return true
  ultimoPedido.set(email, agora)
  // Poda entradas velhas para o mapa não crescer indefinidamente.
  if (ultimoPedido.size > 500) {
    for (const [chave, quando] of ultimoPedido) {
      if (agora - quando > JANELA_MS) ultimoPedido.delete(chave)
    }
  }
  return false
}

// Redefinição de senha por auto-atendimento, a partir da tela de login.
//
// Sem sessão: qualquer pessoa pode chamar. Por isso a resposta é SEMPRE `ok`,
// independentemente de o e-mail existir, estar ativo ou o envio ter falhado —
// caso contrário a tela viraria um oráculo de "este e-mail tem conta aqui?".
// As falhas reais ficam no log do servidor.
export async function solicitarRedefinicaoSenha(email: string): Promise<{ ok: true }> {
  const validacao = emailSchema.safeParse(email)
  if (!validacao.success) return { ok: true }
  const emailValidado = validacao.data.toLowerCase()
  if (throttled(emailValidado)) return { ok: true }

  try {
    const admin = createAdminClient()
    // Só envia para membro cadastrado e ativo: desativado não recupera acesso
    // por este caminho (o ban no Auth já impediria o login de qualquer forma).
    const { data: membro } = await admin
      .from("usuarios")
      .select("ativo")
      .ilike("email", emailValidado)
      .maybeSingle()
    if (!membro || membro.ativo === false) return { ok: true }

    const envio = await enviarLinkDeAcesso({
      email: emailValidado,
      tipo: "recovery",
      assunto: "Redefinição de senha — plataforma IEX",
      corpo: corpoRedefinicao,
    })
    if (!envio.ok) {
      console.error("[senha] falha ao enviar redefinição:", envio.error)
      return { ok: true }
    }

    await admin.from("logs_uso").insert({
      acao: "Redefinição de senha solicitada",
      entidade: "Sessão",
      detalhe: emailValidado,
    })
  } catch (e) {
    console.error("[senha] erro inesperado na redefinição:", e)
  }
  return { ok: true }
}
