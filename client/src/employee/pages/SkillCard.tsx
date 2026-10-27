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
  const strengths = s.rows.filter(({ c }) => (managerScore(c) ?? 0) >= 3 || (testScore(c) ?? 0) >= 3)
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
              <p className="muted">Strengths show up here as results come in.</p>
            )}
          </section>
          <section>
            <h3>
              <Target size={15} /> Development areas
            </h3>
            {s.gaps.length ? (
              <ul>
                {s.gaps.map(({ c }) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{s.incomplete.length ? 'None identified yet.' : 'None right now.'}</p>
            )}
          </section>
        </div>

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
                  <td>{STATUS_COPY[status].label}</td>
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
