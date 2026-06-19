"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { Button } from "@/components/ui/button"
import { getUsuarioAtual, sair } from "@/lib/db/usuarios"
import type { UsuarioAtual } from "@/lib/db/types"

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?"
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
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar propostas, clientes..."
            className="h-9 w-56 bg-background pl-9 lg:w-72"
            aria-label="Buscar"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold" />
        </Button>

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
