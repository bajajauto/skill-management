import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cohortApi } from '../api'
import type { CohortSummary } from '../types'

const LAST_KEY = 'last-cohort'

interface Ctx {
  /** null until the first load finishes. */
  cohorts: CohortSummary[] | null
  refresh: () => Promise<void>
  /** The cohort Skill Framework Setup is working on: the last one opened, else a live one, else any. */
  current: CohortSummary | null
  /** Make a cohort the one Skill Framework Setup works on. */
  select: (id: string) => void
}
const CohortsCtx = createContext<Ctx>({ cohorts: null, refresh: async () => {}, current: null, select: () => {} })

/** The list of cohorts (organization + business unit frameworks), shared by the sidebar and the cohorts pages. */
export function CohortsProvider({ children }: { children: ReactNode }) {
  const [cohorts, setCohorts] = useState<CohortSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_KEY)
    } catch {
      return null
    }
  })

  const refresh = useCallback(async () => {
    try {
      setCohorts(await cohortApi.list())
    } catch {
      /* keep whatever we had; the next change refreshes again */
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    try {
      localStorage.setItem(LAST_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  const current = useMemo(
    () => cohorts?.find((c) => c.id === selectedId) ?? cohorts?.find((c) => c.status === 'live') ?? cohorts?.[0] ?? null,
    [cohorts, selectedId],
  )

  return <CohortsCtx.Provider value={{ cohorts, refresh, current, select }}>{children}</CohortsCtx.Provider>
}

export const useCohorts = () => useContext(CohortsCtx)

export const cohortLabel = (c: Pick<CohortSummary, 'organization' | 'businessUnit'>) =>
  [c.organization || 'No organization', c.businessUnit || 'No business unit'].join(' · ')
