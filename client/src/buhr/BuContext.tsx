import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buhrApi } from '../api'
import { applyFilters, emptyFilters, type Filters } from './logic'
import type { BuPerson, BuTracking } from './types'

interface Ctx {
  data: BuTracking | null
  error: string | null
  refresh: () => Promise<void>
  filters: Filters
  setFilters: (f: Filters) => void
  /** People matching the current filters. */
  filtered: BuPerson[]
  /** Record a reminder to people and/or to managers (about their team's pending validations). */
  remind: (ids: string[], managers?: string[]) => Promise<number>
}
const BuCtx = createContext<Ctx | null>(null)

/** Tracking data for the whole business unit, plus the filters shared by the BUHR screens. */
export function BuProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BuTracking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setData(await buhrApi.tracking())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load business unit tracking.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => (data?.published ? applyFilters(data.people, filters) : []), [data, filters])

  const remind = useCallback(async (ids: string[], managers: string[] = []) => {
    const r = await buhrApi.remind(ids, managers)
    setData((d) => (d ? { ...d, reminders: { ...d.reminders, ...Object.fromEntries(ids.map((i) => [i, r.remindedAt])), ...Object.fromEntries(managers.map((m) => [`mgr:${m}`, r.remindedAt])) } } : d))
    return r.count
  }, [])

  return <BuCtx.Provider value={{ data, error, refresh, filters, setFilters, filtered, remind }}>{children}</BuCtx.Provider>
}

export function useBu() {
  const c = useContext(BuCtx)
  if (!c) throw new Error('BuProvider missing')
  return c
}
