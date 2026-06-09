"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  Users,
  Database,
  History,
  BookOpen,
  Settings,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Propostas", href: "/propostas", icon: FileText },
  { label: "Nova proposta", href: "/propostas/nova", icon: FilePlus2 },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Cadastros", href: "/cadastros", icon: Database },
  { label: "Histórico", href: "/historico", icon: History },
  { label: "Base de conhecimento", href: "/base-de-conhecimento", icon: BookOpen },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Logs", href: "/logs", icon: ScrollText },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <Image
          src="/images/iex-logo-branco.png"
          alt="IEX"
          width={48}
          height={26}
          priority
          className="h-7 w-auto"
        />
        <div className="leading-tight">
          <p className="text-xs font-medium text-sidebar-foreground/70">Gestor de Propostas</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-6 py-4">
        <p className="text-xs text-sidebar-foreground/60">Powered by</p>
        <p className="text-xs font-medium text-sidebar-foreground/90">YRM Strategy Lab</p>
      </div>
    </aside>
  )
}
