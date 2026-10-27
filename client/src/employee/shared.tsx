import type { ReactNode } from 'react'
import { Badge } from '../components/ui'
import { STATUS_COPY, type ClusterStatus } from './logic'

export function StatusBadge({ status }: { status: ClusterStatus }) {
  const s = STATUS_COPY[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

/** A 1-3 score as a coloured chip. `null` renders a quiet dash. */
export function ScoreChip({ score, label }: { score: number | null; label?: string }) {
  if (score == null) return <span className="score-chip score-chip-empty">–</span>
  return (
    <span className="score-chip" data-score={score} title={label}>
      {score}
    </span>
  )
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="pbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  )
}

export function NotPublished() {
  return (
    <div className="empty">
      <p className="empty-title">Your skill framework isn't ready yet</p>
      <div className="empty-body">The Talent Development team is still setting things up. Check back soon: your skills and assessments will appear here once it's published.</div>
    </div>
  )
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="page-head page-head-row">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {action}
    </header>
  )
}
