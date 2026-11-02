import type { ClusterStatus } from '../employee/logic'
import type { BuPerson } from './types'

export interface Filters {
  businessUnit: string
  function: string
  location: string
  manager: string
  level: string
}
export const emptyFilters: Filters = { businessUnit: '', function: '', location: '', manager: '', level: '' }

/** How the BUHR's scope reads in a heading: one unit by name, several as a count. */
export const scopeLabel = (s: { organization: string; businessUnits: string[] }) =>
  s.businessUnits.length === 1 ? `${s.organization} · ${s.businessUnits[0]}` : `${s.organization} · ${s.businessUnits.length} business units`

export const applyFilters = (people: BuPerson[], f: Filters) =>
  people.filter(
    (p) => (!f.businessUnit || p.employee.businessUnit === f.businessUnit) && (!f.function || p.employee.function === f.function) && (!f.location || p.employee.location === f.location) && (!f.manager || p.employee.manager === f.manager) && (!f.level || p.level === f.level),
  )

export const distinct = (people: BuPerson[], pick: (p: BuPerson) => string) => [...new Set(people.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/**
 * The objective test and the manager's evaluation are each one per person, with a section for every skill.
 * The test is taken once every skill with questions has its section scored; the evaluation is done once every skill has its result.
 */
export const testDone = (p: BuPerson) => p.tests.taken >= p.tests.total
export const evalState = (p: BuPerson): 'done' | 'progress' | 'none' =>
  p.validation.total > 0 && p.validation.done === p.validation.total ? 'done' : p.validation.done > 0 ? 'progress' : 'none'

/** What the person still has to do themselves (the manager owns the evaluation). */
export const owes = (p: BuPerson) => [p.self !== 'submitted' && 'self assessment', p.tests.taken < p.tests.total && 'objective test'].filter(Boolean) as string[]

export function progressOf(p: BuPerson) {
  const total = p.validation.total || 1
  const parts = [p.self === 'submitted' ? 1 : p.selfCount / total / 2, p.tests.taken / (p.tests.total || 1), p.validation.done / total]
  const progress = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
  const complete = p.self === 'submitted' && p.validation.done === p.validation.total && p.tests.taken >= p.tests.total
  // Three parts to a cycle: the self assessment, the objective test and the manager's evaluation of every skill.
  const steps = [p.self === 'submitted', p.tests.taken >= p.tests.total, p.validation.done === p.validation.total].filter(Boolean).length
  return { progress, steps, complete }
}

export const STEPS_PER_PERSON = 3

export const countStatuses = (p: BuPerson) => {
  const out: Record<ClusterStatus, number> = { cleared: 0, gap: 0, incomplete: 0 }
  p.clusters.forEach((c) => out[c.status]++)
  return out
}

export interface Totals {
  n: number
  selfDone: number
  testsDone: number
  testsAll: number
  valDone: number
  valAll: number
  complete: number
  clusters: number
  statuses: Record<ClusterStatus, number>
  progress: number
  /** Steps done, and the most there could be, across everyone counted. */
  steps: number
  stepsAll: number
}

export function totalsOf(people: BuPerson[]): Totals {
  const t: Totals = { n: people.length, selfDone: 0, testsDone: 0, testsAll: people.length, valDone: 0, valAll: people.length, complete: 0, clusters: 0, statuses: { cleared: 0, gap: 0, incomplete: 0 }, progress: 0, steps: 0, stepsAll: people.length * STEPS_PER_PERSON }
  let sum = 0
  for (const p of people) {
    const { progress, steps, complete } = progressOf(p)
    sum += progress
    t.steps += steps
    if (p.self === 'submitted') t.selfDone++
    // Counted in people: one test and one evaluation each.
    if (testDone(p)) t.testsDone++
    if (evalState(p) === 'done') t.valDone++
    if (complete) t.complete++
    t.clusters += p.clusters.length
    p.clusters.forEach((c) => t.statuses[c.status]++)
  }
  t.progress = people.length ? Math.round(sum / people.length) : 0
  return t
}

export function groupBy(people: BuPerson[], key: (p: BuPerson) => string) {
  const m = new Map<string, BuPerson[]>()
  for (const p of people) m.set(key(p), [...(m.get(key(p)) ?? []), p])
  return [...m.entries()].map(([name, rows]) => ({ name: name || 'Not set', rows, t: totalsOf(rows), pending: rows.filter((p) => evalState(p) !== 'done').length }))
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
