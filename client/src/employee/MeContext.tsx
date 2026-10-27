import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { meApi } from '../api'
import type { MeSnapshot, PublishedMe } from './types'

interface Ctx {
  me: MeSnapshot
  /** Replace the snapshot with a fresher one returned by a mutation. */
  setMe: (m: MeSnapshot) => void
  refresh: () => Promise<void>
}
const MeCtx = createContext<Ctx | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeSnapshot | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const refresh = useCallback(async () => setMe(await meApi.get()), [])

  useEffect(() => {
    let cancelled = false
    setFailed(null)
    meApi
      .get()
      .then((m) => !cancelled && setMe(m))
      .catch((e: Error) => !cancelled && setFailed(e.message))
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (!me) {
    return (
      <div className="boot">
        {failed ? (
          <>
            <p className="strong">Couldn't load your skills</p>
            <p className="muted">{failed}</p>
            <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </>
        ) : (
          <p className="muted">Loading your skills…</p>
        )}
      </div>
    )
  }
  return <MeCtx.Provider value={{ me, setMe, refresh }}>{children}</MeCtx.Provider>
}

export function useMe() {
  const c = useContext(MeCtx)
  if (!c) throw new Error('MeProvider missing')
  return c
}

/** For pages that need a published framework. Returns null when it isn't published. */
export function usePublishedMe(): (Ctx & { me: PublishedMe }) | null {
  const c = useMe()
  return c.me.published ? (c as Ctx & { me: PublishedMe }) : null
}
