import type { ClusterStatus } from '../employee/logic'
import type { BuPerson } from './types'

export interface Filters {
  function: string
  location: string
  manager: string
  level: string
}
export const emptyFilters: Filters = { function: '', location: '', manager: '', level: '' }

export const applyFilters = (people: BuPerson[], f: Filters) =>
  people.filter(
    (p) => (!f.function || p.employee.function === f.function) && (!f.location || p.employee.location === f.location) && (!f.manager || p.employee.manager === f.manager) && (!f.level || p.level === f.level),
  )

export const distinct = (people: BuPerson[], pick: (p: BuPerson) => string) => [...new Set(people.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/** What the person still has to do themselves (the manager owns validation). */
export const owes = (p: BuPerson) => [p.self !== 'submitted' && 'self assessment', p.tests.taken < p.tests.total && 'objective tests'].filter(Boolean) as string[]

export function progressOf(p: BuPerson) {
  const total = p.validation.total || 1
  const parts = [p.self === 'submitted' ? 1 : p.selfCount / total / 2, p.tests.taken / (p.tests.total || 1), p.validation.done / total]
  const progress = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
  const complete = p.self === 'submitted' && p.validation.done === p.validation.total && p.tests.taken >= p.tests.total
  return { progress, complete }
}

export const countStatuses = (p: BuPerson) => {
  const out: Record<ClusterStatus, number> = { cleared: 0, open: 0, gap: 0, incomplete: 0 }
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
}

export function totalsOf(people: BuPerson[]): Totals {
  const t: Totals = { n: people.length, selfDone: 0, testsDone: 0, testsAll: 0, valDone: 0, valAll: 0, complete: 0, clusters: 0, statuses: { cleared: 0, open: 0, gap: 0, incomplete: 0 }, progress: 0 }
  let sum = 0
  for (const p of people) {
    const { progress, complete } = progressOf(p)
    sum += progress
    if (p.self === 'submitted') t.selfDone++
    t.testsDone += p.tests.taken
    t.testsAll += p.tests.total
    t.valDone += p.validation.done
    t.valAll += p.validation.total
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
  return [...m.entries()].map(([name, rows]) => ({ name: name || 'Not set', rows, t: totalsOf(rows), pending: rows.reduce((a, p) => a + (p.validation.total - p.validation.done), 0) }))
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
