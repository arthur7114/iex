import type { Proposta, Disciplina } from "./mock-data"
import { disciplinas as seedDisciplinas } from "./mock-data"

const PROPOSALS_KEY = "iex-proposals-v1"
const DRAFT_KEY = "iex-current-proposal-draft-v1"
const DISCIPLINES_KEY = "iex-disciplines-v1"

export function getProposals(): Proposta[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(PROPOSALS_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    return []
  }
}

export function getProposalById(id: string): Proposta | null {
  const proposals = getProposals()
  return proposals.find((p) => p.id === id) || null
}

export function saveProposal(proposal: Proposta) {
  if (typeof window === "undefined") return
  const current = getProposals()
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify([proposal, ...current]))
}

export function updateProposal(proposal: Proposta) {
  if (typeof window === "undefined") return
  const current = getProposals()
  const updated = current.map((p) => p.id === proposal.id ? proposal : p)
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(updated))
}

export function deleteProposal(id: string) {
  if (typeof window === "undefined") return
  const current = getProposals()
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(current.filter((p) => p.id !== id)))
}

export function saveDraft(draft: any) {
  if (typeof window === "undefined") return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function getDraft(): any {
  if (typeof window === "undefined") return null
  try {
    const data = localStorage.getItem(DRAFT_KEY)
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return
  localStorage.removeItem(DRAFT_KEY)
}

export function getDisciplinas(): Disciplina[] {
  if (typeof window === "undefined") return seedDisciplinas
  try {
    const data = localStorage.getItem(DISCIPLINES_KEY)
    return data ? JSON.parse(data) : seedDisciplinas
  } catch (e) {
    return seedDisciplinas
  }
}

export function saveDisciplinas(disciplinas: Disciplina[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(DISCIPLINES_KEY, JSON.stringify(disciplinas))
}
