// Rascunho do wizard de nova proposta — mantido em localStorage (trabalho em
// andamento, por usuário/navegador). A persistência das propostas em si vai
// para o Supabase (ver lib/db/propostas.ts).

const DRAFT_KEY = "iex-current-proposal-draft-v1"

export function saveDraft(draft: any) {
  if (typeof window === "undefined") return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
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

export function clearDraft() {
  if (typeof window === "undefined") return
  localStorage.removeItem(DRAFT_KEY)
}
