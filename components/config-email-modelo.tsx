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
