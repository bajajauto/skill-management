import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { skipApi } from '../api'
import type { MeSnapshot, TeamMember } from '../employee/types'

/** The people one level below the signed-in skip-level manager, with their managers' evaluations. */
export type SkipMember = Omit<TeamMember, 'remindedAt'>

interface Ctx {
  members: SkipMember[] | null
  error: string | null
  refresh: () => Promise<void>
  patch: (id: string, snapshot: MeSnapshot) => void
}
const SkipCtx = createContext<Ctx | null>(null)

export function SkipProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<SkipMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setMembers((await skipApi.list()).members)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your skip-level group.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patch = useCallback((id: string, snapshot: MeSnapshot) => setMembers((ms) => ms?.map((m) => (m.id === id ? { ...m, snapshot } : m)) ?? ms), [])

  return <SkipCtx.Provider value={{ members, error, refresh, patch }}>{children}</SkipCtx.Provider>
}

export function useSkip() {
  const c = useContext(SkipCtx)
  if (!c) throw new Error('SkipProvider missing')
  return c
}

/** Where one person stands in calibration: how many evaluated skills are reviewed, and how many were changed. */
export function calibrationOf(snapshot: MeSnapshot) {
  if (!snapshot.published) return { evaluated: 0, reviewed: 0, changed: 0, state: 'none' as const }
  const evaluated = snapshot.clusters.filter((c) => c.manager.status === 'calibrated')
  const reviewed = evaluated.filter((c) => c.manager.calibration).length
  const changed = evaluated.filter((c) => c.manager.calibration && !c.manager.calibration.agreed).length
  const state = evaluated.length === 0 ? ('none' as const) : reviewed === evaluated.length ? ('done' as const) : ('todo' as const)
  return { evaluated: evaluated.length, reviewed, changed, state }
}
