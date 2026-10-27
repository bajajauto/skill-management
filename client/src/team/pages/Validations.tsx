import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Badge, Card, Empty, Segmented } from '../../components/ui'
import { ScoreChip } from '../../employee/shared'
import { SCORE_NAME, pctOf } from '../../employee/logic'
import type { Cluster } from '../../employee/types'
import { memberStats, type PublishedMember } from '../logic'

function validationState(c: Cluster) {
  if (c.manager.status === 'calibrated') return { label: 'Validated', tone: 'good' as const, cta: 'Review' }
  if (c.validation.status === 'draft') return { label: 'Draft saved', tone: 'warn' as const, cta: 'Continue' }
  return { label: 'To do', tone: 'neutral' as const, cta: 'Validate' }
}

export function Validations({ members }: { members: PublishedMember[] }) {
  const [filter, setFilter] = useState<'todo' | 'all'>('todo')
  const rows = members.map((m) => ({ m, st: memberStats(m) }))
  const shown = rows.filter(({ st }) => filter === 'all' || st.validationsPending.length > 0)

  return (
    <div className="stack">
      <Card
        title="Task validation"
        description="For each skill, mark every task Yes, No or Not applicable. Your answers become the manager score. Your skip manager may review it afterwards."
        action={
          <Segmented
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'todo', label: 'To do' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      >
        {shown.length === 0 ? (
          <Empty title="All caught up">Every validation for your team is done. Switch to All to review or revise any of them.</Empty>
        ) : (
          <div className="stack-sm">
            {shown.map(({ m, st }) => {
              const clusters = m.snapshot.clusters.filter((c) => filter === 'all' || c.manager.status === 'pending')
              return (
                <section key={m.id} className="val-member">
                  <header className="val-member-head">
                    <span className="demo-avatar">{m.snapshot.employee.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                    <div>
                      <a className="strong" href={`#/team/member/${m.id}`}>
                        {m.snapshot.employee.name}
                      </a>
                      <p className="muted">{m.snapshot.employee.designation}</p>
                    </div>
                    <span className="muted val-count">
                      {st.s.managerDone} of {st.total} validated
                    </span>
                  </header>
                  <ul className="val-list">
                    {clusters.map((c) => {
                      const v = validationState(c)
                      return (
                        <li key={c.id}>
                          <span className="strong val-name">{c.name}</span>
                          <span className="muted">{c.tasks.length} tasks</span>
                          {c.manager.status === 'calibrated' ? (
                            <span className="val-score">
                              <ScoreChip score={c.manager.calibrated} /> {SCORE_NAME[c.manager.calibrated]} · {pctOf(c.manager.pct)}
                            </span>
                          ) : (
                            <span />
                          )}
                          <Badge tone={v.tone}>
                            {v.tone === 'good' && <Check size={11} strokeWidth={3} />}
                            {v.label}
                          </Badge>
                          <a className={`btn btn-sm ${v.tone === 'good' ? '' : 'btn-primary'}`} href={`#/team/validate/${m.id}/${c.id}`}>
                            {v.cta} <ArrowRight size={13} />
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
