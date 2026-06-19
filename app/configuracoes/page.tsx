"use client"

import { useState, useEffect } from "react"
import { Shell } from "@/components/shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  getConfigEmpresa,
  atualizarConfigEmpresa,
  getConfigPrecificacao,
  atualizarConfigPrecificacao,
} from "@/lib/db/config"
import { listarVariaveis, atualizarImpacto, criarVariavel, definirAtivoVariavel } from "@/lib/db/complexidade"
import { uploadArquivo } from "@/lib/actions/uploads"
import type {
  ConfigEmpresa,
  ConfigPrecificacao,
  DadosBancarios,
  VariavelComplexidade,
} from "@/lib/db/types"

const EMPRESA_VAZIA: ConfigEmpresa = {
  razaoSocial: "",
  cnpj: "",
  emailComercial: "",
  telefone: "",
  endereco: "",
  textoRodape: "",
  corPrimaria: null,
  corSecundaria: null,
  logoPath: null,
  logoUrl: null,
  assinaturaPath: null,
  assinaturaUrl: null,
  dadosBancarios: null,
}

const PRECIFICACAO_VAZIA: ConfigPrecificacao = {
  margemAlvo: 0,
  descontoMaxSemAprovacao: 0,
  validadePadrao: "",
  exigirJustificativaDesconto: true,
  limiteVariacaoJustificativa: 15,
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState("empresa")
  const [carregando, setCarregando] = useState(true)

  const [empresa, setEmpresa] = useState<ConfigEmpresa>(EMPRESA_VAZIA)
  const [bancarios, setBancarios] = useState<DadosBancarios>({})
  const [precificacao, setPrecificacao] = useState<ConfigPrecificacao>(PRECIFICACAO_VAZIA)
  const [variaveis, setVariaveis] = useState<VariavelComplexidade[]>([])
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false)

  // Nova variável de complexidade (PRD 11.5)
  const novaVarVazia = {
    nome: "",
    descricao: "",
    opcoes: [
      { label: "baixa", valor: 0 },
      { label: "média", valor: 0.1 },
      { label: "alta", valor: 0.25 },
    ],
  }
  const [novaVar, setNovaVar] = useState(novaVarVazia)
  const [mostrarNovaVar, setMostrarNovaVar] = useState(false)
  const [salvandoNovaVar, setSalvandoNovaVar] = useState(false)

  useEffect(() => {
    let ativo = true
    Promise.all([getConfigEmpresa(), getConfigPrecificacao(), listarVariaveis(true)])
      .then(([cEmpresa, cPrecificacao, vars]) => {
        if (!ativo) return
        setEmpresa(cEmpresa)
        setBancarios(cEmpresa.dadosBancarios ?? {})
        setPrecificacao(cPrecificacao)
        setVariaveis(vars)
      })
      .catch(() => {
        if (!ativo) return
        toast.error("Não foi possível carregar as configurações.")
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  function handleEmpresaChange(field: keyof ConfigEmpresa, value: string) {
    setEmpresa((prev) => ({ ...prev, [field]: value }))
  }

  function handleBancariosChange(field: keyof DadosBancarios, value: string) {
    setBancarios((prev) => ({ ...prev, [field]: value }))
  }

  async function recarregarEmpresa() {
    const cEmpresa = await getConfigEmpresa()
    setEmpresa(cEmpresa)
    setBancarios(cEmpresa.dadosBancarios ?? {})
  }

  async function handleSaveEmpresa() {
    try {
      await atualizarConfigEmpresa(empresa)
      toast.success("Dados da empresa salvos.")
    } catch {
      toast.error("Não foi possível salvar os dados da empresa.")
    }
  }

  async function handleUploadImagem(
    file: File | undefined,
    prefixo: "logo" | "assinatura",
    campo: "logoPath" | "assinaturaPath",
    setEnviando: (v: boolean) => void,
  ) {
    if (!file) return
    setEnviando(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const { path, error } = await uploadArquivo("branding", prefixo, fd)
      if (error || !path) {
        toast.error(error || "Não foi possível enviar o arquivo.")
        return
      }
      await atualizarConfigEmpresa({ [campo]: path })
      await recarregarEmpresa()
      toast.success(prefixo === "logo" ? "Logo atualizada." : "Assinatura atualizada.")
    } catch {
      toast.error("Não foi possível enviar o arquivo.")
    } finally {
      setEnviando(false)
    }
  }

  async function handleSaveBancarios() {
    try {
      await atualizarConfigEmpresa({
        dadosBancarios: {
          banco: bancarios.banco,
          agencia: bancarios.agencia,
          conta: bancarios.conta,
          pix: bancarios.pix,
          favorecido: bancarios.favorecido,
        },
      })
      toast.success("Dados bancários salvos.")
    } catch {
      toast.error("Não foi possível salvar os dados bancários.")
    }
  }

  async function handleSavePrecificacao() {
    try {
      await atualizarConfigPrecificacao(precificacao)
      toast.success("Parâmetros de precificação salvos.")
    } catch {
      toast.error("Não foi possível salvar os parâmetros de precificação.")
    }
  }

  function handleOpcaoChange(variavelId: string, opcao: string, value: number) {
    setVariaveis((prev) =>
      prev.map((v) =>
        v.id === variavelId ? { ...v, opcoes: { ...v.opcoes, [opcao]: value } } : v,
      ),
    )
  }

  async function handleSaveVariaveis() {
    try {
      // Persiste apenas as variáveis ativas (alinha com a intenção do toggle).
      await Promise.all(variaveis.filter((v) => v.ativo).map((v) => atualizarImpacto(v.id, v.opcoes)))
      toast.success("Fatores de complexidade salvos.")
    } catch {
      toast.error("Não foi possível salvar os fatores de complexidade.")
    }
  }

  async function recarregarVariaveis() {
    try {
      setVariaveis(await listarVariaveis(true))
    } catch {
      /* mantém lista atual */
    }
  }

  async function toggleAtivoVariavel(id: string, ativo: boolean) {
    // Atualização otimista + persistência.
    setVariaveis((prev) => prev.map((v) => (v.id === id ? { ...v, ativo } : v)))
    try {
      await definirAtivoVariavel(id, ativo)
      toast.success(ativo ? "Variável reativada." : "Variável desativada.")
    } catch {
      toast.error("Não foi possível alterar a variável.")
      await recarregarVariaveis()
    }
  }

  async function salvarNovaVariavel() {
    if (!novaVar.nome.trim()) {
      toast.error("Informe o nome da variável.")
      return
    }
    const preenchidas = novaVar.opcoes.filter((o) => o.label.trim())
    const opcoes = Object.fromEntries(
      preenchidas.map((o) => [o.label.trim().toLowerCase(), Number(o.valor) || 0]),
    )
    if (Object.keys(opcoes).length === 0) {
      toast.error("Adicione ao menos uma opção.")
      return
    }
    if (Object.keys(opcoes).length !== preenchidas.length) {
      toast.error("Há opções com o mesmo nome — use rótulos distintos.")
      return
    }
    setSalvandoNovaVar(true)
    try {
      await criarVariavel({ nome: novaVar.nome.trim(), descricao: novaVar.descricao.trim() || undefined, opcoes })
      toast.success("Variável de complexidade criada.")
      setNovaVar(novaVarVazia)
      setMostrarNovaVar(false)
      await recarregarVariaveis()
    } catch {
      toast.error("Não foi possível criar a variável (chave duplicada?).")
    } finally {
      setSalvandoNovaVar(false)
    }
  }

  return (
    <Shell breadcrumb={["IEX", "Configurações"]}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros gerais da plataforma e tabelas de preços.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="rate-card">Fatores de complexidade</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          </TabsList>

          {/* Empresa */}
          <TabsContent value="empresa" className="mt-5">
            <Card className="space-y-5 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Dados da empresa</h3>
                <p className="text-sm text-muted-foreground">
                  Informações exibidas nos documentos gerados.
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Razão social</Label>
                  <Input
                    value={empresa.razaoSocial}
                    onChange={(e) => handleEmpresaChange("razaoSocial", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ</Label>
                  <Input
                    value={empresa.cnpj}
                    onChange={(e) => handleEmpresaChange("cnpj", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail comercial</Label>
                  <Input
                    value={empresa.emailComercial}
                    onChange={(e) => handleEmpresaChange("emailComercial", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={empresa.telefone}
                    onChange={(e) => handleEmpresaChange("telefone", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input
                  value={empresa.endereco}
                  onChange={(e) => handleEmpresaChange("endereco", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Texto de rodapé das propostas</Label>
                <Textarea
                  value={empresa.textoRodape}
                  onChange={(e) => handleEmpresaChange("textoRodape", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveEmpresa} disabled={carregando}>
                  Salvar alterações
                </Button>
              </div>
            </Card>

            {/* Identidade visual */}
            <Card className="mt-5 space-y-5 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Identidade visual</h3>
                <p className="text-sm text-muted-foreground">
                  A logomarca e a assinatura aparecem no documento gerado (Word/PDF).
                </p>
              </div>
              <Separator />
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  {empresa.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={empresa.logoUrl}
                      alt="Logo da empresa"
                      className="max-h-16 rounded-md border border-border bg-background object-contain p-1"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma logo enviada.</p>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={enviandoLogo}
                    onChange={(e) =>
                      handleUploadImagem(
                        e.target.files?.[0],
                        "logo",
                        "logoPath",
                        setEnviandoLogo,
                      )
                    }
                  />
                  {enviandoLogo ? (
                    <p className="text-xs text-muted-foreground">Enviando...</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Assinatura visual</Label>
                  {empresa.assinaturaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={empresa.assinaturaUrl}
                      alt="Assinatura visual"
                      className="max-h-16 rounded-md border border-border bg-background object-contain p-1"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma assinatura enviada.</p>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={enviandoAssinatura}
                    onChange={(e) =>
                      handleUploadImagem(
                        e.target.files?.[0],
                        "assinatura",
                        "assinaturaPath",
                        setEnviandoAssinatura,
                      )
                    }
                  />
                  {enviandoAssinatura ? (
                    <p className="text-xs text-muted-foreground">Enviando...</p>
                  ) : null}
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Cor primária</Label>
                  <Input
                    value={empresa.corPrimaria ?? ""}
                    placeholder="oklch(...) ou #hex"
                    onChange={(e) => handleEmpresaChange("corPrimaria", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cor secundária</Label>
                  <Input
                    value={empresa.corSecundaria ?? ""}
                    placeholder="oklch(...) ou #hex"
                    onChange={(e) => handleEmpresaChange("corSecundaria", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveEmpresa} disabled={carregando}>
                  Salvar cores
                </Button>
              </div>
            </Card>

            {/* Dados bancários */}
            <Card className="mt-5 space-y-5 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Dados bancários</h3>
                <p className="text-sm text-muted-foreground">
                  Utilizados nas propostas e documentos para pagamento.
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Input
                    value={bancarios.banco ?? ""}
                    onChange={(e) => handleBancariosChange("banco", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Agência</Label>
                  <Input
                    value={bancarios.agencia ?? ""}
                    onChange={(e) => handleBancariosChange("agencia", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Conta</Label>
                  <Input
                    value={bancarios.conta ?? ""}
                    onChange={(e) => handleBancariosChange("conta", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>PIX</Label>
                  <Input
                    value={bancarios.pix ?? ""}
                    onChange={(e) => handleBancariosChange("pix", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Favorecido</Label>
                  <Input
                    value={bancarios.favorecido ?? ""}
                    onChange={(e) => handleBancariosChange("favorecido", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveBancarios} disabled={carregando}>
                  Salvar alterações
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Precificação */}
          <TabsContent value="precificacao" className="mt-5">
            <Card className="space-y-6 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Parâmetros de precificação</h3>
                <p className="text-sm text-muted-foreground">
                  Margens e limites aplicados às sugestões de preços.
                </p>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Margem-alvo padrão</Label>
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {precificacao.margemAlvo}%
                  </span>
                </div>
                <Slider
                  value={[precificacao.margemAlvo]}
                  onValueChange={(v) =>
                    setPrecificacao((prev) => ({ ...prev, margemAlvo: v[0] }))
                  }
                  min={5}
                  max={45}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Margem aplicada por padrão sobre os custos estimados de projeto.
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Desconto máximo sem aprovação (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={precificacao.descontoMaxSemAprovacao}
                    onChange={(e) =>
                      setPrecificacao((prev) => ({
                        ...prev,
                        descontoMaxSemAprovacao: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Validade padrão da proposta</Label>
                  <Input
                    value={precificacao.validadePadrao}
                    onChange={(e) =>
                      setPrecificacao((prev) => ({ ...prev, validadePadrao: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Exigir justificativa em descontos</p>
                  <p className="text-xs text-muted-foreground">
                    Obriga registro de motivo quando o valor final ficar acima de{" "}
                    {precificacao.limiteVariacaoJustificativa}% de desconto do sugerido.
                  </p>
                </div>
                <Switch
                  checked={precificacao.exigirJustificativaDesconto}
                  onCheckedChange={(v) =>
                    setPrecificacao((prev) => ({ ...prev, exigirJustificativaDesconto: v }))
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePrecificacao} disabled={carregando}>
                  Salvar alterações
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Fatores de complexidade */}
          <TabsContent value="rate-card" className="mt-5">
            <Card className="space-y-6 p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Fatores de complexidade</h3>
                <p className="text-sm text-muted-foreground">
                  Fatores internos usados no cálculo de complexidade. Não exibidos ao cliente.
                </p>
              </div>
              <Separator />
              {variaveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {carregando
                    ? "Carregando fatores..."
                    : "Nenhum fator de complexidade cadastrado."}
                </p>
              ) : (
                <div className="space-y-5">
                  {variaveis.map((v) => (
                    <div key={v.id} className={cn("space-y-3 rounded-lg border border-border p-4", !v.ativo && "opacity-60")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">{v.nome}</p>
                          {v.descricao ? (
                            <p className="text-xs text-muted-foreground">{v.descricao}</p>
                          ) : null}
                        </div>
                        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          {v.ativo ? "Ativa" : "Inativa"}
                          <Switch checked={v.ativo} onCheckedChange={(c) => toggleAtivoVariavel(v.id, c)} />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {Object.entries(v.opcoes).map(([opcao, impacto]) => (
                          <div key={opcao} className="space-y-1.5">
                            <Label className="capitalize">{opcao}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={impacto}
                              onChange={(e) =>
                                handleOpcaoChange(v.id, opcao, Number(e.target.value))
                              }
                              className="h-8 tabular-nums"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveVariaveis} disabled={carregando || variaveis.length === 0}>
                  Salvar alterações
                </Button>
              </div>
            </Card>

            {/* Nova variável de complexidade */}
            <Card className="mt-5 space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Nova variável</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie uma variável de complexidade com suas opções e impactos.
                  </p>
                </div>
                {!mostrarNovaVar && (
                  <Button variant="outline" size="sm" onClick={() => setMostrarNovaVar(true)}>
                    <Plus className="h-4 w-4" /> Nova variável
                  </Button>
                )}
              </div>
              {mostrarNovaVar && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Nome</Label>
                      <Input
                        placeholder="Ex.: Restrições do terreno"
                        value={novaVar.nome}
                        onChange={(e) => setNovaVar((v) => ({ ...v, nome: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Descrição (opcional)</Label>
                      <Input
                        value={novaVar.descricao}
                        onChange={(e) => setNovaVar((v) => ({ ...v, descricao: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Opções e impactos (ex.: 0,1 = +10%)</Label>
                    {novaVar.opcoes.map((o, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_110px_36px] items-center gap-2">
                        <Input
                          placeholder="Opção (ex.: alta)"
                          value={o.label}
                          onChange={(e) =>
                            setNovaVar((v) => ({
                              ...v,
                              opcoes: v.opcoes.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                            }))
                          }
                          className="h-9"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={o.valor}
                          onChange={(e) =>
                            setNovaVar((v) => ({
                              ...v,
                              opcoes: v.opcoes.map((x, i) => (i === idx ? { ...x, valor: Number(e.target.value) || 0 } : x)),
                            }))
                          }
                          className="h-9 text-right tabular-nums"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setNovaVar((v) => ({ ...v, opcoes: v.opcoes.filter((_, i) => i !== idx) }))}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNovaVar((v) => ({ ...v, opcoes: [...v.opcoes, { label: "", valor: 0 }] }))}
                    >
                      <Plus className="h-4 w-4" /> Adicionar opção
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setMostrarNovaVar(false); setNovaVar(novaVarVazia) }}>
                      Cancelar
                    </Button>
                    <Button onClick={salvarNovaVariavel} disabled={salvandoNovaVar}>
                      {salvandoNovaVar ? "Salvando..." : "Criar variável"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* Notificações */}
          <TabsContent value="notificacoes" className="mt-5">
            <Card className="space-y-2 p-6">
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                <p className="text-sm text-muted-foreground">
                  Defina quando deseja ser avisado sobre eventos comerciais.
                </p>
              </div>
              <Separator className="mb-2" />
              <ToggleRow title="Proposta sem retorno há mais de 7 dias" desc="Lembrete de follow-up automático." defaultChecked />
              <ToggleRow title="Proposta aprovada" desc="Aviso imediato ao mudar de status." defaultChecked />
              <ToggleRow title="Proposta perdida" desc="Notifica registro de motivo de perda." defaultChecked />
              <ToggleRow title="Resumo semanal por e-mail" desc="Panorama de desempenho toda segunda-feira." />
              <div className="flex justify-end pt-2">
                <Button onClick={() => toast.success("Preferências de notificação salvas.")}>
                  Salvar alterações
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  )
}

function ToggleRow({
  title,
  desc,
  checked,
  onCheckedChange,
  defaultChecked,
}: {
  title: string
  desc: string
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {onCheckedChange ? (
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      ) : (
        <Switch defaultChecked={defaultChecked} />
      )}
    </div>
  )
}
