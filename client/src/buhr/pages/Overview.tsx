import { ArrowRight } from 'lucide-react'
import { Card } from '../../components/ui'
import { daysUntil, fmtDate, type ClusterStatus } from '../../employee/logic'
import { HEAT_LABEL } from '../../team/logic'
import { useBu } from '../BuContext'
import { groupBy, pct, progressOf, totalsOf } from '../logic'
import type { PublishedBu } from '../types'

const ORDER: ClusterStatus[] = ['cleared', 'open', 'gap', 'incomplete']

export function BuOverview({ data }: { data: PublishedBu }) {
  const { filtered } = useBu()
  const t = totalsOf(filtered)
  const days = daysUntil(data.cycle.due)
  const managers = groupBy(filtered, (p) => p.employee.manager)
    .filter((g) => g.pending > 0)
    .sort((a, b) => b.pending - a.pending)
  const notStarted = filtered.filter((p) => progressOf(p).progress === 0 || (p.self === 'none' && p.tests.taken === 0 && p.validation.done === 0)).length
  const exceptions = filtered.filter((p) => p.employee.exception).length

  const funnel = [
    { label: 'Self assessments submitted', done: t.selfDone, all: t.n },
    { label: 'Objective tests taken', done: t.testsDone, all: t.testsAll },
    { label: 'Manager validations done', done: t.valDone, all: t.valAll },
  ]

  if (!filtered.length) return <p className="muted">No one matches these filters.</p>

  return (
    <div className="stack">
      <div className="tally">
        <div className="tally-item" data-tone="neutral">
          <strong>{t.n}</strong>
          <span>People in scope</span>
        </div>
        <div className="tally-item" data-tone={t.complete === t.n ? 'good' : 'warn'}>
          <strong>{pct(t.complete, t.n)}%</strong>
          <span>Fully complete ({t.complete})</span>
        </div>
        <div className="tally-item" data-tone="neutral">
          <strong>{t.progress}%</strong>
          <span>Average progress</span>
        </div>
        <div className="tally-item" data-tone="good">
          <strong>{pct(t.statuses.cleared, t.clusters)}%</strong>
          <span>Skills cleared</span>
        </div>
        <div className="tally-item" data-tone={t.statuses.gap ? 'bad' : 'good'}>
          <strong>{t.statuses.gap}</strong>
          <span>Development gaps</span>
        </div>
        <div className="tally-item" data-tone={days != null && days <= 14 ? 'bad' : 'neutral'}>
          <strong>{days == null ? '–' : days >= 0 ? days : 'Past'}</strong>
          <span>{days != null && days >= 0 ? `Days left · due ${fmtDate(data.cycle.due)}` : 'Past due'}</span>
        </div>
      </div>

      <Card title="Cycle completion" description={`${data.cycle.name} · ${data.scope.organization} ${data.scope.businessUnit}`}>
        <ul className="funnel">
          {funnel.map((f) => (
            <li key={f.label}>
              <span>{f.label}</span>
              <div className="pbar" role="progressbar" aria-valuenow={pct(f.done, f.all)} aria-valuemin={0} aria-valuemax={100} aria-label={f.label}>
                <span style={{ transform: `scaleX(${f.all ? f.done / f.all : 0})` }} />
              </div>
              <b>
                {f.done}/{f.all}
              </b>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid-2">
        <Card title="Where skills stand" description="Every person-and-skill result across the business unit.">
          <div className="split-bar split-bar-lg" role="img" aria-label={ORDER.map((s) => `${t.statuses[s]} ${HEAT_LABEL[s]}`).join(', ')}>
            {ORDER.map((s) => t.statuses[s] > 0 && <span key={s} data-status={s} style={{ flexGrow: t.statuses[s] }} title={`${t.statuses[s]} ${HEAT_LABEL[s]}`}>{t.statuses[s]}</span>)}
          </div>
          <div className="legend">
            {ORDER.map((s) => (
              <span key={s}>
                <i className="swatch heat-swatch" data-status={s} /> {HEAT_LABEL[s]} · {pct(t.statuses[s], t.clusters)}%
              </span>
            ))}
          </div>
        </Card>

        <Card title="Needs attention" description="Where a nudge would help most.">
          <ul className="attention-list">
            <li>
              <span>
                <strong>{managers[0] ? managers[0].name : 'No manager'}</strong>
                <small className="muted">{managers[0] ? `${managers[0].pending} validations pending, the most in the unit` : 'Every validation is done'}</small>
              </span>
              <a className="btn btn-sm" href="#/bu/completion">
                By manager <ArrowRight size={13} />
              </a>
            </li>
            <li>
              <span>
                <strong>{notStarted} not started</strong>
                <small className="muted">No self assessment, test or validation yet</small>
              </span>
              <a className="btn btn-sm" href="#/bu/employees">
                Employees <ArrowRight size={13} />
              </a>
            </li>
            <li>
              <span>
                <strong>{exceptions} exception{exceptions === 1 ? '' : 's'}</strong>
                <small className="muted">Missing data or paused workflow</small>
              </span>
              <a className="btn btn-sm" href="#/bu/exceptions">
                Review <ArrowRight size={13} />
              </a>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
