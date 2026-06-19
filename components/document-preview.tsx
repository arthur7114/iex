import { formatBRL } from "@/lib/mock-data"

export interface DocumentData {
  numero: string
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
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/70">{children}</p>
  )
}

export function DocumentPreview({ data }: { data: DocumentData }) {
  const dataAtual = new Date().toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" })

  return (
    <div className="proposal-document mx-auto max-w-3xl overflow-hidden rounded-lg bg-white text-[oklch(0.28_0.02_255)] shadow-sm ring-1 ring-slate-200/70">
      {/* Faixa de acento */}
      <div className="h-1.5 bg-primary" />

      {/* Cabeçalho */}
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 px-12 pb-7 pt-9">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-base font-semibold tracking-tight text-primary-foreground">
            IE
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-slate-900">IEX Projetos Ltda</p>
            <p className="text-xs text-slate-500">CNPJ 45.546.897/0001-91</p>
          </div>
        </div>
        <div className="text-right">
          <Eyebrow>Proposta comercial</Eyebrow>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{data.numero}</p>
          <p className="mt-0.5 text-xs capitalize text-slate-500">{dataAtual}</p>
        </div>
      </header>

      <div className="space-y-9 px-12 py-9">
        {/* Destinatário + referência */}
        <section className="space-y-4">
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-slate-900">À {data.cliente}</p>
            {data.contato && <p className="text-slate-600">A/C {data.contato}</p>}
            {(data.cidade || data.uf) && (
              <p className="text-slate-600">
                {data.cidade}
                {data.uf ? `/${data.uf}` : ""}
              </p>
            )}
          </div>
          <div className="rounded-md border-l-2 border-primary bg-slate-50 px-4 py-2.5">
            <p className="text-sm">
              <span className="font-semibold text-slate-900">Ref.:</span>{" "}
              <span className="text-slate-700">Projetos de engenharia — {data.empreendimento}</span>
            </p>
          </div>
        </section>

        {/* Texto de abertura */}
        <section className="space-y-2 text-sm leading-relaxed text-slate-700">
          <p>Prezado(a) {data.contato ? data.contato.split(" ")[0] : "cliente"},</p>
          <p>
            Apresentamos a seguir o preço e as condições comerciais e técnicas para a elaboração dos projetos
            executivos de engenharia da obra em referência.
          </p>
        </section>

        {/* Quadro de áreas */}
        <section className="space-y-2.5">
          <Eyebrow>Quadro de áreas</Eyebrow>
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-600">Área total de intervenção</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {data.area.toLocaleString("pt-BR")} m²
            </span>
          </div>
        </section>

        {/* Serviços e escopo */}
        <section className="avoid-break space-y-4">
          <Eyebrow>Serviços previstos e escopo</Eyebrow>
          <div className="divide-y divide-slate-100">
            {data.itens.map((item, index) => (
              <div key={item.disciplina} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="mr-1.5 text-primary/60">{String(index + 1).padStart(2, "0")}</span>
                    {item.disciplina}
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatBRL(item.valor)}</p>
                </div>
                {item.escopo && item.escopo.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-5">
                    {item.escopo.map((e, i) => (
                      <li key={i} className="relative text-[13px] leading-relaxed text-slate-600">
                        <span className="absolute -left-3.5 top-2 h-1 w-1 rounded-full bg-slate-300" />
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Investimento total */}
        <section className="avoid-break">
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/[0.04] px-5 py-4">
            <div>
              <Eyebrow>Investimento total</Eyebrow>
              <p className="mt-0.5 text-xs text-slate-500">Valor global da proposta</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-primary">{formatBRL(data.total)}</p>
          </div>
        </section>

        {/* Pagamento + prazos */}
        <section className="avoid-break grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <Eyebrow>Forma de pagamento</Eyebrow>
            <p className="text-sm font-medium text-slate-900">{data.formaPagamento}</p>
            {data.parcelas && data.parcelas.length > 0 && (
              <ul className="space-y-2">
                {data.parcelas.map((p, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-600">{p.desc}</span>
                    <span className="shrink-0 font-medium tabular-nums text-slate-900">{formatBRL(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3">
            <Eyebrow>Prazos</Eyebrow>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Execução</span>
                <span className="font-medium text-slate-900">{data.prazoExecucao}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Validade</span>
                <span className="font-medium text-slate-900">{data.validade}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dados bancários */}
        <section className="avoid-break space-y-2.5">
          <Eyebrow>Dados bancários</Eyebrow>
          <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">
            <p>Caixa Econômica Federal — Ag. 1977 — Conta corrente 575083929-6</p>
            <p>IEX Projetos Ltda — CNPJ 45.546.897/0001-91</p>
            <p>PIX 45.546.897/0001-91</p>
          </div>
        </section>

        <div className="page-break" />

        {/* Encargos */}
        <section className="space-y-7">
          <div className="space-y-2.5">
            <Eyebrow>Premissas e entregáveis · encargos da contratada</Eyebrow>
            <ul className="space-y-1.5">
              {data.premissas.map((p, i) => (
                <li key={i} className="relative pl-5 text-[13px] leading-relaxed text-slate-600">
                  <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-primary/40" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2.5">
            <Eyebrow>Exclusões · encargos do contratante</Eyebrow>
            <ul className="space-y-1.5">
              {data.exclusoes.map((p, i) => (
                <li key={i} className="relative pl-5 text-[13px] leading-relaxed text-slate-600">
                  <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-slate-300" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Observações */}
        {data.observacoes && (
          <section className="avoid-break space-y-2.5">
            <Eyebrow>Observações</Eyebrow>
            <p className="text-[13px] leading-relaxed text-slate-600">{data.observacoes}</p>
          </section>
        )}

        {/* Assinatura */}
        <section className="avoid-break pt-10 text-center">
          <div className="mx-auto flex max-w-xs flex-col items-center">
            <div className="mb-2.5 h-px w-full bg-slate-300" />
            <p className="text-sm font-semibold text-slate-900">{data.responsavel}</p>
            <p className="text-xs text-slate-500">Diretor Executivo · IEX Projetos</p>
          </div>
          <div className="mt-9 space-y-0.5 text-[11px] leading-relaxed text-slate-400">
            <p>IEX Projetos Ltda</p>
            <p>Rua Monsenhor Bruno, 1153 — Salas 804/806 — Scopa Platinum Corporate</p>
            <p>Aldeota — Fortaleza/CE — (85) 99921-8630 — www.iexprojetos.com</p>
          </div>
        </section>
      </div>
    </div>
  )
}
