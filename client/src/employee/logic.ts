import type { Cluster, PublishedMe } from './types'

export type ClusterStatus = 'incomplete' | 'gap' | 'cleared'

export const SCORE_NAME: Record<number, string> = { 1: 'Developing', 2: 'Competent', 3: 'Expert' }
export const SELF_LABEL = ['No exposure', 'Beginner', 'Competent', 'Confident'] as const

export const managerScore = (c: Cluster): number | null => (c.manager.status === 'pending' ? null : c.manager.calibrated)
export const testScore = (c: Cluster): number | null => c.test.latest?.score ?? null

/** Gap and progression use the calibrated manager score and the test score only. Self-rating never counts. */
export function clusterStatus(c: Cluster, s: PublishedMe['scoring']): ClusterStatus {
  const fill = (v: number | null) => v ?? (s.missingInput === 'treat-as-zero' ? 0 : null)
  const m = fill(managerScore(c))
  const t = fill(testScore(c))
  if (m == null || t == null) return 'incomplete'
  // One bar: both scores reaching it clears the skill, and either one below it is a development gap.
  if (m >= s.progressionMin && t >= s.progressionMin) return 'cleared'
  return 'gap'
}

export const STATUS_COPY: Record<ClusterStatus, { label: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }> = {
  cleared: { label: 'Cleared', tone: 'good' },
  gap: { label: 'Development gap', tone: 'bad' },
  incomplete: { label: 'Awaiting results', tone: 'neutral' },
}

/**
 * A manager evaluates a person once, with a section for each skill. It is done when every skill has its result,
 * under way when some do or a draft is saved, and not started otherwise.
 */
export function evaluationOf(me: PublishedMe) {
  const total = me.clusters.length
  const done = me.clusters.filter((c) => c.manager.status === 'calibrated').length
  const drafting = me.clusters.some((c) => c.validation.status === 'draft')
  const state: 'done' | 'progress' | 'none' = total > 0 && done === total ? 'done' : done > 0 || drafting ? 'progress' : 'none'
  return { state, done, total }
}

export function summarize(me: PublishedMe) {
  const rows = me.clusters.map((c) => ({ c, status: clusterStatus(c, me.scoring) }))
  const by = (s: ClusterStatus) => rows.filter((r) => r.status === s)
  const levelIdx = me.levels.findIndex((l) => l.id === me.currentLevelId)
  const testsTaken = me.clusters.filter((c) => c.test.latest).length
  const testable = me.clusters.filter((c) => c.test.questionCount > 0)
  const managerDone = me.clusters.filter((c) => c.manager.status === 'calibrated').length
  return {
    rows,
    cleared: by('cleared'),
    gaps: by('gap'),
    incomplete: by('incomplete'),
    allCleared: rows.length > 0 && by('cleared').length === rows.length,
    level: me.levels[levelIdx],
    levelIdx,
    nextLevel: me.levels[levelIdx + 1] ?? null,
    selfDone: me.self.submittedAt != null,
    selfDraftCount: me.clusters.filter((c) => c.self).length,
    testsTaken,
    testsTotal: me.clusters.length,
    testableCount: testable.length,
    // The objective test is one module. It's done once taken, or once every skill that has questions has a result.
    testDone: me.test.attemptsLeft === 0 || (testable.length > 0 && testsTaken >= testable.length),
    testToTake: me.test.questionCount > 0 && !(me.test.attemptsLeft === 0 || (testable.length > 0 && testsTaken >= testable.length)),
    testStarted: me.test.inProgressId != null,
    managerDone,
  }
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null
  const end = new Date(iso + 'T23:59:59')
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000)
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export const pctOf = (n: number | null) => (n == null ? '–' : `${Math.round(n)}%`)

/** A number without a pointless trailing .0. */
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''))
export const outOf = (a: number, b: number) => `${fmtNum(a)} out of ${fmtNum(b)}`

type TestNumbers = { earned: number | null; possible: number | null; correct: number | null; total: number }

/** A test result as plain numbers: weighted points when known, otherwise questions answered correctly. */
export function testText(t: TestNumbers): string {
  if (t.possible != null && t.earned != null) return `${outOf(t.earned, t.possible)} points`
  return t.correct != null ? `${outOf(t.correct, t.total)} correct` : '–'
}

/** The same result as a value and its maximum, for bars and comparisons. */
export function testMeasure(t: TestNumbers): { value: number; max: number } | null {
  if (t.possible != null && t.earned != null) return { value: t.earned, max: t.possible }
  return t.correct != null ? { value: t.correct, max: t.total } : null
}

/** Whichever decision input pulls a cluster below the threshold. */
export function gapSources(c: Cluster, s: PublishedMe['scoring']) {
  const out: string[] = []
  const m = managerScore(c)
  const t = testScore(c)
  if (m != null && m < s.progressionMin) out.push('manager evaluation')
  if (t != null && t < s.progressionMin) out.push('objective test')
  return out
}

/** Self-rating (0-3) against the average of the evidence scores (1-3). */
export function selfView(c: Cluster): 'aligned' | 'over' | 'under' | 'unknown' {
  const m = managerScore(c)
  const t = testScore(c)
  if (!c.self || m == null || t == null) return 'unknown'
  const diff = c.self.rating - (m + t) / 2
  return diff > 0.75 ? 'over' : diff < -0.75 ? 'under' : 'aligned'
}
