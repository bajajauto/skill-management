import { ArrowLeft, Printer, Sparkles, Target } from 'lucide-react'
import { Button } from '../../components/ui'
import { usePublishedMe } from '../MeContext'
import { SCORE_NAME, STATUS_COPY, fmtDate, managerScore, summarize, testScore } from '../logic'
import { NotPublished, PageHead, ProgressBar, ScoreChip } from '../shared'
import type { PublishedMe } from '../types'

/** The employee's own card. */
export function SkillCard() {
  const pub = usePublishedMe()
  if (!pub) {
    return (
      <>
        <PageHead title="Skill card" />
        <NotPublished />
      </>
    )
  }
  return <SkillCardView m={pub.me} title="Skill card" sub="A one-page summary of your strengths and development areas." />
}

/** One person's skill card, for themselves or for a manager or BUHR looking at someone in their scope. */
export function SkillCardView({ m, title, sub, back }: { m: PublishedMe; title: string; sub: string; back?: { href: string; label: string } }) {
  const e = m.employee
  const s = summarize(m)
  // A skill is only judged once both its manager evaluation and its objective test result are in.
  // Until then it is neither a strength nor a development area, however the one result that exists looks.
  const ready = s.rows.filter(({ c }) => managerScore(c) != null && testScore(c) != null)
  const waiting = s.rows.length - ready.length
  const strengths = ready.filter((r) => r.status === 'cleared')
  const devAreas = ready.filter((r) => r.status === 'gap')
  const waitingText = 'Appears once your manager evaluation and objective test results are in.'
  const initials = e.name.split(' ').map((p) => p[0]).join('').slice(0, 2)

  return (
    <>
      {back && (
        <a className="back-link back-link-block" href={back.href}>
          <ArrowLeft size={14} /> {back.label}
        </a>
      )}
      <PageHead
        title={title}
        sub={sub}
        action={
          <Button onClick={() => window.print()}>
            <Printer size={14} /> Print or save as PDF
          </Button>
        }
      />
      <article className="skillcard" aria-label="Skill card">
        <header className="skillcard-head">
          <span className="demo-avatar avatar-lg">{initials}</span>
          <div>
            <h2>{e.name}</h2>
            <p>
              {e.jobProfile} · {e.businessUnit}
            </p>
            <p className="skillcard-meta">
              {e.employeeId} · {e.location}
            </p>
          </div>
          <div className="skillcard-level">
            <small>Current level</small>
            <strong>{s.level?.name}</strong>
          </div>
        </header>

        <section>
          <div className="row-between">
            <h3>Level progress</h3>
            <span className="muted">
              {s.cleared.length} of {m.clusters.length} skills cleared
            </span>
          </div>
          <ProgressBar value={s.cleared.length} max={m.clusters.length} label="Skills cleared" />
          {s.nextLevel && <p className="field-hint">Clear every skill at {s.level?.name} to unlock {s.nextLevel.name}.</p>}
        </section>

        <div className="skillcard-cols">
          <section>
            <h3>
              <Sparkles size={15} /> Strengths
            </h3>
            {strengths.length ? (
              <ul>
                {strengths.map(({ c }) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{waiting === s.rows.length ? waitingText : 'None yet.'}</p>
            )}
          </section>
          <section>
            <h3>
              <Target size={15} /> Development areas
            </h3>
            {devAreas.length ? (
              <ul>
                {devAreas.map(({ c }) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{waiting === s.rows.length ? waitingText : 'None right now.'}</p>
            )}
          </section>
        </div>
        {waiting > 0 && waiting < s.rows.length && (
          <p className="field-hint">
            {waiting} of {s.rows.length} skill{s.rows.length === 1 ? '' : 's'} still waiting for results, so {waiting === 1 ? 'it isn’t' : 'they aren’t'} counted above yet.
          </p>
        )}

        <section>
          <h3>Skill by skill</h3>
          <table className="table skillcard-table">
            <thead>
              <tr>
                <th>{m.labels.skill}</th>
                <th>Manager</th>
                <th>Test</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map(({ c, status }) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <ScoreChip score={managerScore(c)} /> {managerScore(c) ? SCORE_NAME[managerScore(c)!] : ''}
                  </td>
                  <td>
                    <ScoreChip score={testScore(c)} /> {testScore(c) ? SCORE_NAME[testScore(c)!] : ''}
                  </td>
                  <td>
                    <span className="status-pill" data-status={status}>
                      {STATUS_COPY[status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="skillcard-foot">
          {m.cycle.name} · Framework v{m.version} · Generated {fmtDate(new Date().toISOString())}
        </footer>
      </article>
    </>
  )
}
