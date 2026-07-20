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
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Trash2, UserPlus, MoreHorizontal, KeyRound, Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  getConfigEmpresa,
  atualizarConfigEmpresa,
  getConfigPrecificacao,
  atualizarConfigPrecificacao,
} from "@/lib/db/config"
import { listarVariaveis, atualizarImpacto, criarVariavel, definirAtivoVariavel } from "@/lib/db/complexidade"
import {
  getPreferencias,
  salvarPreferencias,
  PREFERENCIAS_PADRAO,
  type PreferenciasNotificacao,
} from "@/lib/db/notificacoes"
import { uploadArquivo } from "@/lib/actions/uploads"
import {
  listarEquipeDetalhada,
  convidarUsuarioEquipe,
  reenviarConvite,
  redefinirSenhaUsuario,
  definirAtivoUsuario,
  definirFuncaoUsuario,
  type MembroEquipe,
} from "@/lib/actions/equipe"
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
  // Falha no load inicial: bloqueia salvar (senão os forms vazios sobrescreveriam
  // os dados reais) e oferece nova tentativa.
  const [erroCarregar, setErroCarregar] = useState(false)
  const [tentativa, setTentativa] = useState(0)

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
    setCarregando(true)
    setErroCarregar(false)
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
        setErroCarregar(true)
        toast.error("Não foi possível carregar as configurações.")
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [tentativa])

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

        {erroCarregar && (
          <Card className="flex flex-col gap-3 border-danger/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as configurações. Para não sobrescrever os dados salvos, salvar está desabilitado até recarregar.
            </p>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setTentativa((t) => t + 1)} disabled={carregando}>
              Tentar novamente
            </Button>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="rate-card">Fatores de complexidade</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
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
                  <Label htmlFor="empresa-razao-social">Razão social</Label>
                  <Input
                    id="empresa-razao-social"
                    value={empresa.razaoSocial}
                    onChange={(e) => handleEmpresaChange("razaoSocial", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa-cnpj">CNPJ</Label>
                  <Input
                    id="empresa-cnpj"
                    value={empresa.cnpj}
                    onChange={(e) => handleEmpresaChange("cnpj", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa-email">E-mail comercial</Label>
                  <Input
                    id="empresa-email"
                    value={empresa.emailComercial}
                    onChange={(e) => handleEmpresaChange("emailComercial", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa-telefone">Telefone</Label>
                  <Input
                    id="empresa-telefone"
                    value={empresa.telefone}
                    onChange={(e) => handleEmpresaChange("telefone", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empresa-endereco">Endereço</Label>
                <Input
                  id="empresa-endereco"
                  value={empresa.endereco}
                  onChange={(e) => handleEmpresaChange("endereco", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empresa-rodape">Texto de rodapé das propostas</Label>
                <Textarea
                  id="empresa-rodape"
                  value={empresa.textoRodape}
                  onChange={(e) => handleEmpresaChange("textoRodape", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveEmpresa} disabled={carregando || erroCarregar}>
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
                  <Label htmlFor="empresa-logo">Logo</Label>
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
                    id="empresa-logo"
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
                    <p className="text-xs text-muted-foreground">Enviando…</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empresa-assinatura">Assinatura visual</Label>
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
                    id="empresa-assinatura"
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
                    <p className="text-xs text-muted-foreground">Enviando…</p>
                  ) : null}
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="empresa-cor-primaria">Cor primária</Label>
                  <Input
                    id="empresa-cor-primaria"
                    value={empresa.corPrimaria ?? ""}
                    placeholder="oklch(...) ou #hex"
                    onChange={(e) => handleEmpresaChange("corPrimaria", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa-cor-secundaria">Cor secundária</Label>
                  <Input
                    id="empresa-cor-secundaria"
                    value={empresa.corSecundaria ?? ""}
                    placeholder="oklch(...) ou #hex"
                    onChange={(e) => handleEmpresaChange("corSecundaria", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveEmpresa} disabled={carregando || erroCarregar}>
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
                  <Label htmlFor="bancarios-banco">Banco</Label>
                  <Input
                    id="bancarios-banco"
                    value={bancarios.banco ?? ""}
                    onChange={(e) => handleBancariosChange("banco", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bancarios-agencia">Agência</Label>
                  <Input
                    id="bancarios-agencia"
                    value={bancarios.agencia ?? ""}
                    onChange={(e) => handleBancariosChange("agencia", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bancarios-conta">Conta</Label>
                  <Input
                    id="bancarios-conta"
                    value={bancarios.conta ?? ""}
                    onChange={(e) => handleBancariosChange("conta", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bancarios-pix">PIX</Label>
                  <Input
                    id="bancarios-pix"
                    value={bancarios.pix ?? ""}
                    onChange={(e) => handleBancariosChange("pix", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bancarios-favorecido">Favorecido</Label>
                  <Input
                    id="bancarios-favorecido"
                    value={bancarios.favorecido ?? ""}
                    onChange={(e) => handleBancariosChange("favorecido", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveBancarios} disabled={carregando || erroCarregar}>
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
                  <Label htmlFor="precificacao-desconto-max">Desconto máximo sem aprovação (%)</Label>
                  <Input
                    id="precificacao-desconto-max"
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
                  <Label htmlFor="precificacao-validade">Validade padrão da proposta</Label>
                  <Input
                    id="precificacao-validade"
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
                <Button onClick={handleSavePrecificacao} disabled={carregando || erroCarregar}>
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
                    ? "Carregando fatores…"
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
                            <Label htmlFor={`var-${v.id}-${opcao}`} className="capitalize">{opcao}</Label>
                            <Input
                              id={`var-${v.id}-${opcao}`}
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
                <Button onClick={handleSaveVariaveis} disabled={carregando || erroCarregar || variaveis.length === 0}>
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
                      <Label htmlFor="nova-var-nome">Nome</Label>
                      <Input
                        id="nova-var-nome"
                        placeholder="Ex.: Restrições do terreno"
                        value={novaVar.nome}
                        onChange={(e) => setNovaVar((v) => ({ ...v, nome: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="nova-var-descricao">Descrição (opcional)</Label>
                      <Input
                        id="nova-var-descricao"
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
                          <span className="sr-only">Remover opção</span>
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
                      {salvandoNovaVar ? "Salvando…" : "Criar variável"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* Equipe */}
          <TabsContent value="equipe" className="mt-5">
            <EquipeSection />
          </TabsContent>

          {/* Notificações */}
          <TabsContent value="notificacoes" className="mt-5">
            <NotificacoesSection />
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

// Preferências de notificação reais, persistidas por usuário (notificacao_preferencias).
// Controlam quais tipos de notificação o usuário recebe no sino da topbar.
function NotificacoesSection() {
  const [prefs, setPrefs] = useState<PreferenciasNotificacao>(PREFERENCIAS_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    getPreferencias()
      .then((p) => {
        if (ativo) setPrefs(p)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  function set(campo: keyof PreferenciasNotificacao, valor: boolean) {
    setPrefs((prev) => ({ ...prev, [campo]: valor }))
  }

  async function salvar() {
    setSalvando(true)
    try {
      await salvarPreferencias(prefs)
      toast.success("Preferências de notificação salvas.")
    } catch {
      toast.error("Não foi possível salvar as preferências.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="space-y-2 p-6">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
        <p className="text-sm text-muted-foreground">
          Escolha quais eventos comerciais aparecem no seu sino de notificações.
        </p>
      </div>
      <Separator className="mb-2" />
      <ToggleRow
        title="Proposta sem retorno há mais de 7 dias"
        desc="Lembrete de follow-up automático."
        checked={prefs.semRetorno}
        onCheckedChange={(v) => set("semRetorno", v)}
      />
      <ToggleRow
        title="Proposta aprovada"
        desc="Aviso imediato ao mudar de status."
        checked={prefs.aprovada}
        onCheckedChange={(v) => set("aprovada", v)}
      />
      <ToggleRow
        title="Proposta perdida"
        desc="Notifica registro de motivo de perda."
        checked={prefs.perdida}
        onCheckedChange={(v) => set("perdida", v)}
      />
      <ToggleRow
        title="Resumo semanal por e-mail"
        desc="Panorama de desempenho toda segunda-feira."
        checked={prefs.resumoSemanal}
        onCheckedChange={(v) => set("resumoSemanal", v)}
      />
      <div className="flex justify-end pt-2">
        <Button onClick={salvar} disabled={carregando || salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  )
}

const FUNCOES_EQUIPE = ["Administrador", "Editor"] as const

type MembroForm = { nome: string; email: string; funcao: string }
const MEMBRO_FORM_VAZIO: MembroForm = { nome: "", email: "", funcao: "Editor" }

function formatarUltimoAcesso(iso: string | null): string {
  if (!iso) return "Nunca acessou"
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return "—"
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// Seção de gestão de equipe: convite por e-mail, reenvio, redefinição de senha,
// desativação (que bloqueia o acesso de fato) e situação do convite/último acesso.
function EquipeSection() {
  const [equipe, setEquipe] = useState<MembroEquipe[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  const [dialogAberto, setDialogAberto] = useState(false)
  const [form, setForm] = useState<MembroForm>(MEMBRO_FORM_VAZIO)
  const [convidando, setConvidando] = useState(false)

  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [membroParaDesativar, setMembroParaDesativar] = useState<MembroEquipe | null>(null)
  const [desativando, setDesativando] = useState(false)

  async function recarregar() {
    setCarregando(true)
    setErro(false)
    try {
      setEquipe(await listarEquipeDetalhada())
    } catch {
      setErro(true)
      toast.error("Não foi possível carregar a equipe.")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    recarregar()
  }, [])

  function abrirConvite() {
    setForm(MEMBRO_FORM_VAZIO)
    setDialogAberto(true)
  }

  async function enviarConvite() {
    const nome = form.nome.trim()
    const email = form.email.trim()
    if (!nome) {
      toast.error("Informe o nome do membro.")
      return
    }
    if (!email) {
      toast.error("Informe o e-mail do membro.")
      return
    }
    setConvidando(true)
    try {
      const res = await convidarUsuarioEquipe({ nome, email, funcao: form.funcao })
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível enviar o convite.")
        return
      }
      toast.success(`Convite enviado para ${email}.`)
      setDialogAberto(false)
      await recarregar()
    } catch {
      toast.error("Não foi possível enviar o convite.")
    } finally {
      setConvidando(false)
    }
  }

  async function comProcessamento(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, sucesso: string) {
    setProcessandoId(id)
    try {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível concluir a ação.")
        return false
      }
      toast.success(sucesso)
      return true
    } catch {
      toast.error("Não foi possível concluir a ação.")
      return false
    } finally {
      setProcessandoId(null)
    }
  }

  async function handleReenviar(m: MembroEquipe) {
    if (!m.email) return
    await comProcessamento(m.id, () => reenviarConvite(m.email!), `Convite reenviado para ${m.email}.`)
  }

  async function handleRedefinirSenha(m: MembroEquipe) {
    if (!m.email) return
    await comProcessamento(
      m.id,
      () => redefinirSenhaUsuario(m.email!),
      `E-mail de redefinição de senha enviado para ${m.email}.`,
    )
  }

  async function handleFuncao(m: MembroEquipe, funcao: string) {
    if (funcao === m.funcao) return
    const ok = await comProcessamento(m.id, () => definirFuncaoUsuario(m.id, funcao), "Função atualizada.")
    if (ok) setEquipe((prev) => prev.map((x) => (x.id === m.id ? { ...x, funcao } : x)))
  }

  async function handleAtivar(m: MembroEquipe) {
    const ok = await comProcessamento(m.id, () => definirAtivoUsuario(m.id, true), "Acesso reativado.")
    if (ok) setEquipe((prev) => prev.map((x) => (x.id === m.id ? { ...x, ativo: true } : x)))
  }

  async function confirmarDesativacao() {
    if (!membroParaDesativar) return
    setDesativando(true)
    const alvo = membroParaDesativar
    const ok = await comProcessamento(alvo.id, () => definirAtivoUsuario(alvo.id, false), "Acesso desativado.")
    setDesativando(false)
    if (ok) {
      setEquipe((prev) => prev.map((x) => (x.id === alvo.id ? { ...x, ativo: false } : x)))
      setMembroParaDesativar(null)
    }
  }

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Equipe</h3>
            <p className="text-sm text-muted-foreground">
              Convide membros, gerencie funções e controle o acesso à plataforma.
            </p>
          </div>
          <Button size="sm" onClick={abrirConvite}>
            <UserPlus className="h-4 w-4" />
            Convidar membro
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Membro</TableHead>
                <TableHead className="w-44">Função</TableHead>
                <TableHead>Convite</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
                    Carregando equipe…
                  </TableCell>
                </TableRow>
              ) : erro ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">Não foi possível carregar a equipe.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={recarregar}>
                      Tentar novamente
                    </Button>
                  </TableCell>
                </TableRow>
              ) : equipe.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhum membro na equipe. Convide o primeiro membro para começar.
                  </TableCell>
                </TableRow>
              ) : (
                equipe.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{m.nome}</span>
                        <span className="text-xs text-muted-foreground">{m.email || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={m.funcao} onValueChange={(v) => handleFuncao(m, v)} disabled={processandoId === m.id}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FUNCOES_EQUIPE.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                          {!FUNCOES_EQUIPE.includes(m.funcao as (typeof FUNCOES_EQUIPE)[number]) && m.funcao && (
                            <SelectItem value={m.funcao}>{m.funcao}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        <span
                          className={cn(
                            "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                            m.situacaoConvite === "aceito"
                              ? "bg-[oklch(0.55_0.1_155)]"
                              : "bg-[oklch(0.7_0.14_75)]",
                          )}
                        />
                        {m.situacaoConvite === "aceito" ? "Aceito" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatarUltimoAcesso(m.ultimoAcesso)}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-sm", m.ativo ? "text-foreground" : "text-muted-foreground")}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={processandoId === m.id}>
                            {processandoId === m.id ? (
                              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {m.situacaoConvite === "pendente" && (
                            <DropdownMenuItem onClick={() => handleReenviar(m)} disabled={!m.email}>
                              <Send className="h-4 w-4" />
                              Reenviar convite
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleRedefinirSenha(m)} disabled={!m.email}>
                            <KeyRound className="h-4 w-4" />
                            Redefinir senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {m.ativo ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setMembroParaDesativar(m)}
                            >
                              Desativar acesso
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleAtivar(m)}>Reativar acesso</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Convites, reenvios e redefinições de senha dependem de um provedor de e-mail (SMTP) configurado no Supabase.
      </p>

      {/* Convidar membro */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>
              Enviaremos um convite por e-mail para o membro definir a própria senha e acessar a plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="membro-nome">Nome</Label>
              <Input
                id="membro-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="membro-email">E-mail</Label>
              <Input
                id="membro-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="membro-funcao">Função</Label>
              <Select value={form.funcao} onValueChange={(v) => setForm((f) => ({ ...f, funcao: v }))}>
                <SelectTrigger id="membro-funcao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNCOES_EQUIPE.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)} disabled={convidando}>
              Cancelar
            </Button>
            <Button onClick={enviarConvite} disabled={convidando}>
              {convidando ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar desativação */}
      <AlertDialog
        open={membroParaDesativar !== null}
        onOpenChange={(o) => !o && !desativando && setMembroParaDesativar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{membroParaDesativar?.nome}</span> perderá o acesso à
              plataforma imediatamente e não conseguirá entrar novamente até ser reativado. O histórico do membro é
              preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desativando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmarDesativacao()
              }}
              disabled={desativando}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            >
              {desativando ? "Desativando…" : "Desativar acesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
