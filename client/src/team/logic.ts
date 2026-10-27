import { summarize, type ClusterStatus } from '../employee/logic'
import type { PublishedMe, TeamMember } from '../employee/types'

export type PublishedMember = TeamMember & { snapshot: PublishedMe }

export const isPublished = (m: TeamMember): m is PublishedMember => m.snapshot.published

export function memberStats(m: PublishedMember) {
  const snap = m.snapshot
  const s = summarize(snap)
  const total = snap.clusters.length
  const testable = s.testableCount || total
  const selfState: 'submitted' | 'draft' | 'none' = s.selfDone ? 'submitted' : s.selfDraftCount ? 'draft' : 'none'
  const validationsPending = snap.clusters.filter((c) => c.manager.status === 'pending')
  const parts = [s.selfDone ? 1 : s.selfDraftCount / (total || 1) / 2, s.testsTaken / (testable || 1), s.managerDone / (total || 1)]
  const progress = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
  const complete = s.selfDone && s.managerDone === total && s.testsTaken >= testable
  return { s, total, testable, selfState, validationsPending, progress, complete, name: snap.employee.name }
}

export const HEAT_LABEL: Record<ClusterStatus, string> = {
  cleared: 'Cleared',
  gap: 'Development gap',
  open: 'In progress',
  incomplete: 'Awaiting results',
}

export function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
