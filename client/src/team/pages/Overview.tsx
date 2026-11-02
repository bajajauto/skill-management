import { ArrowRight } from 'lucide-react'
import { Card } from '../../components/ui'
import { clusterStatus, outOf, type ClusterStatus } from '../../employee/logic'
import { HEAT_LABEL, memberStats, type PublishedMember } from '../logic'

const ORDER: ClusterStatus[] = ['cleared', 'gap', 'incomplete']

export function TeamOverview({ members }: { members: PublishedMember[] }) {
  const stats = members.map((m) => ({ m, st: memberStats(m) }))
  const sum = (f: (s: ReturnType<typeof memberStats>) => number) => stats.reduce((a, { st }) => a + f(st), 0)

  const selfDone = stats.filter(({ st }) => st.selfState === 'submitted').length
  // One test and one evaluation per person, so these count people.
  const testsDone = stats.filter(({ st }) => st.testDone).length
  const evalsDone = stats.filter(({ st }) => st.evaluation.state === 'done').length
  const clusters = sum((st) => st.total)
  const cleared = sum((st) => st.s.cleared.length)
  const gaps = sum((st) => st.s.gaps.length)
  const pending = stats.filter(({ st }) => st.evaluation.state !== 'done')

  const columns = members[0].snapshot.clusters
  const bySkill = columns.map((col) => {
    const counts: Record<ClusterStatus, number> = { cleared: 0, gap: 0, incomplete: 0 }
    for (const m of members) {
      const c = m.snapshot.clusters.find((x) => x.id === col.id)
      if (c) counts[clusterStatus(c, m.snapshot.scoring)]++
    }
    return { col, counts }
  })

  const funnel = [
    { label: 'Self assessments submitted', done: selfDone, all: members.length },
    { label: 'Objective test taken', done: testsDone, all: members.length },
    { label: 'Manager evaluations done', done: evalsDone, all: members.length },
  ]

  return (
    <div className="stack">
      <div className="tally">
        <div className="tally-item" data-tone="neutral">
          <strong>{members.length}</strong>
          <span>Direct reports</span>
        </div>
        <div className="tally-item" data-tone={pending.length ? 'warn' : 'good'}>
          <strong>{pending.length}</strong>
          <span>Evaluations waiting on you</span>
        </div>
        <div className="tally-item" data-tone="good">
          <strong>{outOf(cleared, clusters)}</strong>
          <span>Skills cleared</span>
        </div>
        <div className="tally-item" data-tone={gaps ? 'bad' : 'good'}>
          <strong>{gaps}</strong>
          <span>Development gaps</span>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="callout callout-warn attention">
          <div>
            <p className="strong">{pending.length} evaluation{pending.length === 1 ? '' : 's'} waiting on you</p>
          </div>
          <a className="btn btn-primary" href="#/team/validations">
            Start evaluating <ArrowRight size={15} />
          </a>
        </section>
      )}

      <Card title="Completion across the team" description="How far each part of the cycle has got.">
        <ul className="funnel">
          {funnel.map((f) => (
            <li key={f.label}>
              <span>{f.label}</span>
              <div className="pbar" role="progressbar" aria-valuenow={f.all ? Math.round((f.done / f.all) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={f.label}>
                <span style={{ transform: `scaleX(${f.all ? f.done / f.all : 0})` }} />
              </div>
              <b>{outOf(f.done, f.all)}</b>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Skills at a glance" description="Each square is one person's status in one skill. Select a person to see the detail.">
        <div className="heat-wrap">
          <table className="heat">
            <thead>
              <tr>
                <th />
                {columns.map((c) => (
                  <th key={c.id} title={c.name}>
                    <span>{c.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <th scope="row">
                    <a href={`#/team/member/${m.id}`}>{m.snapshot.employee.name}</a>
                  </th>
                  {columns.map((col) => {
                    const c = m.snapshot.clusters.find((x) => x.id === col.id)
                    const status = c ? clusterStatus(c, m.snapshot.scoring) : null
                    return (
                      <td key={col.id}>
                        {status ? (
                          <a className="heat-cell" data-status={status} href={`#/team/member/${m.id}`} title={`${m.snapshot.employee.name} · ${col.name}: ${HEAT_LABEL[status]}`} aria-label={`${m.snapshot.employee.name}, ${col.name}: ${HEAT_LABEL[status]}`} />
                        ) : (
                          <span className="heat-cell" data-status="none" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          {ORDER.map((s) => (
            <span key={s}>
              <i className="swatch heat-swatch" data-status={s} /> {HEAT_LABEL[s]}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Where the team is strong or requires development" description="Number of people in each state, per skill.">
        <ul className="skill-split">
          {bySkill.map(({ col, counts }) => (
            <li key={col.id}>
              <span className="strong">{col.name}</span>
              <div className="split-bar" role="img" aria-label={ORDER.map((s) => `${counts[s]} ${HEAT_LABEL[s]}`).join(', ')}>
                {ORDER.map((s) => counts[s] > 0 && <span key={s} data-status={s} style={{ flexGrow: counts[s] }} title={`${counts[s]} ${HEAT_LABEL[s]}`}>{counts[s]}</span>)}
              </div>
            </li>
          ))}
        </ul>
        <div className="legend">
          {ORDER.map((s) => (
            <span key={s}>
              <i className="swatch heat-swatch" data-status={s} /> {HEAT_LABEL[s]}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
