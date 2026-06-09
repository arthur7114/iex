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

export function DocumentPreview({ data }: { data: DocumentData }) {
  const dataAtual = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })
  
  return (
    <div className="proposal-document mx-auto max-w-3xl bg-white text-[oklch(0.27_0.02_250)] shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b-4 border-primary px-10 pb-6 pt-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
              IE
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">IEX Projetos Ltda</p>
              <p className="text-xs text-muted-foreground">CNPJ: 45.546.897/0001-91</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Proposta comercial</p>
          <p className="font-mono text-sm font-medium">{data.numero}</p>
          <p className="text-xs text-muted-foreground mt-1">{dataAtual}</p>
        </div>
      </div>

      <div className="space-y-8 px-10 py-8">
        <section>
          <p className="text-sm font-medium">À {data.cliente}</p>
          <p className="text-sm">A/C {data.contato}</p>
          <p className="text-sm mt-1">{data.cidade}/{data.uf}</p>
          
          <div className="mt-6">
            <p className="text-sm font-semibold">Ref.: Projetos para {data.empreendimento}</p>
          </div>
        </section>

        <section>
          <p className="text-sm leading-relaxed">
            Prezado(a) {data.contato.split(" ")[0]},
          </p>
          <p className="text-sm leading-relaxed mt-2">
            Apresentamos abaixo preço e demais condições comerciais e técnicas para elaboração dos projetos executivos de engenharia listados da obra acima citada.
          </p>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quadro de áreas</p>
          <div className="flex items-center justify-between rounded-md bg-secondary px-4 py-2.5 text-sm">
            <span>Área total de intervenção</span>
            <span className="font-medium tabular-nums">{data.area.toLocaleString("pt-BR")} m²</span>
          </div>
        </section>

        <section className="avoid-break space-y-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Serviços previstos e Escopo</p>
          <div className="space-y-6">
            {data.itens.map((item, index) => (
              <div key={item.disciplina} className="text-sm">
                <p className="font-semibold text-primary">
                  {index + 1}. {item.disciplina} — {formatBRL(item.valor)}
                </p>
                <div className="mt-1 pl-4 text-muted-foreground">
                  <p>Contempla o desenvolvimento de:</p>
                  <ul className="list-inside list-disc mt-1 space-y-1">
                    {item.escopo?.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="avoid-break">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investimento total</p>
          <div className="flex items-center justify-between border-t-2 border-primary pt-3">
            <span className="font-semibold">Valor total da proposta</span>
            <span className="text-lg font-bold tabular-nums text-primary">{formatBRL(data.total)}</span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-8 avoid-break">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forma de pagamento</p>
            <p className="text-sm font-medium">{data.formaPagamento}</p>
            {data.parcelas && data.parcelas.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {data.parcelas.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.desc}</span>
                    <span className="font-medium text-foreground">{formatBRL(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prazos</p>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-foreground">Execução:</span> <span className="text-muted-foreground">{data.prazoExecucao}</span></p>
              <p><span className="font-medium text-foreground">Validade:</span> <span className="text-muted-foreground">{data.validade}</span></p>
            </div>
          </div>
        </section>

        <section className="avoid-break">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados bancários</p>
          <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            <p>Caixa Econômica Federal — Ag. 1977 — Conta corrente: 575083929-6</p>
            <p>IEX Projetos Ltda — CNPJ: 45.546.897/0001-91</p>
            <p>PIX: 45.546.897/0001-91</p>
          </div>
        </section>

        <div className="page-break" />

        <section className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Premissas e Entregáveis (Encargos da Contratada)</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {data.premissas.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exclusões (Encargos do Contratante)</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {data.exclusoes.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        </section>

        {data.observacoes && (
          <section className="avoid-break">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</p>
            <p className="text-sm text-muted-foreground">{data.observacoes}</p>
          </section>
        )}

        <section className="avoid-break border-t border-border pt-12 text-center">
          <div className="mx-auto flex flex-col items-center gap-1">
            <div className="h-px w-64 bg-foreground/40 mb-2" />
            <p className="text-sm font-medium">{data.responsavel}</p>
            <p className="text-xs text-muted-foreground">Diretor Executivo</p>
          </div>
          <div className="mt-8 text-xs text-muted-foreground space-y-0.5">
            <p>IEX Projetos Ltda</p>
            <p>Rua Monsenhor Bruno, 1153 – Salas 804/806 – Scopa Platinum Corporate</p>
            <p>Aldeota — Fortaleza — CE — (85) 99921-8630 — www.iexprojetos.com</p>
          </div>
        </section>
      </div>
    </div>
  )
}
