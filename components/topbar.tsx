"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Bell,
  ChevronRight,
  FileText,
  Building2,
  Loader2,
  CheckCheck,
  Inbox,
} from "lucide-react"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getUsuarioAtual, sair } from "@/lib/db/usuarios"
import { listarPropostas } from "@/lib/db/propostas"
import { listarClientesComMetricas } from "@/lib/db/clientes"
import {
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  type Notificacao,
} from "@/lib/db/notificacoes"
import { sincronizarNotificacoes } from "@/lib/actions/notificacoes"
import type { UsuarioAtual, Proposta, Cliente } from "@/lib/db/types"

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?"
}

function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ""
  const min = Math.floor(ms / 60000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} d`
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

// -------------------------------------------------------------------------
// Busca global (command palette) — propostas e clientes.
// -------------------------------------------------------------------------
function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])

  // Atalho ⌘K / Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Carrega os dados na primeira abertura.
  useEffect(() => {
    if (!open || carregado || carregando) return
    setCarregando(true)
    Promise.all([listarPropostas(), listarClientesComMetricas()])
      .then(([p, c]) => {
        setPropostas(p)
        setClientes(c)
        setCarregado(true)
      })
      .catch(() => {
        /* silencioso — a busca apenas fica vazia */
      })
      .finally(() => setCarregando(false))
  }, [open, carregado, carregando])

  const irPara = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  return (
    <>
      {/* Gatilho desktop: parece um campo de busca, abre o palette */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-56 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground sm:flex lg:w-72"
        aria-label="Buscar propostas e clientes"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Buscar propostas, clientes...</span>
        <kbd className="pointer-events-none hidden shrink-0 select-none rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-block">
          ⌘K
        </kbd>
      </button>

      {/* Gatilho mobile: apenas o ícone */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
      >
        <Search className="h-[18px] w-[18px]" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Busca global"
        description="Busque por propostas e clientes."
      >
        <CommandInput placeholder="Buscar por número, cliente, empreendimento..." />
        <CommandList>
          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Carregando...
            </div>
          ) : (
            <>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              {propostas.length > 0 && (
                <CommandGroup heading="Propostas">
                  {propostas.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`proposta ${p.numero} ${p.cliente} ${p.empreendimento}`}
                      onSelect={() => irPara(`/propostas?open=${p.id}`)}
                    >
                      <FileText className="text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {p.numero}
                          {p.empreendimento ? ` — ${p.empreendimento}` : ""}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {p.cliente} · {p.status}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {clientes.length > 0 && (
                <CommandGroup heading="Clientes">
                  {clientes.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`cliente ${c.razaoSocial} ${c.contato} ${c.cidade}`}
                      onSelect={() => irPara("/clientes")}
                    >
                      <Building2 className="text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{c.razaoSocial}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[c.cidade && `${c.cidade}/${c.uf}`, c.contato].filter(Boolean).join(" · ") ||
                            "Cliente"}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

// -------------------------------------------------------------------------
// Sino de notificações — contagem real, lista e marcar como lida.
// -------------------------------------------------------------------------
function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [itens, setItens] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)

  const naoLidas = itens.filter((n) => !n.lida).length

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      // Produz eventos "sem retorno" antes de ler (idempotente e barato).
      await sincronizarNotificacoes()
      setItens(await listarNotificacoes(30))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function abrir(n: Notificacao) {
    if (!n.lida) {
      setItens((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)))
      await marcarComoLida(n.id).catch(() => {})
    }
    if (n.href) {
      setOpen(false)
      router.push(n.href)
    }
  }

  async function marcarTodas() {
    setItens((prev) => prev.map((x) => ({ ...x, lida: true })))
    await marcarTodasComoLidas().catch(() => {})
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) carregar()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        >
          <Bell className="h-[18px] w-[18px]" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {naoLidas > 0 ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : "Tudo em dia"}
            </p>
          </div>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={marcarTodas}>
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Carregando...
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">Nenhuma notificação</p>
            <p className="text-xs text-muted-foreground">
              Avisaremos aqui sobre propostas sem retorno e outros eventos comerciais.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y divide-border">
              {itens.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.lida ? "bg-transparent" : "bg-gold",
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "truncate text-sm",
                          n.lida ? "font-normal text-foreground" : "font-medium text-foreground",
                        )}
                      >
                        {n.titulo}
                      </span>
                      {n.descricao && (
                        <span className="text-xs text-muted-foreground">{n.descricao}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {tempoRelativo(n.criadoEm)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function Topbar({ breadcrumb }: { breadcrumb: string[] }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioAtual | null>(null)

  useEffect(() => {
    getUsuarioAtual().then(setUsuario).catch(() => {})
  }, [])

  async function handleSair() {
    await sair()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-6">
      <nav aria-label="Trilha de navegação" className="flex min-w-0 items-center gap-1.5 text-sm">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 truncate">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
            <span
              className={
                i === breadcrumb.length - 1
                  ? "truncate font-medium text-foreground"
                  : "truncate text-muted-foreground"
              }
            >
              {item}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <GlobalSearch />

        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {usuario ? iniciais(usuario.nome) : "—"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight md:block">
                <p className="text-sm font-medium text-foreground">{usuario?.nome ?? "Carregando…"}</p>
                <p className="text-xs text-muted-foreground">{usuario?.funcao ?? ""}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSair}>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
