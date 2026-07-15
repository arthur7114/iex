// Rascunho do wizard de nova proposta — mantido em localStorage (trabalho em
// andamento, por usuário/navegador). A persistência das propostas em si vai
// para o Supabase (ver lib/db/propostas.ts).

const DRAFT_KEY = "iex-current-proposal-draft-v1"

// Chave interna com o instante do último salvamento (epoch ms). Fica dentro do
// próprio objeto do rascunho para não exigir uma segunda entrada no storage.
const SAVED_AT = "__savedAt"

// Persiste o rascunho e devolve o instante gravado (epoch ms) para a UI exibir
// "último salvamento". Retorna null quando fora do browser ou em falha.
export function saveDraft(draft: any): number | null {
  if (typeof window === "undefined") return null
  const savedAt = Date.now()
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, [SAVED_AT]: savedAt }))
    return savedAt
  } catch {
    // Ex.: storage cheio ou bloqueado — não interrompe o preenchimento.
    return null
  }
}

export function getDraft(): any {
  if (typeof window === "undefined") return null
  try {
    const data = localStorage.getItem(DRAFT_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// Instante do último salvamento do rascunho atual (epoch ms) ou null.
export function getDraftSavedAt(): number | null {
  const d = getDraft()
  const ts = d?.[SAVED_AT]
  return typeof ts === "number" ? ts : null
}

export function clearDraft() {
  if (typeof window === "undefined") return
  localStorage.removeItem(DRAFT_KEY)
}
