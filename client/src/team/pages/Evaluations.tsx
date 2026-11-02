import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Badge, Card, Empty, Segmented } from '../../components/ui'
import { ScoreChip } from '../../employee/shared'
import { SCORE_NAME, outOf } from '../../employee/logic'
import { memberStats, type PublishedMember } from '../logic'

const STATE = {
  done: { label: 'Done', tone: 'good' as const, cta: 'Review' },
  progress: { label: 'In progress', tone: 'warn' as const, cta: 'Continue' },
  none: { label: 'Not started', tone: 'neutral' as const, cta: 'Start evaluation' },
}

/** One evaluation per person, with a section for each skill. Done when every skill has its result. */
export function Evaluations({ members }: { members: PublishedMember[] }) {
  const [filter, setFilter] = useState<'todo' | 'all'>('todo')
  const rows = members.map((m) => ({ m, st: memberStats(m) }))
  const shown = rows.filter(({ st }) => filter === 'all' || st.evaluation.state !== 'done')
  const doneCount = rows.filter(({ st }) => st.evaluation.state === 'done').length

  return (
    <div className="stack">
      <Card
        title="Manager evaluations"
        description={`${outOf(doneCount, rows.length)} evaluations done. Evaluate each person once: it has a section for every skill, and in each you mark the tasks Yes, No or Not applicable. Each section is scored on its own. Your skip manager may review it afterwards.`}
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
          <Empty title="All caught up">Every evaluation for your team is done. Switch to All to review or revise any of them.</Empty>
        ) : (
          <ul className="eval-list">
            {shown.map(({ m, st }) => {
              const e = m.snapshot.employee
              const ev = st.evaluation
              const s = STATE[ev.state]
              return (
                <li key={m.id}>
                  <span className="demo-avatar">{e.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                  <span className="eval-who">
                    <a className="strong" href={`#/team/member/${m.id}`}>
                      {e.name}
                    </a>
                    <small className="muted">{e.designation}</small>
                  </span>
                  <span className="eval-skills" aria-label="Result for each skill">
                    {m.snapshot.clusters.map((c) => (
                      <span key={c.id} className="eval-skill" title={c.manager.status === 'calibrated' ? `${c.name}: ${SCORE_NAME[c.manager.calibrated]}` : `${c.name}: not evaluated yet`}>
                        <ScoreChip score={c.manager.status === 'calibrated' ? c.manager.calibrated : null} />
                      </span>
                    ))}
                  </span>
                  <Badge tone={s.tone}>
                    {s.tone === 'good' && <Check size={11} strokeWidth={3} />}
                    {ev.state === 'progress' ? `${outOf(ev.done, ev.total)} skills` : s.label}
                  </Badge>
                  <a className={`btn btn-sm ${ev.state === 'done' ? '' : 'btn-primary'}`} href={`#/team/validate/${m.id}`}>
                    {s.cta} <ArrowRight size={13} />
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
