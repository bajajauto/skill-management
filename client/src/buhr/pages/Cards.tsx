import { useState } from 'react'
import { SkillCardView } from '../../employee/pages/SkillCard'
import { SkillCardsGrid } from '../../team/SkillCardsGrid'
import { useBu } from '../BuContext'
import { countStatuses } from '../logic'
import { usePerson } from '../usePerson'

/** Skill cards for everyone in the business unit, narrowed by the shared filters and a name search. */
export function BuCards() {
  const { filtered } = useBu()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = filtered.filter((p) => !needle || `${p.employee.name} ${p.employee.employeeId}`.toLowerCase().includes(needle))

  return (
    <div className="stack">
      <div className="emp-tools">
        <input className="input" type="search" placeholder="Search name or ID" aria-label="Search skill cards" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">
          {shown.length} {shown.length === 1 ? 'card' : 'cards'}
        </span>
      </div>
      <SkillCardsGrid
        hrefFor={(id) => `#/bu/card/${id}`}
        items={shown.map((p) => {
          const s = countStatuses(p)
          return {
            id: p.id,
            name: p.employee.name,
            role: p.employee.designation,
            sub: `${p.employee.function} · ${p.employee.location}`,
            level: p.level,
            cleared: s.cleared,
            open: s.open,
            gaps: s.gap,
            awaiting: s.incomplete,
            total: p.clusters.length,
            exception: p.employee.exception,
          }
        })}
      />
    </div>
  )
}

export function BuCardDetail({ id }: { id: string }) {
  const person = usePerson(id)
  if (person === null) return <p className="muted">Loading…</p>
  if (person === 'missing') {
    return (
      <div className="stack">
        <a className="back-link" href="#/bu/cards">
          Back to skill cards
        </a>
        <p className="muted">That person isn't in your business unit.</p>
      </div>
    )
  }
  return <SkillCardView m={person} title={`${person.employee.name}'s skill card`} sub="A one-page summary of strengths and development areas." back={{ href: '#/bu/cards', label: 'Skill cards' }} />
}
