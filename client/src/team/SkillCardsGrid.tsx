import { ArrowRight } from 'lucide-react'
import { Badge } from '../components/ui'
import { ProgressBar } from '../employee/shared'

export interface CardSummary {
  id: string
  name: string
  role: string
  sub: string
  level: string
  cleared: number
  open: number
  gaps: number
  awaiting: number
  total: number
  exception?: string | null
}

/** A gallery of people's skill cards. Each opens the full, printable card. */
export function SkillCardsGrid({ items, hrefFor }: { items: CardSummary[]; hrefFor: (id: string) => string }) {
  if (!items.length) return <p className="muted">No one to show.</p>
  return (
    <ul className="cards-grid">
      {items.map((c) => (
        <li key={c.id}>
          <a className="mini-card" href={hrefFor(c.id)}>
            <span className="mini-card-top">
              <span className="demo-avatar">{c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
              <span className="mini-card-who">
                <strong>{c.name}</strong>
                <small className="muted">{c.role}</small>
              </span>
              <Badge tone="accent">{c.level}</Badge>
            </span>
            <span className="mini-card-sub muted">{c.sub}</span>
            {c.exception && <Badge tone="warn">{c.exception}</Badge>}
            <ProgressBar value={c.cleared} max={c.total} label={`${c.name}: skills cleared`} />
            <span className="mini-card-stats">
              <span data-status="cleared" title="Cleared">{c.cleared} cleared</span>
              {c.gaps > 0 && <span data-status="gap" title="Gaps">{c.gaps} gap{c.gaps === 1 ? '' : 's'}</span>}
              {c.open > 0 && <span data-status="open">{c.open} in progress</span>}
              {c.awaiting > 0 && <span data-status="incomplete">{c.awaiting} awaiting</span>}
            </span>
            <span className="step-cta">
              Open skill card <ArrowRight size={14} />
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
