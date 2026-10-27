import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react'
import type { AppState, Config, Level, Question, Reviewed, SkillNode, StructureKey } from './types'
import { emptyState, sampleState } from './lib/defaults'
import { cohortApi } from './api'

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'config'; update: (c: Config) => Config }
  | { type: 'review'; area: keyof Reviewed; value: boolean }
  | { type: 'structure'; structure: StructureKey }
  | { type: 'levels'; levels: Level[] }
  | { type: 'node/save'; node: SkillNode }
  | { type: 'node/delete'; id: string }
  | { type: 'nodes/add'; nodes: SkillNode[] }
  | { type: 'question/save'; question: Question }
  | { type: 'questions/add'; questions: Question[] }
  | { type: 'questions/delete'; ids: string[] }
  | { type: 'questions/assign'; ids: string[]; skillId?: string; levelId?: string }
  | { type: 'questions/active'; ids: string[]; active: boolean }
  | { type: 'sample' }
  | { type: 'reset' }

/** Editing a step counts as reviewing it: scoring edits sign off Scoring, anything else in the config signs off Framework. */
function markReviewed(prev: Config, next: Config): Config {
  const scoring = next.scoring !== prev.scoring
  const framework = (Object.keys(next) as (keyof Config)[]).some((k) => k !== 'scoring' && k !== 'reviewed' && next[k] !== prev[k])
  if (!scoring && !framework) return next
  return { ...next, reviewed: { ...next.reviewed, ...(scoring ? { scoring: true } : {}), ...(framework ? { framework: true } : {}) } }
}

function descendants(id: string, nodes: SkillNode[]): Set<string> {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
        out.add(n.id)
        grew = true
      }
    }
  }
  return out
}

function reduce(s: AppState, a: Action): AppState {
  const dirty = (next: Partial<AppState>): AppState => ({ ...s, ...next, dirtySincePublish: true })
  switch (a.type) {
    case 'hydrate':
      return a.state
    case 'config':
      return dirty({ config: markReviewed(s.config, a.update(s.config)) })

    case 'review':
      return dirty({ config: { ...s.config, reviewed: { ...s.config.reviewed, [a.area]: a.value } } })

    case 'structure': {
      // Dropping the sub-skill tier: re-attach its tasks to the parent skill so nothing is lost.
      let nodes = s.nodes
      let ratedAt = s.config.ratedAt
      if (a.structure === 'skill-task') {
        const subs = new Map(nodes.filter((n) => n.type === 'subskill').map((n) => [n.id, n.parentId]))
        nodes = nodes
          .filter((n) => n.type !== 'subskill')
          .map((n) => (n.parentId && subs.has(n.parentId) ? { ...n, parentId: subs.get(n.parentId) ?? null } : n))
        if (ratedAt === 'subskill') ratedAt = 'task'
      }
      if (a.structure === 'skill-subskill') {
        nodes = nodes.filter((n) => n.type !== 'task')
        ratedAt = 'subskill'
      }
      return dirty({ nodes, config: { ...s.config, structure: a.structure, ratedAt, reviewed: { ...s.config.reviewed, framework: true } } })
    }

    case 'levels': {
      const keep = new Set(a.levels.map((l) => l.id))
      const fix = <T extends { levelId: string | null }>(x: T): T => (x.levelId && !keep.has(x.levelId) ? { ...x, levelId: null } : x)
      return dirty({ config: { ...s.config, levels: a.levels, reviewed: { ...s.config.reviewed, framework: true } }, nodes: s.nodes.map(fix), questions: s.questions.map(fix) })
    }

    case 'node/save': {
      const exists = s.nodes.some((n) => n.id === a.node.id)
      return dirty({ nodes: exists ? s.nodes.map((n) => (n.id === a.node.id ? a.node : n)) : [...s.nodes, a.node] })
    }
    case 'node/delete': {
      const gone = descendants(a.id, s.nodes)
      return dirty({
        nodes: s.nodes.filter((n) => !gone.has(n.id)),
        questions: s.questions.map((q) => (q.skillId && gone.has(q.skillId) ? { ...q, skillId: null } : q)),
      })
    }
    case 'nodes/add':
      return dirty({ nodes: [...s.nodes, ...a.nodes] })

    case 'question/save': {
      const exists = s.questions.some((q) => q.id === a.question.id)
      return dirty({ questions: exists ? s.questions.map((q) => (q.id === a.question.id ? a.question : q)) : [a.question, ...s.questions] })
    }
    case 'questions/add':
      return dirty({ questions: [...a.questions, ...s.questions] })
    case 'questions/delete': {
      const ids = new Set(a.ids)
      return dirty({ questions: s.questions.filter((q) => !ids.has(q.id)) })
    }
    case 'questions/assign': {
      const ids = new Set(a.ids)
      return dirty({
        questions: s.questions.map((q) =>
          ids.has(q.id)
            ? { ...q, skillId: a.skillId ?? q.skillId, levelId: a.levelId ?? q.levelId }
            : q,
        ),
      })
    }
    case 'questions/active': {
      const ids = new Set(a.ids)
      return dirty({ questions: s.questions.map((q) => (ids.has(q.id) ? { ...q, active: a.active } : q)) })
    }

    // Both keep the cohort's identity and its published-version info; only the working draft changes.
    case 'sample': {
      const x = sampleState()
      return { ...x, config: { ...x.config, organization: s.config.organization, businessUnit: s.config.businessUnit }, publication: s.publication, dirtySincePublish: true }
    }
    case 'reset': {
      const x = emptyState()
      return { ...x, config: { ...x.config, organization: s.config.organization, businessUnit: s.config.businessUnit }, publication: s.publication, dirtySincePublish: true }
    }
  }
}

