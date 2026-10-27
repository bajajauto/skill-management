import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { teamApi } from '../api'
import type { MeSnapshot, TeamMember } from '../employee/types'

interface Ctx {
  members: TeamMember[] | null
  error: string | null
  refresh: () => Promise<void>
  /** Swap one person's snapshot after a validation was saved. */
  patch: (id: string, snapshot: MeSnapshot) => void
  markReminded: (id: string, at: string) => void
}
const TeamCtx = createContext<Ctx | null>(null)

export function TeamProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setMembers((await teamApi.list()).members)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your team.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patch = useCallback((id: string, snapshot: MeSnapshot) => setMembers((ms) => ms?.map((m) => (m.id === id ? { ...m, snapshot } : m)) ?? ms), [])
  const markReminded = useCallback((id: string, at: string) => setMembers((ms) => ms?.map((m) => (m.id === id ? { ...m, remindedAt: at } : m)) ?? ms), [])

  return <TeamCtx.Provider value={{ members, error, refresh, patch, markReminded }}>{children}</TeamCtx.Provider>
}

export function useTeam() {
  const c = useContext(TeamCtx)
  if (!c) throw new Error('TeamProvider missing')
  return c
}
