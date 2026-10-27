import type { Cluster, PublishedMe } from './types'

export type ClusterStatus = 'incomplete' | 'gap' | 'open' | 'cleared'

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
  if (m < s.courseTriggerBelow || t < s.courseTriggerBelow) return 'gap'
  if (m >= s.progressionMin && t >= s.progressionMin) return 'cleared'
  return 'open'
}

export const STATUS_COPY: Record<ClusterStatus, { label: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }> = {
  cleared: { label: 'Cleared', tone: 'good' },
  gap: { label: 'Development gap', tone: 'bad' },
  open: { label: 'In progress', tone: 'warn' },
  incomplete: { label: 'Awaiting results', tone: 'neutral' },
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
    open: by('open'),
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
    testsLeft: testable.filter((c) => !c.test.latest && c.test.attemptsLeft > 0),
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

/** Whichever decision input pulls a cluster below the threshold. */
export function gapSources(c: Cluster, s: PublishedMe['scoring']) {
  const out: string[] = []
  const m = managerScore(c)
  const t = testScore(c)
  if (m != null && m < s.courseTriggerBelow) out.push('manager validation')
  if (t != null && t < s.courseTriggerBelow) out.push('objective test')
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