function withDefaults(parsed: AppState): AppState {
  // Merge over defaults so older saved documents pick up newly added config keys.
  const base = emptyState()
  // Cohorts that were set up before sign-off existed are treated as signed off if they were already published.
  const reviewed: Reviewed = parsed.config?.reviewed ?? { framework: parsed.publication != null, scoring: parsed.publication != null }
  return { ...base, ...parsed, config: { ...base.config, ...parsed.config, reviewed, scoring: { ...base.config.scoring, ...parsed.config?.scoring } } }
}

export type SaveStatus = 'saved' | 'saving' | 'error'

const StateCtx = createContext<AppState | null>(null)
const DispatchCtx = createContext<Dispatch<Action> | null>(null)
const SaveCtx = createContext<SaveStatus>('saved')

const PublishCtx = createContext<() => Promise<void>>(async () => {})
const CohortIdCtx = createContext<string>('')
const SaveNowCtx = createContext<() => Promise<void>>(async () => {})

/** Working draft of one cohort's framework. Edits auto-save to the server; `publish` freezes a new version. */
export function StoreProvider({ cohortId, onChanged, children }: { cohortId: string; onChanged?: () => void; children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, emptyState)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [save, setSave] = useState<SaveStatus>('saved')
  // The last state that matches the server, so hydrating doesn't trigger a pointless save.
  const synced = useRef<AppState | null>(null)
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    cohortApi
      .get(cohortId)
      .then((remote) => {
        if (cancelled) return
        const s = withDefaults(remote)
        synced.current = s
        dispatch({ type: 'hydrate', state: s })
        setPhase('ready')
      })
      .catch(() => !cancelled && setPhase('failed'))
    return () => {
      cancelled = true
    }
  }, [attempt, cohortId])

  useEffect(() => {
    if (phase !== 'ready' || state === synced.current) return
    setSave('saving')
    const t = setTimeout(() => {
      // "Save and next" may already have written this exact state.
      if (state === synced.current) {
        setSave('saved')
        return
      }
      cohortApi
        .save(cohortId, state)
        .then(() => {
          synced.current = state
          setSave('saved')
          onChanged?.()
        })
        .catch(() => setSave('error'))
    }, 500)
    return () => clearTimeout(t)
  }, [state, phase, cohortId, onChanged])

  // Leaving the cohort (or the page) with edits still waiting out the debounce: write them now.
  useEffect(
    () => () => {
      if (synced.current && latest.current !== synced.current) void cohortApi.save(cohortId, latest.current).then(() => onChanged?.())
    },
    [cohortId, onChanged],
  )

  useEffect(() => {
    if (save === 'saved') return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [save])

  /** Write any waiting edits now instead of after the auto-save delay. Throws if the save fails. */
  const saveNow = useCallback(async () => {
    if (latest.current === synced.current) return
    const snapshot = latest.current
    setSave('saving')
    try {
      await cohortApi.save(cohortId, snapshot)
    } catch (e) {
      setSave('error')
      throw e
    }
    synced.current = snapshot
    setSave(latest.current === snapshot ? 'saved' : 'saving')
    onChanged?.()
  }, [cohortId, onChanged])

  const publish = useCallback(async () => {
    if (latest.current !== synced.current) {
      await cohortApi.save(cohortId, latest.current)
      synced.current = latest.current
    }
    const r = await cohortApi.publish(cohortId)
    const s = withDefaults(r.state)
    synced.current = s
    dispatch({ type: 'hydrate', state: s })
    setSave('saved')
    onChanged?.()
  }, [cohortId, onChanged])

  if (phase !== 'ready') {
    return (
      <div className="boot">
        {phase === 'loading' ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <p className="strong">Couldn't load this cohort</p>
            <p className="muted">Check that the API is running, then try again.</p>
            <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        <CohortIdCtx.Provider value={cohortId}>
        <PublishCtx.Provider value={publish}>
          <SaveNowCtx.Provider value={saveNow}>
            <SaveCtx.Provider value={save}>{children}</SaveCtx.Provider>
          </SaveNowCtx.Provider>
        </PublishCtx.Provider>
        </CohortIdCtx.Provider>
      </DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export const useCohortId = () => useContext(CohortIdCtx)

/** Like useStore, but null when no cohort is open (the sidebar needs to work without one). */
export const useStoreMaybe = () => useContext(StateCtx)

export const useSaveNow = () => useContext(SaveNowCtx)

export function usePublish() {
  return useContext(PublishCtx)
}
export function useSaveStatus() {
  return useContext(SaveCtx)
}

export function useStore() {
  const s = useContext(StateCtx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
export function useDispatch() {
  const d = useContext(DispatchCtx)
  if (!d) throw new Error('StoreProvider missing')
  return d
}

/** Convenience selectors shared across pages. */
export function useDerived() {
  const { nodes, config } = useStore()
  return useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const kids = new Map<string | null, SkillNode[]>()
    for (const n of nodes) {
      const k = n.parentId
      kids.set(k, [...(kids.get(k) ?? []), n])
    }
    const levelName = (id: string | null) => config.levels.find((l) => l.id === id)?.name ?? null
    return { byId, kids, levelName }
  }, [nodes, config.levels])
}
